using Microsoft.Data.Sqlite;

namespace Costalog.Agent.Service;

public sealed record BrowserVisit(DateTime TimeUtc, string Url, string Title, string Browser, string WindowsUser);

public sealed record BrowserHistorySource(string Key, string Browser, string File, bool Firefox, string Owner);

// Lê o histórico dos navegadores de cada usuário do computador
// (Chrome, Edge, Brave, Opera, Opera GX e Firefox), sem extensão.
// O banco do navegador é copiado para uma pasta temporária e lido somente para consulta.
public static class BrowserHistoryReader
{
    static readonly DateTime ChromiumEpoch = new(1601, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public static List<BrowserHistorySource> FindSources()
    {
        var sources = new List<BrowserHistorySource>();

        foreach (var (sid, profile) in UserCertificateReader.ReadProfiles())
        {
            if (string.IsNullOrEmpty(profile) || !Directory.Exists(profile))
                continue;

            var owner = UserCertificateReader.OwnerName(sid, profile);
            var local = Path.Combine(profile, "AppData", "Local");
            var roaming = Path.Combine(profile, "AppData", "Roaming");

            foreach (var (browser, root) in new[]
            {
                ("Chrome", Path.Combine(local, "Google", "Chrome", "User Data")),
                ("Edge", Path.Combine(local, "Microsoft", "Edge", "User Data")),
                ("Brave", Path.Combine(local, "BraveSoftware", "Brave-Browser", "User Data"))
            })
            {
                foreach (var dir in SafeDirectories(root))
                {
                    var name = Path.GetFileName(dir);

                    if (name != "Default" && !name.StartsWith("Profile ", StringComparison.OrdinalIgnoreCase))
                        continue;

                    AddIfExists(sources, browser, Path.Combine(dir, "History"), false, owner);
                }
            }

            foreach (var (browser, dir) in new[]
            {
                ("Opera", Path.Combine(roaming, "Opera Software", "Opera Stable")),
                ("Opera GX", Path.Combine(roaming, "Opera Software", "Opera GX Stable"))
            })
            {
                AddIfExists(sources, browser, Path.Combine(dir, "History"), false, owner);
                AddIfExists(sources, browser, Path.Combine(dir, "Default", "History"), false, owner);
            }

            foreach (var dir in SafeDirectories(Path.Combine(roaming, "Mozilla", "Firefox", "Profiles")))
                AddIfExists(sources, "Firefox", Path.Combine(dir, "places.sqlite"), true, owner);
        }

        return sources;
    }

    // Lê as visitas depois de "sinceUtc". Retorna também o horário da última visita lida,
    // que vira o novo ponto de partida (mesmo para visitas descartadas, como chrome://).
    public static (List<BrowserVisit> Visits, DateTime? LastTimeUtc) Read(
        BrowserHistorySource source,
        DateTime sinceUtc,
        int limit)
    {
        var visits = new List<BrowserVisit>();
        DateTime? last = null;
        var temp = Path.Combine(Path.GetTempPath(), "costalog-history-" + Guid.NewGuid().ToString("N"));

        try
        {
            Directory.CreateDirectory(temp);
            var copy = Path.Combine(temp, Path.GetFileName(source.File));
            CopyShared(source.File, copy);

            foreach (var suffix in new[] { "-wal", "-journal" })
            {
                if (File.Exists(source.File + suffix))
                    CopyShared(source.File + suffix, copy + suffix);
            }

            var connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = copy,
                Mode = SqliteOpenMode.ReadWrite,
                Pooling = false
            }.ToString();

            using var connection = new SqliteConnection(connectionString);
            connection.Open();

            using var command = connection.CreateCommand();

            if (source.Firefox)
            {
                command.CommandText =
                    "SELECT v.visit_date, p.url, IFNULL(p.title,'') FROM moz_historyvisits v " +
                    "JOIN moz_places p ON p.id = v.place_id WHERE v.visit_date > $since " +
                    "ORDER BY v.visit_date LIMIT $limit";
                command.Parameters.AddWithValue("$since", (sinceUtc - DateTime.UnixEpoch).Ticks / 10);
            }
            else
            {
                command.CommandText =
                    "SELECT v.visit_time, u.url, IFNULL(u.title,'') FROM visits v " +
                    "JOIN urls u ON u.id = v.url WHERE v.visit_time > $since " +
                    "ORDER BY v.visit_time LIMIT $limit";
                command.Parameters.AddWithValue("$since", (sinceUtc - ChromiumEpoch).Ticks / 10);
            }

            command.Parameters.AddWithValue("$limit", limit);

            using var reader = command.ExecuteReader();

            while (reader.Read())
            {
                var micro = reader.GetInt64(0);
                var time = (source.Firefox ? DateTime.UnixEpoch : ChromiumEpoch).AddTicks(micro * 10);
                last = time;

                var url = reader.IsDBNull(1) ? "" : reader.GetString(1);

                if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                    !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                    continue;

                var title = reader.IsDBNull(2) ? "" : reader.GetString(2);

                visits.Add(new BrowserVisit(
                    time,
                    Cut(url, 1000),
                    Cut(title, 200),
                    source.Browser,
                    source.Owner));
            }
        }
        finally
        {
            try
            {
                Directory.Delete(temp, true);
            }
            catch
            {
            }
        }

        return (visits, last);
    }

    static void AddIfExists(List<BrowserHistorySource> list, string browser, string file, bool firefox, string owner)
    {
        try
        {
            if (File.Exists(file))
                list.Add(new BrowserHistorySource(file.ToLowerInvariant(), browser, file, firefox, owner));
        }
        catch
        {
        }
    }

    static string[] SafeDirectories(string path)
    {
        try
        {
            return Directory.Exists(path) ? Directory.GetDirectories(path) : [];
        }
        catch
        {
            return [];
        }
    }

    static void CopyShared(string source, string destination)
    {
        using var input = new FileStream(
            source,
            FileMode.Open,
            FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete);
        using var output = File.Create(destination);
        input.CopyTo(output);
    }

    static string Cut(string value, int max) => value.Length > max ? value[..max] : value;
}
