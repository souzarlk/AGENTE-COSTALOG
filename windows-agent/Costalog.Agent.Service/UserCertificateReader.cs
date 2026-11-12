using System.Security.Cryptography.X509Certificates;
using System.Security.Principal;
using Microsoft.Win32;

namespace Costalog.Agent.Service;

public sealed record UserCertificate(X509Certificate2 Certificate, bool HasPrivateKey, string Owner);

// Lê o repositório "Pessoal" (My) de cada usuário do computador: a parte no registro
// (HKEY_USERS) e a parte em arquivos no perfil (AppData\Roaming\Microsoft\SystemCertificates).
// Somente o certificado público é lido; a chave privada nunca é acessada nem exportada.
public static class UserCertificateReader
{
    const int CertKeyProvInfoPropId = 2;
    const int CertCertPropId = 32;

    public static List<UserCertificate> Read()
    {
        var list = new List<UserCertificate>();
        var profiles = ReadProfiles();

        foreach (var (sid, profilePath) in profiles)
        {
            var owner = OwnerName(sid, profilePath);

            // 1) Parte do repositório guardada no registro (usuário com sessão aberta).
            try
            {
                using var certificates = Registry.Users.OpenSubKey(
                    sid + @"\Software\Microsoft\SystemCertificates\My\Certificates");

                if (certificates is not null)
                {
                    foreach (var name in certificates.GetSubKeyNames())
                    {
                        try
                        {
                            using var key = certificates.OpenSubKey(name);

                            if (key?.GetValue("Blob") is byte[] blob)
                                AddFromBlob(list, blob, owner);
                        }
                        catch
                        {
                        }
                    }
                }
            }
            catch
            {
            }

            // 2) Parte guardada em arquivos no perfil (AppData\Roaming), onde ficam
            //    a maioria dos certificados A1 importados. Funciona mesmo sem sessão aberta.
            if (string.IsNullOrEmpty(profilePath))
                continue;

            try
            {
                var folder = Path.Combine(
                    profilePath, "AppData", "Roaming", "Microsoft", "SystemCertificates", "My", "Certificates");

                if (!Directory.Exists(folder))
                    continue;

                foreach (var file in Directory.GetFiles(folder))
                {
                    try
                    {
                        AddFromBlob(list, File.ReadAllBytes(file), owner);
                    }
                    catch
                    {
                    }
                }
            }
            catch
            {
            }
        }

        return list;
    }

    internal static string OwnerName(string sid, string profilePath)
    {
        try
        {
            return new SecurityIdentifier(sid).Translate(typeof(NTAccount)).Value;
        }
        catch
        {
            return string.IsNullOrEmpty(profilePath) ? sid : Path.GetFileName(profilePath.TrimEnd('\\'));
        }
    }

    static void AddFromBlob(List<UserCertificate> list, byte[] blob, string owner)
    {
        var (der, hasKey) = ParseBlob(blob);

        if (der is not null)
            list.Add(new UserCertificate(new X509Certificate2(der), hasKey, owner));
    }

    // Perfis de usuário do computador: os com sessão aberta (HKEY_USERS) e todos os
    // cadastrados no Windows (ProfileList), com a pasta de cada perfil.
    internal static List<(string Sid, string ProfilePath)> ReadProfiles()
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            using var profileList = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList");

            if (profileList is not null)
            {
                foreach (var sid in profileList.GetSubKeyNames())
                {
                    if (!sid.StartsWith("S-1-5-21-", StringComparison.OrdinalIgnoreCase))
                        continue;

                    using var key = profileList.OpenSubKey(sid);
                    var path = key?.GetValue("ProfileImagePath") as string ?? "";
                    result[sid] = Environment.ExpandEnvironmentVariables(path);
                }
            }
        }
        catch
        {
        }

        try
        {
            foreach (var sid in Registry.Users.GetSubKeyNames())
            {
                if (sid.StartsWith("S-1-5-21-", StringComparison.OrdinalIgnoreCase) &&
                    !sid.EndsWith("_Classes", StringComparison.OrdinalIgnoreCase) &&
                    !result.ContainsKey(sid))
                    result[sid] = "";
            }
        }
        catch
        {
        }

        return result.Select(x => (x.Key, x.Value)).ToList();
    }

    // Formato serializado do Windows: [id (4 bytes)][reservado (4)][tamanho (4)][dados]...
    static (byte[]? Der, bool HasKey) ParseBlob(byte[] blob)
    {
        byte[]? der = null;
        var hasKey = false;
        var offset = 0;

        while (offset + 12 <= blob.Length)
        {
            var id = BitConverter.ToInt32(blob, offset);
            var length = BitConverter.ToInt32(blob, offset + 8);
            var start = offset + 12;

            if (length < 0 || start + length > blob.Length)
                break;

            if (id == CertCertPropId)
                der = blob.AsSpan(start, length).ToArray();
            else if (id == CertKeyProvInfoPropId)
                hasKey = true;

            offset = start + length;
        }

        return (der, hasKey);
    }
}
