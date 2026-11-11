using System.Security.Cryptography;
using System.Text.Json;
namespace Costalog.Agent.Service;
public static class PolicyVerifier{
 public static JsonDocument VerifyEnvelope(PolicyEnvelope e,string pem){
  if(string.IsNullOrWhiteSpace(e.SignedPayload)||string.IsNullOrWhiteSpace(e.Signature))throw new CryptographicException("Envelope sem assinatura.");
  var bytes=Convert.FromBase64String(e.SignedPayload);var signature=Convert.FromBase64String(e.Signature);
  using var rsa=RSA.Create();rsa.ImportFromPem(pem);
  if(!rsa.VerifyData(bytes,signature,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1))throw new CryptographicException("Assinatura RSA inválida.");
  return JsonDocument.Parse(bytes);
 }
 public static DateTimeOffset ReadExpiry(JsonElement p){if(!p.TryGetProperty("expiresAt",out var x)||!DateTimeOffset.TryParse(x.GetString(),out var dt))throw new InvalidDataException("Validade ausente ou inválida.");return dt;}
 public static JsonDocument VerifyApproval(JsonElement signed,string pem){
  if(!signed.TryGetProperty("signedPayload",out var sp)||!signed.TryGetProperty("signature",out var sig))throw new CryptographicException("Autorização sem assinatura.");
  var data=Convert.FromBase64String(sp.GetString()??"");var signature=Convert.FromBase64String(sig.GetString()??"");
  using var rsa=RSA.Create();rsa.ImportFromPem(pem);
  if(!rsa.VerifyData(data,signature,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1))throw new CryptographicException("Assinatura da autorização inválida.");
  return JsonDocument.Parse(data);
 }
}
public sealed class PolicyEnvelope{public int Revision{get;set;}public string Status{get;set;}="";public string KeyId{get;set;}="";public string SignedPayload{get;set;}="";public string Signature{get;set;}="";}
