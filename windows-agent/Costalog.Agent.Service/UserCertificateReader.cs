using System.Security.Cryptography.X509Certificates;
using System.Security.Principal;
using Microsoft.Win32;

namespace Costalog.Agent.Service;

public sealed record UserCertificate(X509Certificate2 Certificate, bool HasPrivateKey, string Owner);

// Lê o repositório "Pessoal" (My) de cada usuário com o perfil carregado
// (HKEY_USERS\<SID>\Software\Microsoft\SystemCertificates\My\Certificates).
// Somente o certificado público é lido; a chave privada nunca é acessada nem exportada.
public static class UserCertificateReader
{
    const int CertKeyProvInfoPropId = 2;
    const int CertCertPropId = 32;

    public static List<UserCertificate> Read()
    {
        var list = new List<UserCertificate>();

        string[] sids;

        try
        {
            sids = Registry.Users.GetSubKeyNames();
        }
        catch
        {
            return list;
        }

        foreach (var sid in sids)
        {
            if (!sid.StartsWith("S-1-5-21-", StringComparison.OrdinalIgnoreCase) ||
                sid.EndsWith("_Classes", StringComparison.OrdinalIgnoreCase))
                continue;

            var owner = sid;

            try
            {
                owner = new SecurityIdentifier(sid).Translate(typeof(NTAccount)).Value;
            }
            catch
            {
            }

            try
            {
                using var certificates = Registry.Users.OpenSubKey(
                    sid + @"\Software\Microsoft\SystemCertificates\My\Certificates");

                if (certificates is null)
                    continue;

                foreach (var name in certificates.GetSubKeyNames())
                {
                    try
                    {
                        using var key = certificates.OpenSubKey(name);

                        if (key?.GetValue("Blob") is not byte[] blob)
                            continue;

                        var (der, hasKey) = ParseBlob(blob);

                        if (der is null)
                            continue;

                        list.Add(new UserCertificate(new X509Certificate2(der), hasKey, owner));
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
