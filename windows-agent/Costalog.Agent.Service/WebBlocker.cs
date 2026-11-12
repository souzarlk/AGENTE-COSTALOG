using System.Diagnostics;
using System.Text;
using Microsoft.Win32;

namespace Costalog.Agent.Service;

public sealed record WebBlockResult(bool Changed, bool Tampered, int BlockedHosts, string? Error);

// Aplica a lista de sites bloqueados recebida na política assinada:
// 1) políticas oficiais dos navegadores (Chrome, Edge, Brave e Firefox);
// 2) seção gerenciada do arquivo hosts do Windows, como reforço.
// É executado a cada ciclo do agente; se alguém remover um bloqueio, ele é reaplicado.
public static class WebBlocker
{
    const string HostsBegin = "# >>> AGENTE COSTALOG - bloqueios gerenciados (nao editar)";
    const string HostsEnd = "# <<< AGENTE COSTALOG";
    const string FirefoxKey = @"SOFTWARE\Policies\Mozilla\Firefox";

    static readonly string[] ChromiumKeys =
    {
        @"SOFTWARE\Policies\Google\Chrome",
        @"SOFTWARE\Policies\Microsoft\Edge",
        @"SOFTWARE\Policies\BraveSoftware\Brave"
    };

    static string? _lastApplied;

    public static WebBlockResult Apply(IEnumerable<string> hostnames)
    {
        var hosts = hostnames
            .Select(h => h.Trim().ToLowerInvariant())
            .Select(h => h.StartsWith("*.", StringComparison.Ordinal) ? h[2..] : h)
            .Where(h => h.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(h => h, StringComparer.Ordinal)
            .ToArray();

        var signature = string.Join("|", hosts);
        var errors = new List<string>();
        var changed = false;

        foreach (var key in ChromiumKeys)
        {
            try { changed |= ApplyChromium(key, hosts); }
            catch (Exception e) { errors.Add(key + ": " + e.Message); }
        }

        try { changed |= ApplyFirefox(hosts); }
        catch (Exception e) { errors.Add("Firefox: " + e.Message); }

        try { changed |= ApplyHostsFile(hosts); }
        catch (Exception e) { errors.Add("hosts: " + e.Message); }

        // Mesma lista já aplicada antes e, mesmo assim, algo precisou ser corrigido:
        // alguém alterou o registro ou o arquivo hosts manualmente.
        var tampered = changed && _lastApplied == signature;
        _lastApplied = signature;

        return new WebBlockResult(
            changed,
            tampered,
            hosts.Length,
            errors.Count == 0 ? null : string.Join("; ", errors));
    }

    static bool ApplyChromium(string keyPath, string[] hosts)
    {
        using var existing = Registry.LocalMachine.OpenSubKey(keyPath, true);

        if (existing is null && hosts.Length == 0)
            return false;

        using var root = existing ?? Registry.LocalMachine.CreateSubKey(keyPath, true);
        var changed = WriteList(root, "URLBlocklist", hosts);

        // Sem DNS via HTTPS o navegador respeita também o arquivo hosts.
        if (hosts.Length > 0 && (root.GetValue("DnsOverHttpsMode") as string) != "off")
        {
            root.SetValue("DnsOverHttpsMode", "off", RegistryValueKind.String);
            changed = true;
        }

        return changed;
    }

    static bool ApplyFirefox(string[] hosts)
    {
        var patterns = hosts
            .SelectMany(h => new[] { "*://" + h + "/*", "*://*." + h + "/*" })
            .ToArray();

        using var existing = Registry.LocalMachine.OpenSubKey(FirefoxKey, true);

        if (existing is null && patterns.Length == 0)
            return false;

        using var root = existing ?? Registry.LocalMachine.CreateSubKey(FirefoxKey, true);
        using var filter = root.CreateSubKey("WebsiteFilter", true);
        var changed = WriteList(filter, "Block", patterns);

        if (patterns.Length > 0)
        {
            using var doh = root.CreateSubKey("DNSOverHTTPS", true);

            if (!Equals(doh.GetValue("Enabled"), 0) || !Equals(doh.GetValue("Locked"), 1))
            {
                doh.SetValue("Enabled", 0, RegistryValueKind.DWord);
                doh.SetValue("Locked", 1, RegistryValueKind.DWord);
                changed = true;
            }
        }

        return changed;
    }

    // Lista no formato das políticas: subchave com valores "1", "2", "3"...
    static bool WriteList(RegistryKey root, string name, string[] items)
    {
        if (ReadList(root, name).SequenceEqual(items, StringComparer.Ordinal))
            return false;

        root.DeleteSubKeyTree(name, false);

        if (items.Length > 0)
        {
            using var list = root.CreateSubKey(name, true);

            for (var i = 0; i < items.Length; i++)
                list.SetValue((i + 1).ToString(), items[i], RegistryValueKind.String);
        }

        return true;
    }

    static string[] ReadList(RegistryKey root, string name)
    {
        using var key = root.OpenSubKey(name);

        if (key is null)
            return [];

        var values = new List<(int Index, string Value)>();

        foreach (var valueName in key.GetValueNames())
        {
            if (int.TryParse(valueName, out var index) && key.GetValue(valueName) is string value)
                values.Add((index, value));
        }

        return values.OrderBy(v => v.Index).Select(v => v.Value).ToArray();
    }

    static bool ApplyHostsFile(string[] hosts)
    {
        var path = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.System),
            "drivers", "etc", "hosts");

        var original = File.Exists(path) ? File.ReadAllText(path) : "";

        if (hosts.Length == 0 && !original.Contains(HostsBegin, StringComparison.Ordinal))
            return false;

        var outside = new List<string>();
        var inside = false;

        foreach (var line in original.Replace("\r\n", "\n").Split('\n'))
        {
            var trimmed = line.Trim();

            if (trimmed == HostsBegin) { inside = true; continue; }
            if (trimmed == HostsEnd) { inside = false; continue; }
            if (!inside) outside.Add(line);
        }

        while (outside.Count > 0 && outside[^1].Trim().Length == 0)
            outside.RemoveAt(outside.Count - 1);

        var sb = new StringBuilder(string.Join("\r\n", outside));

        if (hosts.Length > 0)
        {
            if (sb.Length > 0)
                sb.Append("\r\n\r\n");

            sb.Append(HostsBegin).Append("\r\n");

            foreach (var host in hosts)
            {
                sb.Append("0.0.0.0 ").Append(host).Append("\r\n");

                if (!host.StartsWith("www.", StringComparison.Ordinal))
                    sb.Append("0.0.0.0 www.").Append(host).Append("\r\n");
            }

            sb.Append(HostsEnd);
        }

        sb.Append("\r\n");
        var desired = sb.ToString();

        if (desired == original)
            return false;

        if (File.Exists(path))
        {
            var attributes = File.GetAttributes(path);

            if ((attributes & FileAttributes.ReadOnly) != 0)
                File.SetAttributes(path, attributes & ~FileAttributes.ReadOnly);
        }

        File.WriteAllText(path, desired, new UTF8Encoding(false));
        FlushDns();
        return true;
    }

    static void FlushDns()
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "ipconfig.exe",
                Arguments = "/flushdns",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            });

            process?.WaitForExit(5000);
        }
        catch
        {
        }
    }
}
