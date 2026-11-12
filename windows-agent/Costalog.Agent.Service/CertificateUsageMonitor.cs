using System.Diagnostics.Eventing.Reader;
using System.Text.RegularExpressions;

namespace Costalog.Agent.Service;

public sealed record CertificateUse(DateTime TimeUtc, string Thumbprint, string Subject, string Process, string WindowsUser);

// Detecta quando um certificado com chave privada é solicitado/usado.
// Quando um site ou programa pede um certificado de cliente, o Windows monta a "cadeia"
// do certificado e registra isso no log CAPI2 (que o agente liga). Cruzando com o
// histórico de navegação, a API descobre em qual site o certificado foi usado.
public static class CertificateUsageMonitor
{
    const string LogName = "Microsoft-Windows-CAPI2/Operational";

    static readonly Regex CertificateTag = new("<Certificate\\s[^>]*>", RegexOptions.Compiled);
    static readonly Regex FileRefAttr = new("fileRef=\"([0-9A-Fa-f]{40})\\.cer\"", RegexOptions.Compiled);
    static readonly Regex SubjectAttr = new("subjectName=\"([^\"]*)\"", RegexOptions.Compiled);

    static readonly Regex ProcessAttr = new("ProcessName=\"([^\"]*)\"", RegexOptions.Compiled);

    static bool _logChecked;

    public static void EnsureLogEnabled()
    {
        if (_logChecked)
            return;

        _logChecked = true;

        try
        {
            using var config = new EventLogConfiguration(LogName);
            var changed = false;

            if (!config.IsEnabled)
            {
                config.IsEnabled = true;
                changed = true;
            }

            if (config.MaximumSizeInBytes < 20L * 1024 * 1024)
            {
                config.MaximumSizeInBytes = 20L * 1024 * 1024;
                changed = true;
            }

            if (changed)
                config.SaveChanges();
        }
        catch
        {
            _logChecked = false;
        }
    }

    public static (List<CertificateUse> Uses, DateTime? LastTimeUtc) Read(
        DateTime sinceUtc,
        IReadOnlySet<string> clientThumbprints,
        int limit)
    {
        var uses = new List<CertificateUse>();
        DateTime? last = null;

        if (clientThumbprints.Count == 0)
            return (uses, null);

        var since = sinceUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        var query = new EventLogQuery(
            LogName,
            PathType.LogName,
            $"*[System[(EventID=11) and TimeCreated[@SystemTime>'{since}']]]");

        using var reader = new EventLogReader(query);
        var read = 0;

        for (var record = reader.ReadEvent(); record is not null && read < limit; record = reader.ReadEvent(), read++)
        {
            using (record)
            {
                var time = (record.TimeCreated ?? DateTime.Now).ToUniversalTime();
                last = time;

                string xml;

                try
                {
                    xml = record.ToXml();
                }
                catch
                {
                    continue;
                }

                // O primeiro certificado da cadeia é o certificado final (o do usuário).
                var tag = CertificateTag.Match(xml);

                if (!tag.Success)
                    continue;

                var fileRef = FileRefAttr.Match(tag.Value);

                if (!fileRef.Success)
                    continue;

                var thumb = fileRef.Groups[1].Value.ToUpperInvariant();
                var subject = SubjectAttr.Match(tag.Value) is { Success: true } sm ? sm.Groups[1].Value : "";

                if (!clientThumbprints.Contains(thumb))
                    continue;

                var process = ProcessAttr.Match(xml) is { Success: true } p ? Path.GetFileName(p.Groups[1].Value) : "";
                var user = "";

                try
                {
                    user = record.UserId?.Translate(typeof(System.Security.Principal.NTAccount)).Value ?? "";
                }
                catch
                {
                }

                uses.Add(new CertificateUse(time, thumb, System.Net.WebUtility.HtmlDecode(subject), process, user));
            }
        }

        return (uses, last);
    }
}
