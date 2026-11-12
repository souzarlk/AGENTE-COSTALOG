import {Router} from "express";
import crypto from "node:crypto";
import {z} from "zod";
import {query,transaction} from "../db.js";
import {newToken,hashToken,signPolicy} from "../security.js";
import {requireDevice} from "../middleware.js";
import {latestRelease,compareVersions} from "../agentReleases.js";
import {certIgnored} from "../certFilter.js";
import {checkUninstallPassword,createUninstallApproval} from "../uninstall.js";
import {wallpaperPath,getDeviceControls} from "../deviceControls.js";
const router=Router(),uuid=()=>crypto.randomUUID();
const enrollment=z.object({enrollmentToken:z.string().min(8).max(200),deviceName:z.string().trim().min(1).max(120),windowsUsername:z.string().max(120).default(""),domainName:z.string().max(160).default(""),osCaption:z.string().max(160).default(""),osVersion:z.string().max(80).default(""),osBuild:z.string().max(80).default(""),manufacturer:z.string().max(120).default(""),model:z.string().max(160).default(""),cpuName:z.string().max(180).default(""),ramTotalBytes:z.number().int().min(0).default(0),agentVersion:z.string().max(40).default(""),installMode:z.enum(["certificate","certificate-and-web"]),bootAt:z.string().datetime().optional()}).strict();
router.post("/enroll",async(req,res,next)=>{try{
 const x=enrollment.parse(req.body),deviceId=uuid(),deviceToken=newToken(48);
 let assignedMode="certificate-and-web";
 await transaction(async tx=>{
  const credential=await tx.query("SELECT id,install_mode AS installMode FROM enrollment_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW(3) FOR UPDATE",[hashToken(x.enrollmentToken)]);
  const enrollmentRow=credential.rows[0];
  if(!enrollmentRow){const e=new Error("Senha de instalação inválida, expirada ou já utilizada.");e.status=401;throw e}
  assignedMode=enrollmentRow.installMode;
  const consumed=await tx.query("UPDATE enrollment_tokens SET used_at=NOW(3) WHERE id=? AND used_at IS NULL",[enrollmentRow.id]);
  if(!consumed.rowCount){const e=new Error("Senha de instalação já utilizada.");e.status=401;throw e}
  await tx.query("INSERT INTO devices(id,device_name,windows_username,domain_name,os_caption,os_version,os_build,manufacturer,model,cpu_name,ram_total_bytes,agent_version,install_mode,token_hash,status,first_boot_at,last_boot_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,NOW(3))",[deviceId,x.deviceName,x.windowsUsername,x.domainName,x.osCaption,x.osVersion,x.osBuild,x.manufacturer,x.model,x.cpuName,x.ramTotalBytes,x.agentVersion,assignedMode,hashToken(deviceToken),x.bootAt||null,x.bootAt||null]);
  await tx.query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'info',?,?,?)",[uuid(),deviceId,"device_enrolled","Agente instalado",x.deviceName,JSON.stringify({agentVersion:x.agentVersion,installMode:assignedMode})]);
 });
 res.status(201).json({deviceId,deviceToken,installMode:assignedMode,warning:"Credencial exibida uma única vez. Proteja-a com DPAPI no Windows."});
 }catch(e){next(e)}});
// Registra um alerta no máximo uma vez a cada 24 h por computador, tipo e unidade.
async function alertOnce(tx,deviceId,type,severity,title,message,details){
 const found=await tx.query("SELECT id FROM device_events WHERE device_id=? AND event_type=? AND message=? AND created_at>NOW(3)-INTERVAL 1 DAY LIMIT 1",[deviceId,type,message.slice(0,1200)]);
 if(found.rowCount)return;
 await tx.query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,?,?,?,?)",[uuid(),deviceId,type,severity,title,message.slice(0,1200),JSON.stringify(details||{})]);
}
router.use(requireDevice);
// Atualização automática: manifesto assinado com a mesma chave das políticas.
router.get("/agent-update",async(req,res,next)=>{try{
 const current=String(req.query.current||"0.0.0").slice(0,40);
 const release=await latestRelease();
 if(!release||compareVersions(release.version,current)<=0)return res.status(204).end();
 const now=Date.now();
 const payload={purpose:"agent-update",version:release.version,sha256:release.sha256,size:release.size,deviceId:req.device.id,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+3600000).toISOString()};
 const signed=signPolicy(payload);
 res.set("Cache-Control","no-store");
 res.json({revision:0,status:"agent-update",keyId:"costalog-policy-v1",signedPayload:signed.signedPayload,signature:signed.signature});
 }catch(e){next(e)}});
router.get("/agent-update/package/:version",async(req,res,next)=>{try{
 const release=await latestRelease();
 if(!release||release.version!==req.params.version)return res.status(404).json({message:"Versão não disponível."});
 res.set("Cache-Control","no-store");
 res.sendFile(release.file,{headers:{"Content-Type":"application/zip"}},err=>{if(err&&!res.headersSent)next(err)});
 }catch(e){next(e)}});
router.post("/heartbeat",async(req,res,next)=>{try{
 const x=z.object({agentVersion:z.string().max(40).optional(),policyRevision:z.number().int().min(0).default(0),bootAt:z.string().datetime().optional(),ipAddress:z.string().max(64).optional()}).strict().parse(req.body||{});
 await query("UPDATE devices SET last_seen_at=NOW(3),agent_version=COALESCE(NULLIF(?,''),agent_version),policy_revision=GREATEST(policy_revision,?),last_boot_at=COALESCE(?,last_boot_at),last_ip=COALESCE(?,last_ip),updated_at=NOW(3) WHERE id=?",[x.agentVersion||"",x.policyRevision,x.bootAt||null,x.ipAddress||null,req.device.id]);
 res.json({ok:true,serverTime:new Date().toISOString(),policyRevision:req.device.policyRevision});
 }catch(e){next(e)}});
router.post("/telemetry",async(req,res,next)=>{try{
 const x=z.object({cpuPercent:z.number().min(0).max(100).nullable().optional(),memoryUsedBytes:z.number().int().min(0).nullable().optional(),memoryTotalBytes:z.number().int().min(0).nullable().optional(),uptimeSeconds:z.number().int().min(0).nullable().optional(),bootAt:z.string().datetime().nullable().optional(),osCaption:z.string().max(160).optional(),osVersion:z.string().max(80).optional(),osBuild:z.string().max(80).optional(),manufacturer:z.string().max(120).optional(),model:z.string().max(160).optional(),cpuName:z.string().max(180).optional(),ramTotalBytes:z.number().int().min(0).optional(),network:z.record(z.string(),z.unknown()).default({}),disks:z.array(z.object({driveLetter:z.string().max(12),volumeLabel:z.string().max(120).default(""),filesystem:z.string().max(40).default(""),mediaType:z.string().max(40).default(""),totalBytes:z.number().int().min(0),freeBytes:z.number().int().min(0),usedPercent:z.number().min(0).max(100),smartHealth:z.string().max(40).default("unknown"),temperatureC:z.number().nullable().optional(),wearPercent:z.number().min(0).max(100).nullable().optional(),diskModel:z.string().max(160).default("")}).strict()).max(32).default([])}).strict().parse(req.body);
 await transaction(async tx=>{
  await tx.query("INSERT INTO telemetry_snapshots(id,device_id,cpu_percent,memory_used_bytes,memory_total_bytes,uptime_seconds,boot_at,network,snapshot,collected_at) VALUES(?,?,?,?,?,?,?,?,?,NOW(3))",[uuid(),req.device.id,x.cpuPercent??null,x.memoryUsedBytes??null,x.memoryTotalBytes??null,x.uptimeSeconds??null,x.bootAt??null,JSON.stringify(x.network),JSON.stringify({osCaption:x.osCaption,osVersion:x.osVersion,osBuild:x.osBuild,manufacturer:x.manufacturer,model:x.model,cpuName:x.cpuName,ramTotalBytes:x.ramTotalBytes})]);
  for(const d of x.disks)await tx.query("INSERT INTO device_disks(id,device_id,drive_letter,volume_label,filesystem,media_type,total_bytes,free_bytes,used_percent,smart_health,temperature_c,wear_percent,disk_model,collected_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE volume_label=VALUES(volume_label),filesystem=VALUES(filesystem),media_type=VALUES(media_type),total_bytes=VALUES(total_bytes),free_bytes=VALUES(free_bytes),used_percent=VALUES(used_percent),smart_health=VALUES(smart_health),temperature_c=VALUES(temperature_c),wear_percent=VALUES(wear_percent),disk_model=VALUES(disk_model),collected_at=NOW(3)",[uuid(),req.device.id,d.driveLetter,d.volumeLabel,d.filesystem,d.mediaType,d.totalBytes,d.freeBytes,d.usedPercent,d.smartHealth,d.temperatureC??null,d.wearPercent??null,d.diskModel]);
  for(const d of x.disks){
   if(d.usedPercent>=90)await alertOnce(tx,req.device.id,"disk_space_low",d.usedPercent>=95?"critical":"warning","Disco quase cheio",d.driveLetter+" com "+d.usedPercent.toFixed(1)+"% de uso",{drive:d.driveLetter,usedPercent:d.usedPercent,freeBytes:d.freeBytes});
   if(d.smartHealth==="unhealthy"||d.smartHealth==="warning")await alertOnce(tx,req.device.id,"disk_health",d.smartHealth==="unhealthy"?"critical":"warning",d.smartHealth==="unhealthy"?"Disco com falha":"Disco com alerta de saúde",d.driveLetter+" "+(d.diskModel||d.mediaType),{drive:d.driveLetter,smartHealth:d.smartHealth,wearPercent:d.wearPercent??null,temperatureC:d.temperatureC??null});
  }
  await tx.query("UPDATE devices SET os_caption=COALESCE(?,os_caption),os_version=COALESCE(?,os_version),os_build=COALESCE(?,os_build),manufacturer=COALESCE(?,manufacturer),model=COALESCE(?,model),cpu_name=COALESCE(?,cpu_name),ram_total_bytes=COALESCE(?,ram_total_bytes),last_boot_at=COALESCE(?,last_boot_at),last_seen_at=NOW(3),updated_at=NOW(3) WHERE id=?",[x.osCaption||null,x.osVersion||null,x.osBuild||null,x.manufacturer||null,x.model||null,x.cpuName||null,x.ramTotalBytes??null,x.bootAt||null,req.device.id]);
 });
 res.status(202).json({accepted:true,disks:x.disks.length});
 }catch(e){next(e)}});
router.post("/certificates",async(req,res,next)=>{try{
 const received=z.array(z.object({subjectName:z.string().max(512).default(""),issuerName:z.string().max(512).default(""),serialNumber:z.string().max(160).default(""),thumbprintSha1:z.string().max(40).default(""),thumbprintSha256:z.string().max(64).default(""),notBefore:z.string().datetime().nullable().optional(),notAfter:z.string().datetime().nullable().optional(),storeName:z.string().max(100).default(""),hasPrivateKey:z.boolean().default(false)}).strict()).max(2000).parse(req.body.certificates);
 const list=received.filter(c=>!certIgnored(c));
 await transaction(async tx=>{
  await tx.query("DELETE FROM installed_certificates WHERE device_id=?",[req.device.id]);
  for(const c of list)await tx.query("INSERT IGNORE INTO installed_certificates(id,device_id,subject_name,issuer_name,serial_number,thumbprint_sha1,thumbprint_sha256,not_before,not_after,store_name,has_private_key,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW(3))",[uuid(),req.device.id,c.subjectName,c.issuerName,c.serialNumber,c.thumbprintSha1,c.thumbprintSha256,c.notBefore||null,c.notAfter||null,c.storeName,c.hasPrivateKey]);
 });
 res.status(202).json({accepted:true,certificates:list.length,notice:"Somente metadados públicos recebidos; nenhuma chave privada foi transferida."});
 }catch(e){next(e)}});
router.post("/events",async(req,res,next)=>{try{
 const x=z.object({eventType:z.string().min(2).max(80),severity:z.enum(["info","warning","critical"]).default("info"),title:z.string().min(1).max(160),message:z.string().max(1200).default(""),details:z.record(z.string(),z.unknown()).default({})}).strict().parse(req.body);
 const id=uuid();await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,?,?,?,?)",[id,req.device.id,x.eventType,x.severity,x.title,x.message,JSON.stringify(x.details)]);
 res.status(201).json({id,accepted:true});
 }catch(e){next(e)}});
// Histórico dos navegadores enviado em lotes pelo agente (até 500 visitas por envio).
router.post("/browsing-history",async(req,res,next)=>{try{
 const items=z.array(z.object({
  occurredAt:z.string().datetime(),
  url:z.string().max(4000),
  title:z.string().max(1000).default(""),
  browser:z.string().max(40).default(""),
  windowsUser:z.string().max(160).default("")
 }).strict()).max(500).parse(req.body.items);
 const rows=[];
 for(const v of items){
  let host="";
  try{const u=new URL(v.url);if(u.protocol!=="http:"&&u.protocol!=="https:")continue;host=u.hostname.toLowerCase()}catch{continue}
  if(!host)continue;
  const when=new Date(v.occurredAt),url=v.url.slice(0,2048);
  const key=crypto.createHash("sha1").update(v.browser+"|"+v.windowsUser+"|"+when.getTime()+"|"+url).digest("hex");
  rows.push([uuid(),req.device.id,host.slice(0,253),"allowed",req.device.policyRevision||0,"",when,url,v.title.slice(0,300),v.browser,v.windowsUser,key]);
 }
 for(let i=0;i<rows.length;i+=100){
  const chunk=rows.slice(i,i+100);
  await query("INSERT IGNORE INTO browsing_events(id,device_id,hostname,decision,policy_revision,rule_name,occurred_at,url,page_title,browser,windows_user,visit_key) VALUES "+chunk.map(()=>"(?,?,?,?,?,?,?,?,?,?,?,?)").join(","),chunk.flat());
 }
 res.status(202).json({accepted:true,stored:rows.length});
 }catch(e){next(e)}});
router.post("/browsing-events",async(req,res,next)=>{try{
 const x=z.object({hostname:z.string().min(1).max(253),decision:z.enum(["allowed","blocked"]),policyRevision:z.number().int().min(0).default(0),ruleName:z.string().max(160).default(""),occurredAt:z.string().datetime().optional(),windowsUser:z.string().max(160).default(""),source:z.string().max(40).default("")}).strict().parse(req.body);
 if(/[/:?#@]/.test(x.hostname))return res.status(400).json({message:"Envie somente hostname/domínio, sem URL completa."});
 await transaction(async tx=>{
  await tx.query("INSERT INTO browsing_events(id,device_id,hostname,decision,policy_revision,rule_name,occurred_at,url,page_title,browser,windows_user) VALUES(?,?,?,?,?,?,?,?,?,?,?)",[uuid(),req.device.id,x.hostname.toLowerCase(),x.decision,x.policyRevision,x.ruleName,x.occurredAt||new Date().toISOString(),"",x.decision==="blocked"?"Tentativa de acesso bloqueada":"",x.source,x.windowsUser]);
  if(x.decision==="blocked")await tx.query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'warning',?,?,?)",[uuid(),req.device.id,"browser_navigation_blocked","Tentativa de acesso a site bloqueado",x.hostname+(x.windowsUser?" ("+x.windowsUser+")":""),JSON.stringify({hostname:x.hostname,ruleName:x.ruleName,policyRevision:x.policyRevision,windowsUser:x.windowsUser})]);
 });
 res.status(202).json({accepted:true});
 }catch(e){next(e)}});
// Papel de parede padrão: o agente baixa a imagem referenciada na política.
router.get("/wallpaper",async(req,res,next)=>{try{
 const c=await getDeviceControls();
 const full=c.wallpaperEnabled?wallpaperPath(c.wallpaperFile):null;
 if(!full)return res.status(404).json({message:"Nenhum papel de parede configurado."});
 res.set("Cache-Control","no-store");
 res.sendFile(full,err=>{if(err&&!res.headersSent)next(err)});
 }catch(e){next(e)}});

router.get("/policy",async(req,res,next)=>{try{
 const r=await query("SELECT revision,payload FROM policies WHERE status='published' ORDER BY revision DESC LIMIT 1");
 if(!r.rowCount)return res.status(404).json({message:"Política ainda não publicada."});
 const now=Date.now(),payload={...r.rows[0].payload,device:{id:req.device.id,name:req.device.deviceName,installMode:req.device.installMode},issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+Math.max(1,Number(process.env.POLICY_VALIDITY_HOURS||24))*3600000).toISOString()};
 const signed=signPolicy(payload);
 res.set("Cache-Control","no-store");
res.json({revision:Number(r.rows[0].revision),status:"published",keyId:"costalog-policy-v1",signedPayload:signed.signedPayload,signature:signed.signature}); }catch(e){next(e)}});
router.post("/uninstall-request",async(req,res,next)=>{try{
 const x=z.object({reason:z.string().trim().min(5).max(1000),requestedBy:z.string().max(160).default("")}).strict().parse(req.body),id=uuid();
 await query("INSERT INTO uninstall_requests(id,device_id,request_reason,requested_by,status) VALUES(?,?,?,?,'pending')",[id,req.device.id,x.reason,x.requestedBy]);
 await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'critical',?,?,?)",[uuid(),req.device.id,"uninstall_requested","Solicitação de remoção do agente",x.reason,JSON.stringify({requestId:id,requestedBy:x.requestedBy})]);
 res.status(202).json({requestId:id,status:"pending",message:"A solicitação foi enviada à TI. O agente permanece instalado até a aprovação central."});
 }catch(e){next(e)}});
// Uso de certificados digitais: cruza cada uso com os sites visitados naquele momento
// e com a lista "Sites para certificados". Uso fora da lista gera alerta crítico.
const BROWSERS=new Set(["chrome.exe","msedge.exe","brave.exe","opera.exe","firefox.exe","iexplore.exe","vivaldi.exe"]);
function hostAllowed(host,rules){return rules.some(r=>host===r||host.endsWith("."+r))}
function certName(subject){const m=/(?:^|,\s*)CN=([^,]+)/i.exec(subject||"");return (m?m[1]:subject||"Certificado").trim()}
router.post("/certificate-usage",async(req,res,next)=>{try{
 const items=z.array(z.object({
  occurredAt:z.string().datetime(),
  thumbprint:z.string().regex(/^[0-9A-Fa-f]{40}$/),
  subject:z.string().max(512).default(""),
  process:z.string().max(160).default(""),
  windowsUser:z.string().max(160).default("")
 }).strict()).max(100).parse(req.body.items);
 const rules=(await query("SELECT hostname FROM certificate_site_rules WHERE enabled=1")).rows.map(r=>String(r.hostname).toLowerCase().replace(/^\*\./,""));
 let alerts=0;
 for(const u of items){
  const when=new Date(u.occurredAt),proc=u.process.toLowerCase(),cert=certName(u.subject);
  const base={thumbprint:u.thumbprint.toUpperCase(),certificate:cert,process:u.process,windowsUser:u.windowsUser,occurredAt:when.toISOString()};
  let type,severity,title,message,details;
  if(BROWSERS.has(proc)){
   const visits=(await query("SELECT hostname,occurred_at FROM browsing_events WHERE device_id=? AND decision='allowed' AND occurred_at BETWEEN ? AND ? ORDER BY ABS(TIMESTAMPDIFF(MICROSECOND,occurred_at,?)) LIMIT 15",[req.device.id,new Date(when.getTime()-90000),new Date(when.getTime()+30000),when])).rows;
   const hosts=[...new Set(visits.map(v=>v.hostname))];
   // O site que pediu o certificado é a visita mais próxima do momento do uso.
   const allowedHost=hosts.length&&hostAllowed(hosts[0],rules)?hosts[0]:null;
   if(allowedHost){type="certificate_use_allowed";severity="info";title="Certificado usado em site autorizado";message=cert+" em "+allowedHost;details={...base,site:allowedHost,candidates:hosts,allowed:true}}
   else if(hosts.length){type="certificate_use_blocked";severity="critical";title="Certificado usado fora da lista autorizada";message=cert+" em "+hosts[0];details={...base,site:hosts[0],candidates:hosts,allowed:false}}
   else{type="certificate_use_unknown";severity="warning";title="Certificado solicitado por um site não identificado";message=cert+" ("+u.process+")";details={...base,site:"",candidates:[],allowed:false}}
  }else{
   type="certificate_use_program";severity="warning";title="Certificado usado por um programa";message=cert+" por "+(u.process||"programa desconhecido");details={...base,site:"",candidates:[],allowed:null}
  }
  const dup=await query("SELECT id FROM device_events WHERE device_id=? AND event_type=? AND message=? AND created_at>NOW(3)-INTERVAL 10 MINUTE LIMIT 1",[req.device.id,type,message.slice(0,1200)]);
  if(dup.rowCount)continue;
  await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,?,?,?,?)",[uuid(),req.device.id,type,severity,title,message.slice(0,1200),JSON.stringify(details)]);
  if(severity==="critical")alerts++;
 }
 res.status(202).json({accepted:true,alerts});
 }catch(e){next(e)}});

// Desinstalação local: o técnico digita a senha definida no painel (DESINSTALAR.cmd).
router.post("/uninstall-verify",async(req,res,next)=>{try{
 const x=z.object({password:z.string().min(1).max(200),requestedBy:z.string().max(160).default("")}).strict().parse(req.body);
 const recent=await query("SELECT COUNT(*) AS total FROM device_events WHERE device_id=? AND event_type='uninstall_password_wrong' AND created_at>NOW(3)-INTERVAL 15 MINUTE",[req.device.id]);
 if(Number(recent.rows[0].total)>=5)return res.status(429).json({message:"Muitas tentativas com senha incorreta. Aguarde 15 minutos."});
 const check=await checkUninstallPassword(x.password);
 if(!check.configured)return res.status(409).json({message:"A senha de desinstalação ainda não foi definida no painel."});
 if(!check.ok){
  await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'critical',?,?,?)",[uuid(),req.device.id,"uninstall_password_wrong","Tentativa de desinstalação com senha incorreta",x.requestedBy||req.device.deviceName,JSON.stringify({requestedBy:x.requestedBy})]);
  return res.status(403).json({message:"Senha de desinstalação incorreta."});
 }
 const a=await createUninstallApproval(req.device.id,x.requestedBy||"Senha local","Desinstalação com senha no computador",null,true);
 await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'warning',?,?,?)",[uuid(),req.device.id,"uninstall_password_ok","Desinstalação autorizada por senha",x.requestedBy||req.device.deviceName,JSON.stringify({requestId:a.requestId})]);
 res.json({approval:a.signed});
 }catch(e){next(e)}});

// O agente avisa que está sendo removido; o computador fica como "removido" no painel.
router.post("/uninstalled",async(req,res,next)=>{try{
 await query("UPDATE devices SET status='revoked',updated_at=NOW(3) WHERE id=?",[req.device.id]);
 await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'critical',?,?,?)",[uuid(),req.device.id,"agent_uninstalled","Agente removido do computador",req.device.deviceName,"{}"]);
 res.json({ok:true});
 }catch(e){next(e)}});

// Alerta de proteção enviado pelo agente (ex.: encerrado à força).
router.get("/uninstall-approval",async(req,res,next)=>{try{
 const r=await query("SELECT id,release_payload AS releasePayload FROM uninstall_requests WHERE device_id=? AND status='approved' AND delivered_at IS NULL AND release_expires_at>NOW(3) ORDER BY reviewed_at LIMIT 1",[req.device.id]);
 if(!r.rowCount)return res.status(204).end();
 await query("UPDATE uninstall_requests SET delivered_at=NOW(3) WHERE id=?",[r.rows[0].id]);
 res.json({approval:r.rows[0].releasePayload});
 }catch(e){next(e)}});
export default router;
