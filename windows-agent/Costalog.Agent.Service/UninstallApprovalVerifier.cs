using System.Security.Cryptography;
using System.Text.Json;
namespace Costalog.Agent.Service;
public static class UninstallApprovalVerifier{
 public static int Validate(string path){
  try{
   var config=AgentConfigStore.Load();
   using var signed=JsonDocument.Parse(File.ReadAllText(path));
   using var payload=PolicyVerifier.VerifyApproval(signed.RootElement,config.PolicyPublicKeyPem);
   var p=payload.RootElement;
   if(p.GetProperty("purpose").GetString()!="agent-uninstall")return 21;
   if(p.GetProperty("deviceId").GetString()!=config.DeviceId)return 22;
   if(!DateTimeOffset.TryParse(p.GetProperty("expiresAt").GetString(),out var exp)||exp<=DateTimeOffset.UtcNow)return 23;
   if(string.IsNullOrWhiteSpace(p.GetProperty("requestId").GetString()))return 24;
   return 0;
  }catch{return 20;}
 }
}
