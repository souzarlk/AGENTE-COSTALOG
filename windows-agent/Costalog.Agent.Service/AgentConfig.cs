
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Costalog.Agent.Service;

public sealed class AgentConfig
{
    public string ApiBaseUrl { get; set; } = "";
    public string InstallMode { get; set; } = "certificate";
    public string? EnrollmentTokenProtected { get; set; }
    public string? DeviceTokenProtected { get; set; }
    public string? DeviceId { get; set; }
    public int LastPolicyRevision { get; set; }
    public string PolicyPublicKeyPem { get; set; } = "";
    public string AgentVersion { get; set; } = "0.1.0";
}

public static class AgentConfigStore
{
    public static string Root =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "Costalog",
            "Agent"
        );

    public static string PrivateRoot => Path.Combine(Root, "Private");
    public static string PublicRoot => Path.Combine(Root, "Public");
    public static string PendingEventsRoot => Path.Combine(Root, "pending-events");
    public static string ConfigPath => Path.Combine(PrivateRoot, "agent.json");
    public static string PublicStatePath => Path.Combine(PublicRoot, "agent-public-state.json");
    public static string PolicyPath => Path.Combine(PrivateRoot, "policy.json");

    private static readonly JsonSerializerOptions Options =
        new(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        };

    public static AgentConfig Load()
    {
        if (!File.Exists(ConfigPath))
        {
            throw new FileNotFoundException(
                "Configuração do AGENTE COSTALOG não encontrada.",
                ConfigPath
            );
        }

        return JsonSerializer.Deserialize<AgentConfig>(
            File.ReadAllText(ConfigPath, Encoding.UTF8),
            Options
        ) ?? throw new InvalidDataException("Configuração inválida.");
    }

    public static void Save(AgentConfig config)
    {
        Directory.CreateDirectory(PrivateRoot);

        var temporaryPath = ConfigPath + ".tmp";

        File.WriteAllText(
            temporaryPath,
            JsonSerializer.Serialize(config, Options),
            new UTF8Encoding(false)
        );

        File.Move(temporaryPath, ConfigPath, true);
    }

    public static string Protect(string value) =>
        Convert.ToBase64String(
            ProtectedData.Protect(
                Encoding.UTF8.GetBytes(value),
                null,
                DataProtectionScope.LocalMachine
            )
        );

    public static string Unprotect(string value) =>
        Encoding.UTF8.GetString(
            ProtectedData.Unprotect(
                Convert.FromBase64String(value),
                null,
                DataProtectionScope.LocalMachine
            )
        );

    public static void WritePublicState(AgentPublicState state)
    {
        Directory.CreateDirectory(PublicRoot);

        var temporaryPath = PublicStatePath + ".tmp";

        File.WriteAllText(
            temporaryPath,
            JsonSerializer.Serialize(state, Options),
            new UTF8Encoding(false)
        );

        File.Move(temporaryPath, PublicStatePath, true);
    }
}

public sealed class AgentPublicState
{
    public string Status { get; set; } = "awaiting-enrollment";
    public string? DeviceId { get; set; }
    public string InstallMode { get; set; } = "certificate";
    public int Revision { get; set; }
    public string ExpiresAt { get; set; } = "";

    // Compatibilidade com a estrutura anterior
    public string[] AllowedDestinations { get; set; } = [];

    // Política de navegação
    public string WebDefaultAction { get; set; } = "deny";
    public WebPolicyRule[] WebRules { get; set; } = [];

    // Política de utilização de certificados
    public string CertificateDefaultAction { get; set; } = "deny";
    public CertificatePolicyRule[] CertificateRules { get; set; } = [];

    public string UpdatedAt { get; set; } =
        DateTimeOffset.UtcNow.ToString("O");
}

public sealed class WebPolicyRule
{
    public string Name { get; set; } = "";
    public string Hostname { get; set; } = "";
    public string Action { get; set; } = "block";
    public string ScopeType { get; set; } = "all";
    public string ScopeValue { get; set; } = "";
}

public sealed class CertificatePolicyRule
{
    public string Name { get; set; } = "";
    public string Hostname { get; set; } = "";
    public string CertificateScope { get; set; } = "managed";
}
