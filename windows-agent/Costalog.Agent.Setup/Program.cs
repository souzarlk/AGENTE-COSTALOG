
using System.Diagnostics;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

const string ServiceName = "CostalogAgent";
const string DisplayName = "Costalog Agent";

Console.WriteLine("==============================================");
Console.WriteLine("       INSTALADOR — AGENTE COSTALOG");
Console.WriteLine("==============================================");
Console.WriteLine("Instalação corporativa em segundo plano.");
Console.WriteLine();

if (!OperatingSystem.IsWindows())
{
    Console.Error.WriteLine("Este instalador funciona somente no Windows.");
    return 2;
}

using (var identity = WindowsIdentity.GetCurrent())
{
    var principal = new WindowsPrincipal(identity);
    if (!principal.IsInRole(WindowsBuiltInRole.Administrator))
    {
        Console.Error.WriteLine("Execute o instalador como administrador.");
        return 2;
    }
}

var bootstrapPath = Path.Combine(AppContext.BaseDirectory, "agent-bootstrap.json");
var keyPath = Path.Combine(AppContext.BaseDirectory, "policy-public.pem");
var serviceSource = Path.Combine(AppContext.BaseDirectory, "service");

if (!File.Exists(bootstrapPath))
{
    Console.Error.WriteLine("Arquivo agent-bootstrap.json ausente. Solicite à TI o pacote correto.");
    return 2;
}

if (!File.Exists(keyPath) || !Directory.Exists(serviceSource))
{
    Console.Error.WriteLine("Pacote incompleto: chave pública ou arquivos do serviço ausentes.");
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
    version = root.TryGetProperty("agentVersion", out var v)
        ? v.GetString() ?? "0.1.0"
        : "0.1.0";
}
catch (Exception ex)
{
    Console.Error.WriteLine("Configuração do pacote inválida: " + ex.Message);
    return 2;
}

if (!Uri.TryCreate(api, UriKind.Absolute, out var uri) ||
    (uri.Scheme != Uri.UriSchemeHttps &&
     !(uri.IsLoopback && uri.Scheme == Uri.UriSchemeHttp)))
{
    Console.Error.WriteLine("A API precisa possuir um endereço HTTPS válido.");
    return 2;
}

if (mode is not ("certificate" or "certificate-and-web"))
{
    Console.Error.WriteLine("Modo de proteção não reconhecido.");
    return 2;
}

if (version.Length > 40 || string.IsNullOrWhiteSpace(version))
{
    Console.Error.WriteLine("Versão do agente inválida.");
    return 2;
}

var pem = await File.ReadAllTextAsync(keyPath);

try
{
    using var rsa = RSA.Create();
    rsa.ImportFromPem(pem);

    if (rsa.KeySize < 3072)
        throw new CryptographicException("A chave RSA precisa possuir pelo menos 3072 bits.");
}
catch (Exception ex)
{
    Console.Error.WriteLine("Chave pública inválida: " + ex.Message);
    return 2;
}

var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
var installRoot = Path.Combine(programFiles, "Costalog", "Agent");
var serviceTarget = Path.Combine(installRoot, "Service");
var serviceExe = Path.Combine(serviceTarget, "Costalog.Agent.Service.exe");

var dataRoot = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
    "Costalog",
    "Agent");

var privateRoot = Path.Combine(dataRoot, "Private");
var publicRoot = Path.Combine(dataRoot, "Public");
var configPath = Path.Combine(privateRoot, "agent.json");

if (File.Exists(configPath))
{
    Console.Error.WriteLine("O agente já possui uma configuração neste computador.");
    Console.Error.WriteLine("A reinstalação precisa ser feita por um procedimento de atualização autorizado.");
    return 2;
}

var existingService = await RunCommand(
    "sc.exe",
    ["query", ServiceName],
    allowFailure: true);

if (existingService.ExitCode == 0)
{
    Console.Error.WriteLine("O serviço CostalogAgent já está registrado.");
    Console.Error.WriteLine("Não será feita nenhuma alteração automática na instalação existente.");
    return 2;
}

if (Directory.Exists(installRoot))
{
    Console.Error.WriteLine("A pasta de instalação já existe. Verifique-a antes de continuar.");
    return 2;
}

Console.WriteLine("API: " + uri.Host);
Console.WriteLine("Modo de instalação: " + mode);
Console.WriteLine("Versão: " + version);
Console.WriteLine();
Console.Write("Senha temporária de instalação definida no painel da TI: ");

var enrollment = ReadSecret().Trim();

if (enrollment.Length < 8 || enrollment.Length > 128 ||
    !enrollment.Any(char.IsLetter) ||
    !enrollment.Any(char.IsDigit))
{
    Console.Error.WriteLine("Senha inválida. Ela precisa ter entre 8 e 128 caracteres, com letras e números.");
    return 2;
}

try
{
    Directory.CreateDirectory(privateRoot);
    Directory.CreateDirectory(publicRoot);
    Directory.CreateDirectory(serviceTarget);

    var serviceFiles = Directory.GetFiles(serviceSource, "*", SearchOption.AllDirectories);

    if (serviceFiles.Length == 0)
        throw new InvalidOperationException("Nenhum arquivo do serviço foi encontrado.");

    foreach (var sourceFile in serviceFiles)
    {
        var relativePath = Path.GetRelativePath(serviceSource, sourceFile);
        var destinationFile = Path.Combine(serviceTarget, relativePath);

        Directory.CreateDirectory(Path.GetDirectoryName(destinationFile)!);
        File.Copy(sourceFile, destinationFile, false);
    }

    if (!File.Exists(serviceExe))
        throw new FileNotFoundException("Executável do serviço não encontrado após a cópia.");

    var cfg = new
    {
        apiBaseUrl = api,
        installMode = mode,
        enrollmentTokenProtected = Convert.ToBase64String(
            ProtectedData.Protect(
                Encoding.UTF8.GetBytes(enrollment),
                null,
                DataProtectionScope.LocalMachine)),
        deviceTokenProtected = (string?)null,
        deviceId = (string?)null,
        lastPolicyRevision = 0,
        policyPublicKeyPem = pem,
        agentVersion = version
    };

    var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    var temp = configPath + ".tmp";

    await File.WriteAllTextAsync(
        temp,
        JsonSerializer.Serialize(cfg, options),
        new UTF8Encoding(false));

    File.Move(temp, configPath, false);

    var state = new
    {
        status = "awaiting-enrollment",
        installMode = mode,
        revision = 0,
        expiresAt = "",
        allowedDestinations = Array.Empty<string>(),
        updatedAt = DateTimeOffset.UtcNow.ToString("O")
    };

    var statePath = Path.Combine(publicRoot, "agent-public-state.json");

    await File.WriteAllTextAsync(
        statePath,
        JsonSerializer.Serialize(state, options),
        new UTF8Encoding(false));

    Console.WriteLine();
    Console.WriteLine("Aplicando permissões de segurança...");

    await SetAcl(
        installRoot,
        "SYSTEM:(OI)(CI)F",
        "Administrators:(OI)(CI)F",
        "Users:(OI)(CI)RX");

    await SetAcl(
        privateRoot,
        "SYSTEM:(OI)(CI)F",
        "Administrators:(OI)(CI)F");

    await SetAcl(
        publicRoot,
        "SYSTEM:(OI)(CI)F",
        "Administrators:(OI)(CI)F",
        "Users:(OI)(CI)RX");

    Console.WriteLine("Registrando serviço do Windows...");

    await RunCommand("sc.exe",
    [
        "create",
        ServiceName,
        "binPath=",
        $"\"{serviceExe}\"",
        "start=",
        "delayed-auto",
        "obj=",
        "LocalSystem",
        "DisplayName=",
        DisplayName
    ]);

    await RunCommand(
        "sc.exe",
        ["description", ServiceName, "Agente corporativo de segurança e gerenciamento da Costalog."]);

    await RunCommand(
        "sc.exe",
        [
            "failure",
            ServiceName,
            "reset=",
            "86400",
            "actions=",
            "restart/5000/restart/15000/restart/60000"
        ]);

    Console.WriteLine("Iniciando serviço...");

    await RunCommand("sc.exe", ["start", ServiceName]);

    Console.WriteLine();
    Console.WriteLine("==============================================");
    Console.WriteLine("       INSTALAÇÃO CONCLUÍDA");
    Console.WriteLine("==============================================");
    Console.WriteLine("Serviço: CostalogAgent");
    Console.WriteLine("Inicialização: automática e atrasada");
    Console.WriteLine("Execução: segundo plano como LocalSystem");
    Console.WriteLine("Configuração: protegida por DPAPI e permissões NTFS");
    Console.WriteLine();
    Console.WriteLine("O cadastro será realizado quando o serviço conseguir acessar a API.");
    Console.WriteLine("Nenhum bloqueio de sites foi ativado por este instalador.");

    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine();
    Console.Error.WriteLine("ERRO DURANTE A INSTALAÇÃO:");
    Console.Error.WriteLine(ex.Message);
    Console.Error.WriteLine("A instalação pode ter ficado incompleta. Não execute novamente sem verificar o estado do serviço.");
    return 1;
}

static async Task SetAcl(string path, params string[] grants)
{
    var args = new List<string>
    {
        path,
        "/inheritance:r",
        "/grant:r"
    };

    args.AddRange(grants);

    await RunCommand("icacls.exe", args);
}

static async Task<(int ExitCode, string Output)> RunCommand(
    string fileName,
    IEnumerable<string> arguments,
    bool allowFailure = false)
{
    var start = new ProcessStartInfo
    {
        FileName = fileName,
        UseShellExecute = false,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        CreateNoWindow = true
    };

    foreach (var argument in arguments)
        start.ArgumentList.Add(argument);

    using var process = Process.Start(start)
        ?? throw new InvalidOperationException($"Não foi possível iniciar {fileName}.");

    var stdout = process.StandardOutput.ReadToEndAsync();
    var stderr = process.StandardError.ReadToEndAsync();

    await process.WaitForExitAsync();

    var output = (await stdout) + (await stderr);

    if (process.ExitCode != 0 && !allowFailure)
        throw new InvalidOperationException(
            $"{fileName} retornou código {process.ExitCode}: {output}");

    return (process.ExitCode, output);
}

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
