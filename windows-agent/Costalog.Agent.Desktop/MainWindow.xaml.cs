using System.IO;
using System.Management;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;

namespace Costalog.Agent.Desktop;

public partial class MainWindow : Window
{
    private static readonly string PublicStatePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "Costalog", "Agent", "Public", "agent-public-state.json");

    private readonly DispatcherTimer _refreshTimer = new() { Interval = TimeSpan.FromSeconds(30) };

    private static readonly Dictionary<string, (string Title, string Description)> Modules = new()
    {
        ["health"] = ("Saúde do computador", "Acompanhamento de inicialização, memória, processador, serviços do Windows e eventos críticos."),
        ["hardware"] = ("Hardware e sistema", "Inventário de processador, memória, placa-mãe, Windows, periféricos e softwares instalados."),
        ["storage"] = ("Armazenamento", "Análise de ocupação por pasta, saúde SMART dos SSDs e otimização apropriada para cada tipo de unidade."),
        ["network"] = ("Rede e conectividade", "Adaptadores, endereço IP, conectividade, DNS e regras de acesso à rede corporativa."),
        ["certificates"] = ("Proteção de certificados", "Inventário apenas de metadados públicos e aplicação de políticas de uso. Chaves privadas nunca são coletadas."),
        ["web"] = ("Sites e navegação", "Políticas corporativas de acesso, bloqueio de domínios e alertas de navegação suspeita."),
        ["usb"] = ("Proteção de dispositivos USB", "Políticas de dispositivos removíveis, prevenção de cópia não autorizada e auditoria de eventos."),
        ["software"] = ("Instalação de programas", "Inventário de aplicativos, regras de instalação e alertas de alterações não autorizadas."),
        ["users"] = ("Usuário e sessões", "Usuário conectado, sessões, grupos locais e informações necessárias à administração do endpoint."),
        ["alerts"] = ("Alertas e ocorrências", "Histórico de alertas do agente e notificações encaminhadas ao painel central da TI."),
        ["settings"] = ("Configurações", "Estado do serviço, vínculo com o painel central, versão do agente e informações de diagnóstico.")
    };

    public MainWindow()
    {
        InitializeComponent();
        DeviceNameText.Text = Environment.MachineName;
        LoadLocalState();
        _refreshTimer.Tick += (_, _) => LoadLocalState();
        _refreshTimer.Start();
        Closed += (_, _) => _refreshTimer.Stop();
    }

    private void LoadLocalState()
    {
        LoadLocalDiagnostics();

        try
        {
            var os = Environment.OSVersion.VersionString;
            OsMetric.Text = os.Length > 22 ? os[..22] + "…" : os;
            var uptime = TimeSpan.FromMilliseconds(Environment.TickCount64);
            UptimeMetric.Text = $"{(int)uptime.TotalDays}d {uptime.Hours:D2}h";
            if (!File.Exists(PublicStatePath))
            {
                AgentStatusText.Text = "Serviço não configurado";
                AgentMetric.Text = "Não vinculado";
                PolicyMetric.Text = "Pendente";
                LastUpdateText.Text = "Estado local indisponível";
                DeviceDetailsText.Text = $"Computador: {Environment.MachineName}\nWindows: {os}\nO serviço do agente ainda não publicou seu estado local.";
                PolicyDetailsText.Text = "O serviço ainda não foi configurado neste computador.";
                return;
            }

            using var json = JsonDocument.Parse(File.ReadAllText(PublicStatePath));
            var root = json.RootElement;
            var status = ReadString(root, "status", "unknown");
            var mode = ReadString(root, "installMode", "—");
            var deviceId = ReadString(root, "deviceId", "aguardando registro");
            var revision = root.TryGetProperty("revision", out var rev) ? rev.GetInt32() : 0;
            var updated = ReadString(root, "updatedAt", "");
            var hasTimestamp = DateTimeOffset.TryParse(updated, out var parsed);
            var isFresh = hasTimestamp && parsed <= DateTimeOffset.UtcNow.AddMinutes(1) &&
                          DateTimeOffset.UtcNow - parsed <= TimeSpan.FromMinutes(3);
            var displayStatus = isFresh ? status : "service-offline";

            AgentStatusText.Text = FriendlyStatus(displayStatus);
            AgentMetric.Text = FriendlyStatus(displayStatus);
            PolicyMetric.Text = revision > 0 ? $"Rev. {revision}" : "Pendente";
            LastUpdateText.Text = hasTimestamp
                ? $"Atualizado {parsed.ToLocalTime():dd/MM HH:mm}" + (isFresh ? "" : " • desatualizado")
                : "Estado local sem data de atualização";

            var destinations = root.TryGetProperty("allowedDestinations", out var hosts) && hosts.ValueKind == JsonValueKind.Array
                ? string.Join(", ", hosts.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)))
                : "Não informado";
            DeviceDetailsText.Text = $"Computador: {Environment.MachineName}\nWindows: {os}\nModo de instalação: {mode}\nDispositivo: {deviceId}";
            PolicyDetailsText.Text = $"Estado do agente: {FriendlyStatus(displayStatus)} • Revisão: {revision}\nDestinos autorizados recebidos: {destinations}";
        }
        catch (Exception ex)
        {
            AgentStatusText.Text = "Falha ao ler estado";
            AgentMetric.Text = "Verificar";
            LastUpdateText.Text = "Não foi possível atualizar";
            DeviceDetailsText.Text = "Não foi possível ler o estado local do agente: " + ex.Message;
        }
    }

    private void LoadLocalDiagnostics()
    {
        try
        {
            var system = ReadFirstWmi("SELECT Manufacturer,Model,TotalPhysicalMemory FROM Win32_ComputerSystem");
            var operatingSystem = ReadFirstWmi("SELECT TotalVisibleMemorySize,FreePhysicalMemory FROM Win32_OperatingSystem");
            var processor = ReadFirstWmi("SELECT Name,LoadPercentage FROM Win32_Processor");

            var manufacturer = GetWmiString(system, "Manufacturer");
            var model = GetWmiString(system, "Model");
            var cpu = GetWmiString(processor, "Name");
            var cpuLoad = GetWmiNumber(processor, "LoadPercentage");

            var ramTotal = GetWmiUInt64(system, "TotalPhysicalMemory");
            var ramTotalKb = GetWmiUInt64(operatingSystem, "TotalVisibleMemorySize");
            var ramFreeKb = GetWmiUInt64(operatingSystem, "FreePhysicalMemory");
            var ramUsed = ramTotalKb > ramFreeKb ? (ramTotalKb - ramFreeKb) * 1024UL : 0UL;
            if (ramTotal == 0) ramTotal = ramTotalKb * 1024UL;

            var drives = new List<string>();
            foreach (var drive in DriveInfo.GetDrives().Where(d => d.DriveType == DriveType.Fixed))
            {
                try
                {
                    if (!drive.IsReady) continue;
                    var total = (ulong)drive.TotalSize;
                    var free = (ulong)drive.AvailableFreeSpace;
                    var used = total == 0 ? 0d : Math.Round((double)(total - free) * 100d / total);
                    drives.Add($"{drive.Name.TrimEnd('\\')} — {used:0}% usado ({FormatBytes(total - free)} / {FormatBytes(total)})");
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }

            var cpuText = cpuLoad.HasValue ? $" — carga instantânea informada pelo Windows: {cpuLoad.Value:0}%" : "";
            LocalHardwareText.Text =
                $"Fabricante/modelo: {JoinKnown(manufacturer, model)}\n" +
                $"Processador: {Fallback(cpu, "Não identificado")}{cpuText}\n" +
                $"Memória RAM: {FormatBytes(ramUsed)} em uso / {FormatBytes(ramTotal)} total\n" +
                $"Unidades locais: {(drives.Count > 0 ? string.Join("\n", drives) : "Nenhuma unidade fixa pronta")}\n" +
                $"Atualização local: {DateTime.Now:dd/MM/yyyy HH:mm:ss}";
        }
        catch (Exception ex)
        {
            LocalHardwareText.Text = "O Windows não permitiu concluir o diagnóstico local: " + ex.Message;
        }
    }

    private static Dictionary<string, object?>? ReadFirstWmi(string query)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(query);
            using var results = searcher.Get();
            foreach (ManagementObject item in results)
            {
                using (item)
                {
                    var values = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    foreach (PropertyData property in item.Properties)
                        values[property.Name] = property.Value;
                    return values;
                }
            }
        }
        catch { }
        return null;
    }

    private static string GetWmiString(Dictionary<string, object?>? values, string key) =>
        values?.TryGetValue(key, out var value) == true ? value?.ToString() ?? "" : "";

    private static ulong GetWmiUInt64(Dictionary<string, object?>? values, string key)
    {
        try { return values?.TryGetValue(key, out var value) == true ? Convert.ToUInt64(value ?? 0) : 0UL; }
        catch { return 0UL; }
    }

    private static double? GetWmiNumber(Dictionary<string, object?>? values, string key)
    {
        try { return values?.TryGetValue(key, out var value) == true && value is not null ? Convert.ToDouble(value) : null; }
        catch { return null; }
    }

    private static string JoinKnown(string first, string second) =>
        string.Join(" ", new[] { first, second }.Where(x => !string.IsNullOrWhiteSpace(x)));

    private static string Fallback(string value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value;

    private static string FormatBytes(ulong bytes)
    {
        string[] units = ["B", "KB", "MB", "GB", "TB"];
        double value = bytes;
        var unit = 0;
        while (value >= 1024 && unit < units.Length - 1) { value /= 1024; unit++; }
        return $"{value:0.##} {units[unit]}";
    }

    private static string ReadString(JsonElement element, string name, string fallback) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? fallback : fallback;

    private static string FriendlyStatus(string status) => status switch
    {
        "valid" => "Política validada",
        "awaiting-enrollment" => "Aguardando cadastro",
        "sync-error" => "Falha de sincronização",
        "no-policy" => "Sem política",
        "service-offline" => "Serviço sem atualização",
        _ => "Não verificado"
    };

    private void Navigate_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string key }) return;
        if (key == "overview")
        {
            PageTitle.Text = "Visão geral";
            PageSubtitle.Text = "Resumo de segurança e funcionamento deste computador.";
            OverviewPanel.Visibility = Visibility.Visible;
            ModulePanel.Visibility = Visibility.Collapsed;
            return;
        }

        if (!Modules.TryGetValue(key, out var module)) return;
        PageTitle.Text = module.Title;
        PageSubtitle.Text = "Módulo local do AGENTE COSTALOG";
        ModuleTitle.Text = module.Title;
        ModuleDescription.Text = module.Description;
        OverviewPanel.Visibility = Visibility.Collapsed;
        ModulePanel.Visibility = Visibility.Visible;
    }
}
