
using System.Diagnostics;
using System.IO.Compression;
using System.Management;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Costalog.Agent.Service;

public sealed class AgentWorker : BackgroundService
{
    readonly ILogger<AgentWorker> _log;
    readonly HttpClient _http;

    DateTimeOffset _lastCertUpload = DateTimeOffset.MinValue;
    DateTimeOffset _lastFailure = DateTimeOffset.MinValue;
    DateTimeOffset _lastUpdateCheck = DateTimeOffset.MinValue;
    string? _attemptedUpdateVersion;
    DateTimeOffset _attemptedUpdateAt = DateTimeOffset.MinValue;

    public AgentWorker(ILogger<AgentWorker> log, HttpClient http)
    {
        _log = log;
        _http = http;
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        _log.LogInformation("AGENTE COSTALOG iniciado.");

        while (!stop.IsCancellationRequested)
        {
            try
            {
                var cfg = AgentConfigStore.Load();
                ValidateApi(cfg.ApiBaseUrl);

                if (string.IsNullOrWhiteSpace(cfg.DeviceTokenProtected))
                    await Enroll(cfg, stop);

                cfg = AgentConfigStore.Load();

                await Heartbeat(cfg, stop);
                await SendTelemetry(cfg, stop);

                if (DateTimeOffset.UtcNow - _lastCertUpload > TimeSpan.FromHours(12))
                {
                    await SendCertificates(cfg, stop);
                    _lastCertUpload = DateTimeOffset.UtcNow;
                }

                await SyncPolicy(cfg, stop);
                await FlushEvents(cfg, stop);
                await CheckUninstallApproval(cfg, stop);
                await CheckForUpdate(cfg, stop);
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning("Falha no ciclo do agente: {Message}", ex.Message);

                try
                {
                    await MarkState(
                        "sync-error",
                        [],
                        0,
                        DateTimeOffset.UtcNow,
                        stop
                    );
                }
                catch (Exception stateError)
                {
                    _log.LogWarning("Falha ao atualizar estado local: {Message}", stateError.Message);
                }

                await ReportFailure(ex, stop);
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(45), stop);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    static void ValidateApi(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var u) ||
            (u.Scheme != Uri.UriSchemeHttps &&
             !(u.IsLoopback && u.Scheme == Uri.UriSchemeHttp)))
        {
            throw new InvalidDataException(
                "A API deve usar HTTPS (HTTP apenas em localhost para desenvolvimento)."
            );
        }
    }

    Uri Endpoint(AgentConfig c, string p) =>
        new(c.ApiBaseUrl.TrimEnd('/') + "/" + p.TrimStart('/'));

    HttpRequestMessage Request(
        AgentConfig c,
        HttpMethod method,
        string path,
        object? body = null)
    {
        var r = new HttpRequestMessage(method, Endpoint(c, path));

        r.Headers.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json")
        );

        if (!string.IsNullOrWhiteSpace(c.DeviceTokenProtected))
        {
            r.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer",
                AgentConfigStore.Unprotect(c.DeviceTokenProtected)
            );
        }

        if (body is not null)
            r.Content = JsonContent.Create(body);

        return r;
    }

    async Task EnsureOk(
        HttpResponseMessage r,
        string label,
        CancellationToken ct)
    {
        if (!r.IsSuccessStatusCode)
        {
            var body = await r.Content.ReadAsStringAsync(ct);

            throw new HttpRequestException(
                label + " HTTP " + (int)r.StatusCode + ": " +
                (body.Length > 400 ? body[..400] : body)
            );
        }
    }

    async Task Enroll(AgentConfig c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.EnrollmentTokenProtected))
            throw new InvalidOperationException(
                "Código de instalação ausente. Execute o assistente novamente."
            );

        var hw = ReadHardware();

        var body = new
        {
            enrollmentToken = AgentConfigStore.Unprotect(c.EnrollmentTokenProtected),
            deviceName = Environment.MachineName,
            windowsUsername = hw.ActiveUser,
            domainName = hw.Domain,
            osCaption = hw.OsCaption,
            osVersion = hw.OsVersion,
            osBuild = hw.OsBuild,
            manufacturer = hw.Manufacturer,
            model = hw.Model,
            cpuName = hw.CpuName,
            ramTotalBytes = hw.RamTotalBytes,
            agentVersion = c.AgentVersion,
            installMode = c.InstallMode,
            bootAt = hw.BootAt
        };

        using var req = new HttpRequestMessage(
            HttpMethod.Post,
            Endpoint(c, "api/v1/device/enroll")
        )
        {
            Content = JsonContent.Create(body)
        };

        using var response = await _http.SendAsync(req, ct);

        await EnsureOk(response, "Enrollment recusado.", ct);

        using var doc = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync(ct)
        );

        var root = doc.RootElement;

        c.DeviceId = root.GetProperty("deviceId").GetString();
        c.InstallMode = root.GetProperty("installMode").GetString() ?? c.InstallMode;

        var token = root.GetProperty("deviceToken").GetString();

        if (string.IsNullOrWhiteSpace(c.DeviceId) ||
            string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidDataException(
                "A API não retornou credencial válida."
            );
        }

        c.DeviceTokenProtected = AgentConfigStore.Protect(token);
        c.EnrollmentTokenProtected = null;

        AgentConfigStore.Save(c);

        _log.LogInformation(
            "Computador registrado no painel Costalog: {DeviceId}",
            c.DeviceId
        );
    }

    async Task Heartbeat(AgentConfig c, CancellationToken ct)
    {
        var hw = ReadHardware();

        using var req = Request(
            c,
            HttpMethod.Post,
            "api/v1/device/heartbeat",
            new
            {
                agentVersion = c.AgentVersion,
                policyRevision = c.LastPolicyRevision,
                bootAt = hw.BootAt,
                ipAddress = hw.PrimaryIp
            }
        );

        using var res = await _http.SendAsync(req, ct);

        await EnsureOk(res, "Heartbeat recusado.", ct);
    }

    async Task SendTelemetry(AgentConfig c, CancellationToken ct)
    {
        var hw = ReadHardware();
        var disks = ReadDisks();

        var body = new
        {
            cpuPercent = (double?)null,
            memoryUsedBytes = hw.MemoryUsedBytes,
            memoryTotalBytes = hw.RamTotalBytes,
            uptimeSeconds = hw.UptimeSeconds,
            bootAt = hw.BootAt,
            osCaption = hw.OsCaption,
            osVersion = hw.OsVersion,
            osBuild = hw.OsBuild,
            manufacturer = hw.Manufacturer,
            model = hw.Model,
            cpuName = hw.CpuName,
            ramTotalBytes = hw.RamTotalBytes,
            network = hw.Network,
            disks
        };

        using var req = Request(
            c,
            HttpMethod.Post,
            "api/v1/device/telemetry",
            body
        );

        using var res = await _http.SendAsync(req, ct);

        await EnsureOk(res, "Telemetria recusada.", ct);
    }

    async Task SendCertificates(AgentConfig c, CancellationToken ct)
    {
        var certificates = ReadCertificates();

        using var req = Request(
            c,
            HttpMethod.Post,
            "api/v1/device/certificates",
            new { certificates }
        );

        using var res = await _http.SendAsync(req, ct);

        await EnsureOk(res, "Inventário de certificados recusado.", ct);
    }

    async Task SyncPolicy(AgentConfig c, CancellationToken ct)
    {
        using var req = Request(
            c,
            HttpMethod.Get,
            "api/v1/device/policy"
        );

        using var res = await _http.SendAsync(req, ct);

        if (res.StatusCode == HttpStatusCode.NotFound)
        {
            await MarkState(
                "no-policy",
                [],
                0,
                DateTimeOffset.UtcNow,
                ct
            );

            return;
        }

        await EnsureOk(res, "Política indisponível.", ct);

        var envelope = await res.Content.ReadFromJsonAsync<PolicyEnvelope>(
            cancellationToken: ct
        ) ?? throw new InvalidDataException("Envelope de política vazio.");

        using var doc = PolicyVerifier.VerifyEnvelope(
            envelope,
            c.PolicyPublicKeyPem
        );

        var p = doc.RootElement;

        var rev = p.GetProperty("revision").GetInt32();

        if (rev != envelope.Revision || rev < c.LastPolicyRevision)
            throw new InvalidDataException(
                "Revisão de política inválida ou regressiva."
            );

        var expiry = PolicyVerifier.ReadExpiry(p);

        if (expiry <= DateTimeOffset.UtcNow)
            throw new InvalidDataException(
                "A política recebida está expirada."
            );

        var device = p.GetProperty("device");

        if (device.GetProperty("id").GetString() != c.DeviceId)
            throw new InvalidDataException(
                "Política destinada a outro computador."
            );

        var mode = device.GetProperty("installMode").GetString();

        if (mode != c.InstallMode)
            throw new InvalidDataException(
                "Modo de instalação diverge da política do servidor."
            );

        var defaults = p.GetProperty("defaults");

        var webDefault = defaults.GetProperty("web").GetString() ?? "deny";

        var certificateDefault = defaults
            .GetProperty("certificate")
            .GetString() ?? "deny";

        if (webDefault is not ("allow" or "deny"))
            throw new InvalidDataException(
                "Ação padrão de navegação inválida."
            );

        if (certificateDefault is not ("allow" or "deny"))
            throw new InvalidDataException(
                "Ação padrão de certificado inválida."
            );

        var webRules = ParseWebRules(p);
        var certificateRules = ParseCertificateRules(p);

        var hosts = webRules
            .Where(x => x.Action == "allow")
            .Select(x => x.Hostname)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        c.LastPolicyRevision = rev;

        AgentConfigStore.Save(c);

        var policyPath = AgentConfigStore.PolicyPath;

        Directory.CreateDirectory(AgentConfigStore.PrivateRoot);

        File.WriteAllText(
            policyPath,
            JsonSerializer.Serialize(
                envelope,
                new JsonSerializerOptions(JsonSerializerDefaults.Web)
            )
        );

        await MarkState(
            "valid",
            hosts,
            rev,
            expiry,
            ct,
            webRules,
            certificateRules,
            webDefault,
            certificateDefault
        );

        _log.LogInformation(
            "Política {Revision} validada. Regras de navegação: {WebRules}. Regras de certificado: {CertificateRules}.",
            rev,
            webRules.Length,
            certificateRules.Length
        );

        await ApplyWebBlocking(c, rev, webRules, ct);
    }

    // ===== Atualização automática =====
    // A cada 5 minutos pergunta à API se há versão nova. O manifesto vem assinado com a
    // chave das políticas; o pacote só é aplicado se o SHA-256 conferir.
    async Task CheckForUpdate(AgentConfig c, CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow - _lastUpdateCheck < TimeSpan.FromMinutes(5))
            return;

        _lastUpdateCheck = DateTimeOffset.UtcNow;

        try
        {
            await TryUpdate(c, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception e)
        {
            _log.LogWarning("Falha na atualização automática: {Message}", e.Message);
        }
    }

    async Task TryUpdate(AgentConfig c, CancellationToken ct)
    {
        using var check = Request(
            c,
            HttpMethod.Get,
            "api/v1/device/agent-update?current=" + Uri.EscapeDataString(c.AgentVersion));

        using var checkRes = await _http.SendAsync(check, ct);

        if (checkRes.StatusCode is HttpStatusCode.NoContent or HttpStatusCode.NotFound)
            return;

        await EnsureOk(checkRes, "Verificação de atualização recusada.", ct);

        var envelope = await checkRes.Content.ReadFromJsonAsync<PolicyEnvelope>(cancellationToken: ct)
            ?? throw new InvalidDataException("Manifesto de atualização vazio.");

        using var doc = PolicyVerifier.VerifyEnvelope(envelope, c.PolicyPublicKeyPem);
        var m = doc.RootElement;

        if (m.GetProperty("purpose").GetString() != "agent-update")
            throw new InvalidDataException("Manifesto de atualização inválido.");

        if (m.GetProperty("deviceId").GetString() != c.DeviceId)
            throw new InvalidDataException("Manifesto de atualização destinado a outro computador.");

        if (PolicyVerifier.ReadExpiry(m) <= DateTimeOffset.UtcNow)
            throw new InvalidDataException("Manifesto de atualização expirado.");

        var version = m.GetProperty("version").GetString() ?? "";
        var expectedHash = (m.GetProperty("sha256").GetString() ?? "").ToLowerInvariant();

        if (!Version.TryParse(version, out var target) ||
            !Version.TryParse(c.AgentVersion, out var current) ||
            target <= current)
            return;

        // Evita repetir uma tentativa que acabou de ser feita (sucesso reinicia o serviço).
        if (_attemptedUpdateVersion == version &&
            DateTimeOffset.UtcNow - _attemptedUpdateAt < TimeSpan.FromHours(1))
            return;

        _attemptedUpdateVersion = version;
        _attemptedUpdateAt = DateTimeOffset.UtcNow;

        _log.LogInformation("Atualização disponível: {Current} -> {Target}.", c.AgentVersion, version);

        var updateRoot = Path.Combine(AgentConfigStore.PrivateRoot, "update");

        if (Directory.Exists(updateRoot))
            Directory.Delete(updateRoot, true);

        Directory.CreateDirectory(updateRoot);

        var zipPath = Path.Combine(updateRoot, "package.zip");

        using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct))
        {
            timeout.CancelAfter(TimeSpan.FromMinutes(15));

            using var download = Request(
                c,
                HttpMethod.Get,
                "api/v1/device/agent-update/package/" + Uri.EscapeDataString(version));

            using var downloadRes = await _http.SendAsync(
                download,
                HttpCompletionOption.ResponseHeadersRead,
                timeout.Token);

            await EnsureOk(downloadRes, "Download da atualização recusado.", timeout.Token);

            await using var input = await downloadRes.Content.ReadAsStreamAsync(timeout.Token);
            await using var output = File.Create(zipPath);
            await input.CopyToAsync(output, timeout.Token);
        }

        string actualHash;

        await using (var file = File.OpenRead(zipPath))
            actualHash = Convert.ToHexString(await SHA256.HashDataAsync(file, ct)).ToLowerInvariant();

        if (actualHash != expectedHash)
            throw new CryptographicException("O pacote de atualização não confere com o manifesto assinado.");

        var staging = Path.Combine(updateRoot, "staging");
        ZipFile.ExtractToDirectory(zipPath, staging);

        if (!File.Exists(Path.Combine(staging, "Costalog.Agent.Service.exe")))
            throw new InvalidDataException("Pacote de atualização sem o executável do serviço.");

        var script = Path.Combine(updateRoot, "apply-update.ps1");
        File.WriteAllText(script, AgentUpdateScript.Content, new UTF8Encoding(true));

        var start = new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe"),
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var arg in new[]
        {
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-File", script,
            "-Staging", staging,
            "-Target", AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar),
            "-Config", AgentConfigStore.ConfigPath,
            "-Version", version,
            "-Log", Path.Combine(updateRoot, "update.log")
        })
        {
            start.ArgumentList.Add(arg);
        }

        Process.Start(start)?.Dispose();

        _log.LogInformation(
            "Atualização para {Version} baixada e verificada. O serviço será reiniciado com a nova versão.",
            version);
    }

    async Task ApplyWebBlocking(
        AgentConfig c,
        int revision,
        WebPolicyRule[] webRules,
        CancellationToken ct)
    {
        // Perfil "certificate" é somente inventário: nenhum bloqueio de navegação.
        var exceptions = new HashSet<string>(
            webRules.Where(r => r.Action == "allow").Select(r => r.Hostname),
            StringComparer.OrdinalIgnoreCase);

        var blocked = c.InstallMode == "certificate-and-web"
            ? webRules
                .Where(r => r.Action == "block" && r.ScopeType == "all" && !exceptions.Contains(r.Hostname))
                .Select(r => r.Hostname)
                .ToArray()
            : Array.Empty<string>();

        var result = WebBlocker.Apply(blocked);

        if (result.Error is not null)
            _log.LogWarning("Falha ao aplicar bloqueio de sites: {Error}", result.Error);

        if (result.Changed)
            _log.LogInformation(
                "Bloqueio de sites aplicado (política {Revision}): {Count} domínio(s); navegadores atualizados: {Browsers}.",
                revision,
                result.BlockedHosts,
                result.BrowsersRefreshed);

        if (result.Tampered)
        {
            try
            {
                await ReportEvent(
                    c,
                    "web_policy_restored",
                    "Bloqueio de sites restaurado",
                    "O bloqueio de sites foi alterado neste computador e o agente o reaplicou.",
                    new { policyRevision = revision, blockedHosts = result.BlockedHosts },
                    ct);
            }
            catch (Exception e)
            {
                _log.LogWarning("Falha ao registrar restauração do bloqueio: {Message}", e.Message);
            }
        }
    }

    static WebPolicyRule[] ParseWebRules(JsonElement policy)
    {
        if (!policy.TryGetProperty("webRules", out var rules) ||
            rules.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException(
                "Lista de regras de navegação ausente ou inválida."
            );
        }

        var result = new List<WebPolicyRule>();

        foreach (var item in rules.EnumerateArray())
        {
            var name = item.GetProperty("name").GetString() ?? "";
            var hostname = item.GetProperty("hostname").GetString() ?? "";
            var action = item.GetProperty("action").GetString() ?? "";
            var scopeType = item.GetProperty("scopeType").GetString() ?? "all";
            var scopeValue = item.GetProperty("scopeValue").GetString() ?? "";

            if (string.IsNullOrWhiteSpace(name) ||
                !IsHost(hostname) ||
                action is not ("allow" or "block") ||
                scopeType is not ("all" or "group" or "device"))
            {
                throw new InvalidDataException(
                    "Regra de navegação inválida."
                );
            }

            result.Add(new WebPolicyRule
            {
                Name = name,
                Hostname = hostname.ToLowerInvariant(),
                Action = action,
                ScopeType = scopeType,
                ScopeValue = scopeValue
            });
        }

        return result.ToArray();
    }

    static CertificatePolicyRule[] ParseCertificateRules(JsonElement policy)
    {
        if (!policy.TryGetProperty("certificateRules", out var rules) ||
            rules.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException(
                "Lista de regras de certificado ausente ou inválida."
            );
        }

        var result = new List<CertificatePolicyRule>();

        foreach (var item in rules.EnumerateArray())
        {
            var name = item.GetProperty("name").GetString() ?? "";
            var hostname = item.GetProperty("hostname").GetString() ?? "";
            var certificateScope =
                item.GetProperty("certificateScope").GetString() ?? "";

            if (string.IsNullOrWhiteSpace(name) ||
                !IsHost(hostname) ||
                string.IsNullOrWhiteSpace(certificateScope))
            {
                throw new InvalidDataException(
                    "Regra de certificado inválida."
                );
            }

            result.Add(new CertificatePolicyRule
            {
                Name = name,
                Hostname = hostname.ToLowerInvariant(),
                CertificateScope = certificateScope
            });
        }

        return result.ToArray();
    }

    async Task FlushEvents(AgentConfig c, CancellationToken ct)
    {
        if (!Directory.Exists(AgentConfigStore.PendingEventsRoot))
            return;

        foreach (var file in Directory
            .EnumerateFiles(AgentConfigStore.PendingEventsRoot, "*.json")
            .Take(100))
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                var fi = new FileInfo(file);

                if (fi.Length > 8192)
                {
                    File.Delete(file);
                    continue;
                }

                using var d = JsonDocument.Parse(
                    await File.ReadAllTextAsync(file, ct)
                );

                var r = d.RootElement;

                var domain = r.GetProperty("domain").GetString() ?? "";

                if (!IsHost(domain))
                {
                    File.Delete(file);
                    continue;
                }

                var created = r.TryGetProperty("createdAt", out var t)
                    ? t.GetString()
                    : null;

                var when = DateTimeOffset.TryParse(created, out var dt)
                    ? dt
                    : DateTimeOffset.UtcNow;

                using var req = Request(
                    c,
                    HttpMethod.Post,
                    "api/v1/device/browsing-events",
                    new
                    {
                        hostname = domain,
                        decision = "blocked",
                        policyRevision = c.LastPolicyRevision,
                        ruleName = "Política deny-by-default",
                        occurredAt = when
                    }
                );

                using var res = await _http.SendAsync(req, ct);

                if (res.IsSuccessStatusCode)
                    File.Delete(file);
                else if ((int)res.StatusCode >= 400 &&
                         (int)res.StatusCode < 500 &&
                         res.StatusCode != HttpStatusCode.TooManyRequests)
                    File.Delete(file);
                else
                    break;
            }
            catch (JsonException)
            {
                File.Delete(file);
            }
            catch (IOException)
            {
                break;
            }
        }
    }

    async Task CheckUninstallApproval(AgentConfig c, CancellationToken ct)
    {
        using var req = Request(
            c,
            HttpMethod.Get,
            "api/v1/device/uninstall-approval"
        );

        using var res = await _http.SendAsync(req, ct);

        if (res.StatusCode == HttpStatusCode.NoContent)
            return;

        await EnsureOk(
            res,
            "Consulta de autorização de remoção falhou.",
            ct
        );

        using var response = JsonDocument.Parse(
            await res.Content.ReadAsStringAsync(ct)
        );

        var approval = response.RootElement.GetProperty("approval");

        using var payload = PolicyVerifier.VerifyApproval(
            approval,
            c.PolicyPublicKeyPem
        );

        var p = payload.RootElement;

        if (p.GetProperty("purpose").GetString() != "agent-uninstall" ||
            p.GetProperty("deviceId").GetString() != c.DeviceId ||
            !DateTimeOffset.TryParse(
                p.GetProperty("expiresAt").GetString(),
                out var expiry
            ) ||
            expiry <= DateTimeOffset.UtcNow)
        {
            throw new CryptographicException(
                "Autorização de desinstalação inválida ou expirada."
            );
        }

        Directory.CreateDirectory(AgentConfigStore.PrivateRoot);

        File.WriteAllText(
            Path.Combine(
                AgentConfigStore.PrivateRoot,
                "uninstall-approval.json"
            ),
            approval.GetRawText()
        );

        await ReportEvent(
            c,
            "uninstall_authorization_received",
            "Autorização de remoção recebida",
            "A equipe de TI autorizou uma remoção temporária.",
            new
            {
                requestId = p.GetProperty("requestId").GetString(),
                expiresAt = expiry.ToString("O")
            },
            ct
        );
    }

    async Task ReportFailure(Exception e, CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow - _lastFailure < TimeSpan.FromMinutes(10))
            return;

        _lastFailure = DateTimeOffset.UtcNow;

        try
        {
            var c = AgentConfigStore.Load();

            if (string.IsNullOrWhiteSpace(c.DeviceTokenProtected))
                return;

            await ReportEvent(
                c,
                "agent_sync_failed",
                "Falha na sincronização",
                e.Message.Length > 500 ? e.Message[..500] : e.Message,
                new { agentVersion = c.AgentVersion },
                ct
            );
        }
        catch
        {
        }
    }

    async Task ReportEvent(
        AgentConfig c,
        string type,
        string title,
        string message,
        object details,
        CancellationToken ct)
    {
        using var req = Request(
            c,
            HttpMethod.Post,
            "api/v1/device/events",
            new
            {
                eventType = type,
                severity = "warning",
                title,
                message,
                details
            }
        );

        using var res = await _http.SendAsync(req, ct);
    }

    async Task MarkState(
        string status,
        string[] hosts,
        int revision,
        DateTimeOffset expiry,
        CancellationToken ct,
        WebPolicyRule[]? webRules = null,
        CertificatePolicyRule[]? certificateRules = null,
        string webDefaultAction = "deny",
        string certificateDefaultAction = "deny")
    {
        ct.ThrowIfCancellationRequested();

        var c = AgentConfigStore.Load();

        AgentConfigStore.WritePublicState(new AgentPublicState
        {
            Status = status,
            InstallMode = c.InstallMode,
            DeviceId = c.DeviceId,
            Revision = revision,
            ExpiresAt = expiry.ToString("O"),
            AllowedDestinations = hosts,
            WebDefaultAction = webDefaultAction,
            WebRules = webRules ?? [],
            CertificateDefaultAction = certificateDefaultAction,
            CertificateRules = certificateRules ?? [],
            UpdatedAt = DateTimeOffset.UtcNow.ToString("O")
        });

        await Task.CompletedTask;
    }

    static bool IsHost(string h)
    {
        return !string.IsNullOrWhiteSpace(h) &&
            h.Length <= 253 &&
            System.Text.RegularExpressions.Regex.IsMatch(
                h,
                @"^(?:\*\.)?(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
    }

    sealed record Hardware(
        string ActiveUser,
        string Domain,
        string OsCaption,
        string OsVersion,
        string OsBuild,
        string Manufacturer,
        string Model,
        string CpuName,
        ulong RamTotalBytes,
        ulong MemoryUsedBytes,
        long UptimeSeconds,
        string BootAt,
        string PrimaryIp,
        object Network
    );

    static Hardware ReadHardware()
    {
        var cs = FirstWmi(
            "SELECT UserName,Domain,Manufacturer,Model,TotalPhysicalMemory FROM Win32_ComputerSystem"
        );

        var os = FirstWmi(
            "SELECT Caption,Version,BuildNumber,LastBootUpTime,FreePhysicalMemory FROM Win32_OperatingSystem"
        );

        var cpu = FirstWmi(
            "SELECT Name FROM Win32_Processor"
        );

        var ram = ToUlong(cs?.GetValueOrDefault("TotalPhysicalMemory"));
        var freeKb = ToUlong(os?.GetValueOrDefault("FreePhysicalMemory"));

        var used = ram > freeKb * 1024
            ? ram - freeKb * 1024
            : 0UL;

        DateTimeOffset boot = DateTimeOffset.UtcNow;

        try
        {
            var raw = os?.GetValueOrDefault("LastBootUpTime")?.ToString();

            if (!string.IsNullOrWhiteSpace(raw))
                boot = ManagementDateTimeConverter
                    .ToDateTime(raw)
                    .ToUniversalTime();
        }
        catch
        {
        }

        var nics = NetworkInterface
            .GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up)
            .Select(n => n.GetIPProperties())
            .ToArray();

        var ips = nics
            .SelectMany(n => n.UnicastAddresses)
            .Where(a =>
                a.Address.AddressFamily ==
                System.Net.Sockets.AddressFamily.InterNetwork &&
                !IPAddress.IsLoopback(a.Address))
            .Select(a => a.Address.ToString())
            .Distinct()
            .ToArray();

        var gateways = nics
            .SelectMany(n => n.GatewayAddresses)
            .Select(g => g.Address.ToString())
            .Where(x => x != "0.0.0.0")
            .Distinct()
            .ToArray();

        var dns = nics
            .SelectMany(n => n.DnsAddresses)
            .Select(a => a.ToString())
            .Distinct()
            .ToArray();

        var domain = cs?.GetValueOrDefault("Domain")?.ToString() ?? "";

        var network = new
        {
            domain,
            ipv4 = ips,
            gateways,
            dns
        };

        return new Hardware(
            cs?.GetValueOrDefault("UserName")?.ToString() ?? Environment.UserName,
            domain,
            os?.GetValueOrDefault("Caption")?.ToString() ?? "",
            os?.GetValueOrDefault("Version")?.ToString() ?? "",
            os?.GetValueOrDefault("BuildNumber")?.ToString() ?? "",
            cs?.GetValueOrDefault("Manufacturer")?.ToString() ?? "",
            cs?.GetValueOrDefault("Model")?.ToString() ?? "",
            cpu?.GetValueOrDefault("Name")?.ToString() ?? "",
            ram,
            used,
            (long)Math.Max(
                0,
                (DateTimeOffset.UtcNow - boot).TotalSeconds
            ),
            boot.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            ips.FirstOrDefault() ?? "",
            network
        );
    }

    static Dictionary<string, object?>? FirstWmi(string query)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(query);
            using var results = searcher.Get();

            foreach (ManagementObject item in results)
            {
                using (item)
                {
                    var values = new Dictionary<string, object?>(
                        StringComparer.OrdinalIgnoreCase
                    );

                    foreach (PropertyData property in item.Properties)
                        values[property.Name] = property.Value;

                    return values;
                }
            }
        }
        catch
        {
        }

        return null;
    }

    static ulong ToUlong(object? v)
    {
        try
        {
            return Convert.ToUInt64(v ?? 0);
        }
        catch
        {
            return 0;
        }
    }

    static object[] ReadDisks()
    {
        var list = new List<object>();

        foreach (var d in DriveInfo.GetDrives()
            .Where(x => x.DriveType == DriveType.Fixed))
        {
            try
            {
                if (!d.IsReady)
                    continue;

                var total = (ulong)d.TotalSize;
                var free = (ulong)d.AvailableFreeSpace;

                var used = total == 0
                    ? 0d
                    : Math.Round((double)(total - free) * 100d / total, 2);

                list.Add(new
                {
                    driveLetter = d.Name,
                    volumeLabel = d.VolumeLabel,
                    filesystem = d.DriveFormat,
                    mediaType = "fixed",
                    totalBytes = total,
                    freeBytes = free,
                    usedPercent = used,
                    smartHealth = "unknown",
                    temperatureC = (double?)null
                });
            }
            catch
            {
            }
        }

        return list.ToArray();
    }

    static object[] ReadCertificates()
    {
        var list = new List<object>();

        foreach (var location in new[]
        {
            StoreLocation.LocalMachine,
            StoreLocation.CurrentUser
        })
        {
            try
            {
                using var store = new X509Store(
                    StoreName.My,
                    location
                );

                store.Open(
                    OpenFlags.ReadOnly |
                    OpenFlags.OpenExistingOnly
                );

                foreach (var cert in store.Certificates)
                {
                    try
                    {
                        var thumb = cert.Thumbprint ?? "";
                        var sha = Convert.ToHexString(
                            SHA256.HashData(cert.RawData)
                        );

                        list.Add(new
                        {
                            subjectName = cert.Subject,
                            issuerName = cert.Issuer,
                            serialNumber = cert.SerialNumber,
                            thumbprintSha1 = thumb,
                            thumbprintSha256 = sha,
                            notBefore = new DateTimeOffset(
                                cert.NotBefore.ToUniversalTime()
                            ).UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                            notAfter = new DateTimeOffset(
                                cert.NotAfter.ToUniversalTime()
                            ).UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                            storeName = location + "\\My",
                            hasPrivateKey = cert.HasPrivateKey
                        });
                    }
                    catch
                    {
                    }

                    if (list.Count >= 2000)
                        break;
                }
            }
            catch
            {
            }
        }

        return list.ToArray();
    }
}
