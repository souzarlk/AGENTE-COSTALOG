using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
Console.WriteLine("==============================================");
Console.WriteLine("       INSTALADOR — AGENTE COSTALOG");
Console.WriteLine("==============================================");
Console.WriteLine("Cadastro corporativo de endpoint Windows.");
Console.WriteLine();
Console.Write("Endereço HTTPS da API: ");
var api=(Console.ReadLine()??"").Trim().TrimEnd('/');
if(!Uri.TryCreate(api,UriKind.Absolute,out var uri)||(uri.Scheme!="https"&&!(uri.IsLoopback&&uri.Scheme=="http"))){Console.Error.WriteLine("Use HTTPS (HTTP somente localhost em desenvolvimento).");return 2;}
Console.WriteLine("Modo de proteção:");
Console.WriteLine("  1 — Proteção do certificado (sem bloqueio de navegação)");
Console.WriteLine("  2 — Proteção do certificado + bloqueio de navegação");
Console.Write("Escolha 1 ou 2: ");var choice=(Console.ReadLine()??"").Trim();if(choice is not("1" or "2")){Console.Error.WriteLine("Opção inválida.");return 2;}
var mode=choice=="1"?"certificate":"certificate-and-web";
Console.Write("Código de instalação de uso único: ");var enrollment=ReadSecret();if(enrollment.Length<20){Console.Error.WriteLine("Código incompleto.");return 2;}
var keyPath=Path.Combine(AppContext.BaseDirectory,"policy-public.pem");
if(!File.Exists(keyPath)){Console.Error.WriteLine("A chave pública policy-public.pem não foi incluída no pacote.");return 2;}
var pem=await File.ReadAllTextAsync(keyPath);
try{using var rsa=RSA.Create();rsa.ImportFromPem(pem);if(rsa.KeySize<3072)throw new CryptographicException("Chave RSA deve ter 3072 bits ou mais.");}
catch(Exception e){Console.Error.WriteLine("Chave pública inválida: "+e.Message);return 2;}
var root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"Costalog","Agent");
var privateRoot=Path.Combine(root,"Private");var publicRoot=Path.Combine(root,"Public");
Directory.CreateDirectory(privateRoot);Directory.CreateDirectory(publicRoot);
var cfg=new{apiBaseUrl=api,installMode=mode,enrollmentTokenProtected=Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(enrollment),null,DataProtectionScope.LocalMachine)),deviceTokenProtected=(string?)null,deviceId=(string?)null,lastPolicyRevision=0,policyPublicKeyPem=pem,agentVersion="0.1.0"};
var opts=new JsonSerializerOptions(JsonSerializerDefaults.Web){WriteIndented=true};
string target=Path.Combine(privateRoot,"agent.json");
string temp=target+".tmp";
await File.WriteAllTextAsync(temp,JsonSerializer.Serialize(cfg,opts),new UTF8Encoding(false));File.Move(temp,target,true);
var state=new{status="awaiting-enrollment",installMode=mode,revision=0,expiresAt="",allowedDestinations=Array.Empty<string>(),updatedAt=DateTimeOffset.UtcNow.ToString("O")};
await File.WriteAllTextAsync(Path.Combine(publicRoot,"agent-public-state.json"),JsonSerializer.Serialize(state,opts),new UTF8Encoding(false));
Console.WriteLine("Configuração protegida gravada em ProgramData\\Costalog\\Agent.");
Console.WriteLine("Código de instalação protegido com DPAPI LocalMachine.");
Console.WriteLine("Modo: "+(mode=="certificate"?"Opção A":"Opção B"));
return 0;
static string ReadSecret(){var b=new StringBuilder();while(true){var k=Console.ReadKey(true);if(k.Key==ConsoleKey.Enter){Console.WriteLine();break;}if(k.Key==ConsoleKey.Backspace){if(b.Length>0){b.Length--;Console.Write("\b \b");}continue;}if(!char.IsControl(k.KeyChar)&&b.Length<200){b.Append(k.KeyChar);Console.Write("*");}}return b.ToString();}
