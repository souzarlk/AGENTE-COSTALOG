using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace Costalog.Agent.Service;

// Aplica no computador o bloqueio de pendrive (USB) e o papel de parede padrão,
// conforme a política assinada. Aplicado para todos os usuários do computador.
public static class DeviceControls
{
    const string UsbStorKey = @"SYSTEM\CurrentControlSet\Services\USBSTOR";

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool SystemParametersInfo(uint action, uint param, string value, uint winIni);

    const uint SPI_SETDESKWALLPAPER = 0x0014;
    const uint SPIF_UPDATEINIFILE = 0x01;
    const uint SPIF_SENDWININICHANGE = 0x02;

    // Bloqueio de pendrive/HD externo. Mantém teclado, mouse, impressora e token
    // de certificado (A3) funcionando — mexe só no driver de armazenamento USB (USBSTOR).
    // Retorna true se algo mudou.
    public static bool ApplyUsbStorage(bool block)
    {
        using var key = Registry.LocalMachine.OpenSubKey(UsbStorKey, writable: true);
        if (key is null) return false;

        // Start = 3 (normal) libera; Start = 4 bloqueia o driver de armazenamento USB.
        var desired = block ? 4 : 3;
        var current = key.GetValue("Start") is int v ? v : 3;
        if (current == desired) return false;

        key.SetValue("Start", desired, RegistryValueKind.DWord);
        return true;
    }

    static bool _wallpaperApplied;

    // Define a imagem como papel de parede de todos os usuários e impede a troca.
    public static bool ApplyWallpaper(string imagePath)
    {
        if (!File.Exists(imagePath)) return false;

        var changed = false;

        // Impede o usuário de trocar o papel de parede (política do Windows).
        foreach (var root in EachUserPolicyRoot())
        {
            changed |= SetDword(root, "ActiveDesktop", "NoChangingWallPaper", 1);
            changed |= SetString(root, "System", "Wallpaper", imagePath);
            changed |= SetString(root, "System", "WallpaperStyle", "10"); // preencher
        }

        // Aplica imediatamente para a sessão atual do serviço (quando houver).
        try
        {
            SystemParametersInfo(SPI_SETDESKWALLPAPER, 0, imagePath, SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE);
        }
        catch
        {
        }

        // Aplica para cada usuário com perfil carregado.
        foreach (var sid in LoadedUserSids())
        {
            changed |= SetStringAt($@"{sid}\Control Panel\Desktop", "Wallpaper", imagePath);
            changed |= SetStringAt($@"{sid}\Control Panel\Desktop", "WallpaperStyle", "10");
        }

        _wallpaperApplied = true;
        return changed || !_wallpaperApplied;
    }

    // Devolve o controle do papel de parede ao usuário.
    public static void ReleaseWallpaper()
    {
        if (!_wallpaperApplied && !HasWallpaperPolicy()) return;

        foreach (var root in EachUserPolicyRoot())
        {
            TryDeleteValue(root, "ActiveDesktop", "NoChangingWallPaper");
            TryDeleteValue(root, "System", "Wallpaper");
            TryDeleteValue(root, "System", "WallpaperStyle");
        }

        _wallpaperApplied = false;
    }

    // ===== Helpers de registro =====

    static IEnumerable<RegistryKey> EachUserPolicyRoot()
    {
        // Política de máquina (todos os usuários).
        var machine = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Policies\Microsoft\Windows", writable: true);
        if (machine is not null) yield return machine;
    }

    static bool HasWallpaperPolicy()
    {
        using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows\System");
        return k?.GetValue("Wallpaper") is not null;
    }

    static bool SetDword(RegistryKey root, string subKey, string name, int value)
    {
        using var k = root.CreateSubKey(subKey, writable: true);
        if (k is null) return false;
        if (k.GetValue(name) is int v && v == value) return false;
        k.SetValue(name, value, RegistryValueKind.DWord);
        return true;
    }

    static bool SetString(RegistryKey root, string subKey, string name, string value)
    {
        using var k = root.CreateSubKey(subKey, writable: true);
        if (k is null) return false;
        if (k.GetValue(name) as string == value) return false;
        k.SetValue(name, value, RegistryValueKind.String);
        return true;
    }

    static bool SetStringAt(string path, string name, string value)
    {
        try
        {
            using var k = Registry.Users.CreateSubKey(path, writable: true);
            if (k is null) return false;
            if (k.GetValue(name) as string == value) return false;
            k.SetValue(name, value, RegistryValueKind.String);
            return true;
        }
        catch
        {
            return false;
        }
    }

    static void TryDeleteValue(RegistryKey root, string subKey, string name)
    {
        try
        {
            using var k = root.OpenSubKey(subKey, writable: true);
            k?.DeleteValue(name, false);
        }
        catch
        {
        }
    }

    static IEnumerable<string> LoadedUserSids()
    {
        string[] names;
        try { names = Registry.Users.GetSubKeyNames(); }
        catch { yield break; }

        foreach (var sid in names)
        {
            if (sid.StartsWith("S-1-5-21-", StringComparison.OrdinalIgnoreCase) &&
                !sid.EndsWith("_Classes", StringComparison.OrdinalIgnoreCase))
                yield return sid;
        }
    }
}
