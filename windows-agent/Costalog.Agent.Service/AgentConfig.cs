using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
namespace Costalog.Agent.Service;
public sealed class AgentConfig{
 public string ApiBaseUrl{get;set;}="";
 public string InstallMode{get;set;}="certificate";
 public string? EnrollmentTokenProtected{get;set;}
 public string? DeviceTokenProtected{get;set;}
 public string? DeviceId{get;set;}
 public int LastPolicyRevision{get;set;}
 public string PolicyPublicKeyPem{get;set;}="";
 public string AgentVersion{get;set;}="0.1.0";
}
public static class AgentConfigStore{
 public static string Root=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"Costalog","Agent");
 public static string PrivateRoot=>Path.Combine(Root,"Private");
 public static string PublicRoot=>Path.Combine(Root,"Public");
 public static string PendingEventsRoot=>Path.Combine(Root,"pending-events");
 public static string ConfigPath=>Path.Combine(PrivateRoot,"agent.json");
 public static string PublicStatePath=>Path.Combine(PublicRoot,"agent-public-state.json");
 public static string PolicyPath=>Path.Combine(PrivateRoot,"policy.json");
 static readonly JsonSerializerOptions Options=new(JsonSerializerDefaults.Web){WriteIndented=true};
 public static AgentConfig Load(){if(!File.Exists(ConfigPath))throw new FileNotFoundException("Configuração do AGENTE COSTALOG não encontrada.",ConfigPath);return JsonSerializer.Deserialize<AgentConfig>(File.ReadAllText(ConfigPath,Encoding.UTF8),Options)??throw new InvalidDataException("Configuração inválida.");}
 public static void Save(AgentConfig c){Directory.CreateDirectory(PrivateRoot);var t=ConfigPath+".tmp";File.WriteAllText(t,JsonSerializer.Serialize(c,Options),new UTF8Encoding(false));File.Move(t,ConfigPath,true);}
 public static string Protect(string s)=>Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(s),null,DataProtectionScope.LocalMachine));
 public static string Unprotect(string s)=>Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(s),null,DataProtectionScope.LocalMachine));
 public static void WritePublicState(AgentPublicState s){Directory.CreateDirectory(PublicRoot);var t=PublicStatePath+".tmp";File.WriteAllText(t,JsonSerializer.Serialize(s,Options),new UTF8Encoding(false));File.Move(t,PublicStatePath,true);}
}
public sealed class AgentPublicState{
 public string Status{get;set;}="awaiting-enrollment";
 public string? DeviceId{get;set;}
 public string InstallMode{get;set;}="certificate";
 public int Revision{get;set;}
 public string ExpiresAt{get;set;}="";
 public string[] AllowedDestinations{get;set;}=[];
 public string UpdatedAt{get;set;}=DateTimeOffset.UtcNow.ToString("O");
}
