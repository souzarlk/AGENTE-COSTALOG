using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace Costalog.Agent.Service;

// Os sites bloqueados apontam (no arquivo hosts) para 127.0.0.1. Este ouvinte local
// recebe essas conexões: registra a TENTATIVA de acesso (site e horário), mostra uma
// página "Site bloqueado" em HTTP e encerra a conexão em HTTPS.
// Se as portas 80/443 já estiverem em uso no computador, o bloqueio continua pelo
// hosts com 0.0.0.0 (sem registro de tentativas).
public static class BlockedSiteListener
{
    static readonly ConcurrentQueue<(string Host, DateTime TimeUtc)> Attempts = new();
    static volatile string[] _blocked = [];
    static TcpListener? _https;
    static TcpListener? _http;
    static readonly object Gate = new();

    public static bool HttpsActive => _https is not null;

    public static void SetBlocked(string[] hosts) => _blocked = hosts;

    public static bool TryDequeue(out (string Host, DateTime TimeUtc) attempt) => Attempts.TryDequeue(out attempt);

    public static void EnsureStarted()
    {
        lock (Gate)
        {
            _https ??= Start(443, isHttps: true);
            _http ??= Start(80, isHttps: false);
        }
    }

    static TcpListener? Start(int port, bool isHttps)
    {
        try
        {
            var listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
            _ = Task.Run(() => AcceptLoop(listener, isHttps));
            return listener;
        }
        catch
        {
            return null;
        }
    }

    static async Task AcceptLoop(TcpListener listener, bool isHttps)
    {
        while (true)
        {
            TcpClient client;

            try
            {
                client = await listener.AcceptTcpClientAsync();
            }
            catch
            {
                await Task.Delay(1000);
                continue;
            }

            _ = Task.Run(() => Handle(client, isHttps));
        }
    }

    static async Task Handle(TcpClient client, bool isHttps)
    {
        using (client)
        {
            try
            {
                client.ReceiveTimeout = 3000;
                client.SendTimeout = 3000;
                var stream = client.GetStream();
                var buffer = new byte[8192];

                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                var read = await stream.ReadAsync(buffer, timeout.Token);

                if (read <= 0)
                    return;

                var host = isHttps ? ReadSni(buffer, read) : ReadHostHeader(buffer, read);

                if (!string.IsNullOrEmpty(host) && IsBlocked(host))
                    Attempts.Enqueue((host.ToLowerInvariant(), DateTime.UtcNow));

                if (!isHttps)
                {
                    var html = Encoding.UTF8.GetBytes(BlockPage(host ?? ""));
                    var header = Encoding.ASCII.GetBytes(
                        "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html; charset=utf-8\r\n" +
                        "Cache-Control: no-store\r\nConnection: close\r\nContent-Length: " + html.Length + "\r\n\r\n");
                    await stream.WriteAsync(header);
                    await stream.WriteAsync(html);
                }
            }
            catch
            {
            }
        }
    }

    static bool IsBlocked(string host)
    {
        host = host.Trim().TrimEnd('.').ToLowerInvariant();

        foreach (var blocked in _blocked)
        {
            if (host == blocked || host.EndsWith("." + blocked, StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    static string? ReadHostHeader(byte[] data, int length)
    {
        var text = Encoding.ASCII.GetString(data, 0, length);

        foreach (var line in text.Split("\r\n"))
        {
            if (!line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase))
                continue;

            var value = line[5..].Trim();
            var colon = value.LastIndexOf(':');

            if (colon > 0 && !value.Contains(']'))
                value = value[..colon];

            return value;
        }

        return null;
    }

    // Lê o nome do site (SNI) do primeiro pacote TLS (ClientHello).
    static string? ReadSni(byte[] d, int length)
    {
        try
        {
            if (length < 43 || d[0] != 0x16 || d[5] != 0x01)
                return null;

            var p = 43;
            p += 1 + d[p];                                   // session id
            if (p + 2 > length) return null;
            p += 2 + ((d[p] << 8) | d[p + 1]);               // cipher suites
            if (p + 1 > length) return null;
            p += 1 + d[p];                                   // compression methods
            if (p + 2 > length) return null;

            var end = p + 2 + ((d[p] << 8) | d[p + 1]);      // extensions
            p += 2;

            while (p + 4 <= Math.Min(end, length))
            {
                var type = (d[p] << 8) | d[p + 1];
                var size = (d[p + 2] << 8) | d[p + 3];
                p += 4;

                if (type == 0 && p + 5 <= length)
                {
                    var nameLength = (d[p + 3] << 8) | d[p + 4];

                    if (d[p + 2] == 0 && p + 5 + nameLength <= length)
                        return Encoding.ASCII.GetString(d, p + 5, nameLength);

                    return null;
                }

                p += size;
            }
        }
        catch
        {
        }

        return null;
    }

    static string BlockPage(string host)
    {
        var safe = WebUtility.HtmlEncode(host);

        return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Site bloqueado</title>" +
               "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
               "<body style=\"margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f4f4f6;color:#1d1d1f\">" +
               "<div style=\"max-width:560px;margin:12vh auto;background:#fff;border-radius:14px;padding:36px;box-shadow:0 10px 30px #0001\">" +
               "<div style=\"width:46px;height:46px;border-radius:12px;background:#e30613;color:#fff;font:700 24px Arial;display:grid;place-items:center\">C</div>" +
               "<h1 style=\"font-size:24px;margin:22px 0 8px\">Site bloqueado</h1>" +
               "<p style=\"color:#555;line-height:1.6\">O acesso a <b>" + safe + "</b> foi bloqueado pela TI da Costalog conforme a política de uso dos computadores da empresa.</p>" +
               "<p style=\"color:#888;font-size:13px\">Se você precisa deste site para o trabalho, fale com a equipe de TI.</p>" +
               "</div></body></html>";
    }
}
