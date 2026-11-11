using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

Console.WriteLine("==============================================");
Console.WriteLine("       INSTALADOR — AGENTE COSTALOG");
Console.WriteLine("==============================================");
Console.WriteLine("Instalação corporativa em segundo plano. Não será criado painel local.");
Console.WriteLine();

var bootstrapPath = Path.Combine(AppContext.BaseDirectory, "agent-bootstrap.json");
if (!File.Exists(bootstrapPath))
{
    Console.Error.WriteLine("Arquivo agent-bootstrap.json ausente. Solicite à TI o pacote correto.");
    return 2;
}

string api;
string mode;
string version;
try
{
    using var bootstrap = JsonDocument.Parse(await File.ReadAllTextAsync(bootstrapPath));
    var root = bootstrap.RootElement;
    api = root.GetProperty("apiBaseUrl").GetString()?.Trim().TrimEnd('/') ?? "";
    mode = root.GetProperty("installMode").GetString()?.Trim() ?? "";
    version = root.TryGetProperty("agentVersion", out var v) ? v.GetString() ?? "0.1.0" : "0.1.0";
}
catch (Exception ex)
{
    Console.Error.WriteLine("Configuração do pacote inválida: " + ex.Message);
    return 2;
}

if (!Uri.TryCreate(api, UriKind.Absolute, out var uri) ||
    (uri.Scheme != "https" && !(uri.IsLoopback && uri.Scheme == "http")))
{
    Console.Error.WriteLine("O pacote ainda não possui uma API HTTPS configurada. Solicite um pacote atualizado à TI.");
    return 2;
}
if (mode is not ("certificate" or "certificate-and-web"))
{
    Console.Error.WriteLine("Modo de proteção não reconhecido. Solicite um pacote atualizado à TI.");
    return 2;
}

Console.WriteLine("Modo atribuído pela TI: " + (mode == "certificate" ? "Certificados" : "Certificados + navegação"));
Console.Write("Senha temporária de instalação definida no painel da TI: ");
var enrollment = ReadSecret().Trim();
if (enrollment.Length < 20)
{
    Console.Error.WriteLine("A senha temporária deve possuir pelo menos 20 caracteres.");
    return 2;
}

var keyPath = Path.Combine(AppContext.BaseDirectory, "policy-public.pem");
if (!File.Exists(keyPath))
{
    Console.Error.WriteLine("A chave pública policy-public.pem não foi incluída no pacote.");
    return 2;
}

var pem = await File.ReadAllTextAsync(keyPath);
try
{
    using var rsa = RSA.Create();
    rsa.ImportFromPem(pem);
    if (rsa.KeySize < 3072) throw new CryptographicException("Chave RSA deve ter 3072 bits ou mais.");
}
catch (Exception ex)
{
    Console.Error.WriteLine("Chave pública inválida: " + ex.Message);
    return 2;
}

var rootPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Costalog", "Agent");
var privateRoot = Path.Combine(rootPath, "Private");
var publicRoot = Path.Combine(rootPath, "Public");
Directory.CreateDirectory(privateRoot);
Directory.CreateDirectory(publicRoot);

var cfg = new
{
    apiBaseUrl = api,
    installMode = mode,
    enrollmentTokenProtected = Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(enrollment), null, DataProtectionScope.LocalMachine)),
    deviceTokenProtected = (string?)null,
    deviceId = (string?)null,
    lastPolicyRevision = 0,
    policyPublicKeyPem = pem,
    agentVersion = version
};

var options = new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true };
var target = Path.Combine(privateRoot, "agent.json");
var temp = target + ".tmp";
await File.WriteAllTextAsync(temp, JsonSerializer.Serialize(cfg, options), new UTF8Encoding(false));
File.Move(temp, target, true);

var state = new
{
    status = "awaiting-enrollment",
    installMode = mode,
    revision = 0,
    expiresAt = "",
    allowedDestinations = Array.Empty<string>(),
    updatedAt = DateTimeOffset.UtcNow.ToString("O")
};
await File.WriteAllTextAsync(Path.Combine(publicRoot, "agent-public-state.json"), JsonSerializer.Serialize(state, options), new UTF8Encoding(false));

Console.WriteLine();
Console.WriteLine("Configuração protegida gravada em ProgramData\\Costalog\\Agent.");
Console.WriteLine("Senha de instalação protegida com DPAPI LocalMachine.");
Console.WriteLine("Senha de uso único: será consumida no primeiro cadastro.");
Console.WriteLine("O serviço será iniciado em segundo plano pelo instalador.");
return 0;

static string ReadSecret()
{
    var buffer = new StringBuilder();
    while (true)
    {
        var key = Console.ReadKey(true);
        if (key.Key == ConsoleKey.Enter)
        {
            Console.WriteLine();
            break;
        }
        if (key.Key == ConsoleKey.Backspace)
        {
            if (buffer.Length > 0)
            {
                buffer.Length--;
                Console.Write("\b \b");
            }
            continue;
        }
        if (!char.IsControl(key.KeyChar) && buffer.Length < 200)
        {
            buffer.Append(key.KeyChar);
            Console.Write("*");
        }
    }
    return buffer.ToString();
}
