using System.Diagnostics.Eventing.Reader;

namespace Costalog.Agent.Service;

public sealed record WindowsEventInfo(
    string Severity,
    string Title,
    string Message,
    string Provider,
    int EventId,
    string Log,
    DateTime TimeUtc);

// Lê nos logs do Windows somente o que indica problema real no computador:
// eventos críticos, erros de disco/hardware, telas azuis e falhas do Microsoft Office.
public static class WindowsEventScanner
{
    static readonly HashSet<string> DiskProviders = new(StringComparer.OrdinalIgnoreCase)
    {
        "disk", "Ntfs", "Microsoft-Windows-Ntfs", "volmgr", "storahci", "stornvme",
        "iaStorA", "iaStorAC", "iaStorAVC", "iaStorV", "Microsoft-Windows-StorPort", "atapi"
    };

    static readonly HashSet<string> OfficeApps = new(StringComparer.OrdinalIgnoreCase)
    {
        "WINWORD.EXE", "EXCEL.EXE", "OUTLOOK.EXE", "POWERPNT.EXE", "MSACCESS.EXE",
        "ONENOTE.EXE", "MSPUB.EXE", "VISIO.EXE", "WINPROJ.EXE", "OfficeClickToRun.exe"
    };

    public static List<WindowsEventInfo> Read(DateTime sinceUtc, int limit)
    {
        var since = sinceUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        var result = new List<WindowsEventInfo>();

        Collect(
            "System",
            $"*[System[(Level=1 or Level=2) and TimeCreated[@SystemTime>'{since}']]]",
            ClassifySystem,
            result,
            limit);

        Collect(
            "Application",
            $"*[System[Provider[@Name='Application Error' or @Name='Application Hang'] and (Level=1 or Level=2) and TimeCreated[@SystemTime>'{since}']]]",
            ClassifyApplication,
            result,
            limit);

        return result.OrderBy(x => x.TimeUtc).Take(limit).ToList();
    }

    static void Collect(
        string log,
        string xpath,
        Func<EventRecord, string, WindowsEventInfo?> classify,
        List<WindowsEventInfo> result,
        int limit)
    {
        try
        {
            var query = new EventLogQuery(log, PathType.LogName, xpath);
            using var reader = new EventLogReader(query);

            for (var record = reader.ReadEvent(); record is not null; record = reader.ReadEvent())
            {
                using (record)
                {
                    var info = classify(record, log);

                    if (info is not null)
                        result.Add(info);
                }

                if (result.Count >= limit * 2)
                    break;
            }
        }
        catch
        {
        }
    }

    static WindowsEventInfo? ClassifySystem(EventRecord r, string log)
    {
        var provider = r.ProviderName ?? "";
        var id = r.Id;
        var critical = r.Level == 1;

        string? title = null;
        var severity = "warning";

        if (provider.Equals("Microsoft-Windows-Kernel-Power", StringComparison.OrdinalIgnoreCase) && id == 41)
        {
            title = "Desligamento inesperado";
            severity = "critical";
        }
        else if (provider.Equals("BugCheck", StringComparison.OrdinalIgnoreCase) ||
                 (provider.Equals("Microsoft-Windows-WER-SystemErrorReporting", StringComparison.OrdinalIgnoreCase) && id == 1001))
        {
            title = "Tela azul (erro crítico do Windows)";
            severity = "critical";
        }
        else if (provider.Contains("WHEA-Logger", StringComparison.OrdinalIgnoreCase))
        {
            title = "Erro de hardware";
            severity = "critical";
        }
        else if (DiskProviders.Contains(provider))
        {
            title = "Erro de disco";
            severity = critical ? "critical" : "warning";
        }
        else if (critical)
        {
            title = "Evento crítico do Windows";
            severity = "critical";
        }

        if (title is null)
            return null;

        return new WindowsEventInfo(
            severity,
            title,
            Describe(r, provider, id),
            provider,
            id,
            log,
            (r.TimeCreated ?? DateTime.Now).ToUniversalTime());
    }

    static WindowsEventInfo? ClassifyApplication(EventRecord r, string log)
    {
        string app;

        try
        {
            app = r.Properties.Count > 0 ? r.Properties[0].Value?.ToString() ?? "" : "";
        }
        catch
        {
            app = "";
        }

        if (!OfficeApps.Contains(app))
            return null;

        var hang = (r.ProviderName ?? "").Contains("Hang", StringComparison.OrdinalIgnoreCase);

        return new WindowsEventInfo(
            "warning",
            hang ? "Microsoft Office travou" : "Falha do Microsoft Office",
            app + (hang ? " parou de responder." : " fechou com erro."),
            r.ProviderName ?? "",
            r.Id,
            log,
            (r.TimeCreated ?? DateTime.Now).ToUniversalTime());
    }

    static string Describe(EventRecord r, string provider, int id)
    {
        string text;

        try
        {
            text = r.FormatDescription() ?? "";
        }
        catch
        {
            text = "";
        }

        text = text.Replace("\r", " ").Replace("\n", " ").Trim();

        if (text.Length == 0)
            text = provider + " (evento " + id + ")";
        else
            text = provider + " " + id + ": " + text;

        return text.Length > 500 ? text[..500] : text;
    }
}
