using System.Diagnostics;
using System.Security.AccessControl;
using System.Security.Principal;
using Microsoft.Win32;

namespace Costalog.Agent.Service;

// Proteção do agente contra parada, alteração e remoção por usuários do computador,
// inclusive administradores locais (sem a senha de desinstalação ou a ordem do painel):
//  - serviço: administradores podem só consultar e iniciar (não podem parar, alterar ou excluir);
//  - registro do serviço: somente leitura para administradores;
//  - pastas do agente: dono SYSTEM, administradores só leitura, configuração privada só SYSTEM;
//  - pasta Requests: onde o DESINSTALAR.cmd deixa o pedido com a senha.
public static class AgentProtection
{
    const string ServiceName = "CostalogAgent";

    const string ServiceSddl =
        "D:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;SY)" +
        "(A;;CCLCSWRPLOCRRC;;;BA)" +
        "(A;;CCLCSWLOCRRC;;;IU)" +
        "(A;;CCLCSWLOCRRC;;;SU)";

    const string System = "*S-1-5-18";
    const string Admins = "*S-1-5-32-544";
    const string Users = "*S-1-5-32-545";

    public static string RequestsRoot => Path.Combine(AgentConfigStore.Root, "Requests");

    public static List<string> Apply()
    {
        var errors = new List<string>();

        Try(errors, "serviço", () => Run("sc.exe", "sdset", ServiceName, ServiceSddl));
        Try(errors, "registro", ProtectServiceRegistry);

        var programRoot = Path.GetDirectoryName(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar));

        if (!string.IsNullOrEmpty(programRoot) && Directory.Exists(programRoot))
        {
            Try(errors, "pasta do programa", () => ProtectFolder(
                programRoot,
                System + ":(OI)(CI)F", Admins + ":(OI)(CI)RX", Users + ":(OI)(CI)RX"));
        }

        Try(errors, "pasta de dados", () =>
        {
            Directory.CreateDirectory(AgentConfigStore.Root);
            Directory.CreateDirectory(AgentConfigStore.PrivateRoot);
            Directory.CreateDirectory(AgentConfigStore.PublicRoot);
            Directory.CreateDirectory(RequestsRoot);

            ProtectFolder(AgentConfigStore.Root, System + ":(OI)(CI)F", Admins + ":(OI)(CI)RX");
            SetAcl(AgentConfigStore.PrivateRoot, System + ":(OI)(CI)F");
            SetAcl(AgentConfigStore.PublicRoot, System + ":(OI)(CI)F", Admins + ":(OI)(CI)RX", Users + ":(OI)(CI)RX");
            SetAcl(RequestsRoot, System + ":(OI)(CI)F", Admins + ":(OI)(CI)M");
        });

        return errors;
    }

    static void ProtectFolder(string folder, params string[] grants)
    {
        Run("icacls.exe", folder, "/setowner", System, "/T", "/C", "/Q");
        SetAcl(folder, grants);
        Run("icacls.exe", Path.Combine(folder, "*"), "/reset", "/T", "/C", "/Q");
    }

    static void SetAcl(string folder, params string[] grants)
    {
        var args = new List<string> { folder, "/inheritance:r", "/grant:r" };
        args.AddRange(grants);
        args.Add("/C");
        args.Add("/Q");
        Run("icacls.exe", args.ToArray());
    }

    static void ProtectServiceRegistry()
    {
        using var key = Registry.LocalMachine.OpenSubKey(
            @"SYSTEM\CurrentControlSet\Services\" + ServiceName,
            RegistryKeyPermissionCheck.ReadWriteSubTree,
            RegistryRights.ChangePermissions | RegistryRights.ReadKey | RegistryRights.TakeOwnership);

        if (key is null)
            return;

        var system = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
        var admins = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);
        var users = new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null);

        var security = new RegistrySecurity();
        security.SetOwner(system);
        security.SetAccessRuleProtection(true, false);
        security.AddAccessRule(new RegistryAccessRule(system, RegistryRights.FullControl,
            InheritanceFlags.ContainerInherit, PropagationFlags.None, AccessControlType.Allow));
        security.AddAccessRule(new RegistryAccessRule(admins, RegistryRights.ReadKey,
            InheritanceFlags.ContainerInherit, PropagationFlags.None, AccessControlType.Allow));
        security.AddAccessRule(new RegistryAccessRule(users, RegistryRights.ReadKey,
            InheritanceFlags.ContainerInherit, PropagationFlags.None, AccessControlType.Allow));

        key.SetAccessControl(security);
    }

    static void Try(List<string> errors, string label, Action action)
    {
        try
        {
            action();
        }
        catch (Exception e)
        {
            errors.Add(label + ": " + e.Message);
        }
    }

    static void Run(string file, params string[] args)
    {
        var start = new ProcessStartInfo
        {
            FileName = file,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        foreach (var arg in args)
            start.ArgumentList.Add(arg);

        using var process = Process.Start(start) ?? throw new InvalidOperationException("Não foi possível iniciar " + file);
        process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();

        if (!process.WaitForExit(120000))
            throw new TimeoutException(file + " não respondeu.");

        if (process.ExitCode != 0)
            throw new InvalidOperationException(file + " retornou " + process.ExitCode + ": " + error.Trim());
    }
}
