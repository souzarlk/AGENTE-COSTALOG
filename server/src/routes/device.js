import {Router} from "express";
import crypto from "node:crypto";
import {z} from "zod";
import {query,transaction} from "../db.js";
import {newToken,hashToken,signPolicy} from "../security.js";
import {requireDevice} from "../middleware.js";
const router=Router(),uuid=()=>crypto.randomUUID();
const enrollment=z.object({enrollmentToken:z.string().min(20).max(200),deviceName:z.string().trim().min(1).max(120),windowsUsername:z.string().max(120).default(""),domainName:z.string().max(160).default(""),osCaption:z.string().max(160).default(""),osVersion:z.string().max(80).default(""),osBuild:z.string().max(80).default(""),manufacturer:z.string().max(120).default(""),model:z.string().max(160).default(""),cpuName:z.string().max(180).default(""),ramTotalBytes:z.number().int().min(0).default(0),agentVersion:z.string().max(40).default(""),installMode:z.enum(["certificate","certificate-and-web"]),bootAt:z.string().datetime().optional()}).strict();
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
router.use(requireDevice);
router.post("/heartbeat",async(req,res,next)=>{try{
 const x=z.object({agentVersion:z.string().max(40).optional(),policyRevision:z.number().int().min(0).default(0),bootAt:z.string().datetime().optional(),ipAddress:z.string().max(64).optional()}).strict().parse(req.body||{});
 await query("UPDATE devices SET last_seen_at=NOW(3),agent_version=COALESCE(NULLIF(?,''),agent_version),policy_revision=GREATEST(policy_revision,?),last_boot_at=COALESCE(?,last_boot_at),last_ip=COALESCE(?,last_ip),updated_at=NOW(3) WHERE id=?",[x.agentVersion||"",x.policyRevision,x.bootAt||null,x.ipAddress||null,req.device.id]);
 res.json({ok:true,serverTime:new Date().toISOString(),policyRevision:req.device.policyRevision});
 }catch(e){next(e)}});
router.post("/telemetry",async(req,res,next)=>{try{
 const x=z.object({cpuPercent:z.number().min(0).max(100).nullable().optional(),memoryUsedBytes:z.number().int().min(0).nullable().optional(),memoryTotalBytes:z.number().int().min(0).nullable().optional(),uptimeSeconds:z.number().int().min(0).nullable().optional(),bootAt:z.string().datetime().nullable().optional(),osCaption:z.string().max(160).optional(),osVersion:z.string().max(80).optional(),osBuild:z.string().max(80).optional(),manufacturer:z.string().max(120).optional(),model:z.string().max(160).optional(),cpuName:z.string().max(180).optional(),ramTotalBytes:z.number().int().min(0).optional(),network:z.record(z.string(),z.unknown()).default({}),disks:z.array(z.object({driveLetter:z.string().max(12),volumeLabel:z.string().max(120).default(""),filesystem:z.string().max(40).default(""),mediaType:z.string().max(40).default(""),totalBytes:z.number().int().min(0),freeBytes:z.number().int().min(0),usedPercent:z.number().min(0).max(100),smartHealth:z.string().max(40).default("unknown"),temperatureC:z.number().nullable().optional()}).strict()).max(32).default([])}).strict().parse(req.body);
 await transaction(async tx=>{
  await tx.query("INSERT INTO telemetry_snapshots(id,device_id,cpu_percent,memory_used_bytes,memory_total_bytes,uptime_seconds,boot_at,network,snapshot,collected_at) VALUES(?,?,?,?,?,?,?,?,?,NOW(3))",[uuid(),req.device.id,x.cpuPercent??null,x.memoryUsedBytes??null,x.memoryTotalBytes??null,x.uptimeSeconds??null,x.bootAt??null,JSON.stringify(x.network),JSON.stringify({osCaption:x.osCaption,osVersion:x.osVersion,osBuild:x.osBuild,manufacturer:x.manufacturer,model:x.model,cpuName:x.cpuName,ramTotalBytes:x.ramTotalBytes})]);
  for(const d of x.disks)await tx.query("INSERT INTO device_disks(id,device_id,drive_letter,volume_label,filesystem,media_type,total_bytes,free_bytes,used_percent,smart_health,temperature_c,collected_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE volume_label=VALUES(volume_label),filesystem=VALUES(filesystem),media_type=VALUES(media_type),total_bytes=VALUES(total_bytes),free_bytes=VALUES(free_bytes),used_percent=VALUES(used_percent),smart_health=VALUES(smart_health),temperature_c=VALUES(temperature_c),collected_at=NOW(3)",[uuid(),req.device.id,d.driveLetter,d.volumeLabel,d.filesystem,d.mediaType,d.totalBytes,d.freeBytes,d.usedPercent,d.smartHealth,d.temperatureC??null]);
  await tx.query("UPDATE devices SET os_caption=COALESCE(?,os_caption),os_version=COALESCE(?,os_version),os_build=COALESCE(?,os_build),manufacturer=COALESCE(?,manufacturer),model=COALESCE(?,model),cpu_name=COALESCE(?,cpu_name),ram_total_bytes=COALESCE(?,ram_total_bytes),last_boot_at=COALESCE(?,last_boot_at),last_seen_at=NOW(3),updated_at=NOW(3) WHERE id=?",[x.osCaption||null,x.osVersion||null,x.osBuild||null,x.manufacturer||null,x.model||null,x.cpuName||null,x.ramTotalBytes??null,x.bootAt||null,req.device.id]);
 });
 res.status(202).json({accepted:true,disks:x.disks.length});
 }catch(e){next(e)}});
router.post("/certificates",async(req,res,next)=>{try{
 const list=z.array(z.object({subjectName:z.string().max(512).default(""),issuerName:z.string().max(512).default(""),serialNumber:z.string().max(160).default(""),thumbprintSha1:z.string().max(40).default(""),thumbprintSha256:z.string().max(64).default(""),notBefore:z.string().datetime().nullable().optional(),notAfter:z.string().datetime().nullable().optional(),storeName:z.string().max(100).default(""),hasPrivateKey:z.boolean().default(false)}).strict()).max(2000).parse(req.body.certificates);
 await transaction(async tx=>{
  await tx.query("DELETE FROM installed_certificates WHERE device_id=?",[req.device.id]);
  for(const c of list)await tx.query("INSERT INTO installed_certificates(id,device_id,subject_name,issuer_name,serial_number,thumbprint_sha1,thumbprint_sha256,not_before,not_after,store_name,has_private_key,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW(3))",[uuid(),req.device.id,c.subjectName,c.issuerName,c.serialNumber,c.thumbprintSha1,c.thumbprintSha256,c.notBefore||null,c.notAfter||null,c.storeName,c.hasPrivateKey]);
 });
 res.status(202).json({accepted:true,certificates:list.length,notice:"Somente metadados públicos recebidos; nenhuma chave privada foi transferida."});
 }catch(e){next(e)}});
router.post("/events",async(req,res,next)=>{try{
 const x=z.object({eventType:z.string().min(2).max(80),severity:z.enum(["info","warning","critical"]).default("info"),title:z.string().min(1).max(160),message:z.string().max(1200).default(""),details:z.record(z.string(),z.unknown()).default({})}).strict().parse(req.body);
 const id=uuid();await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,?,?,?,?)",[id,req.device.id,x.eventType,x.severity,x.title,x.message,JSON.stringify(x.details)]);
 res.status(201).json({id,accepted:true});
 }catch(e){next(e)}});
router.post("/browsing-events",async(req,res,next)=>{try{
 const x=z.object({hostname:z.string().min(1).max(253),decision:z.enum(["allowed","blocked"]),policyRevision:z.number().int().min(0).default(0),ruleName:z.string().max(160).default(""),occurredAt:z.string().datetime().optional()}).strict().parse(req.body);
 if(/[/:?#@]/.test(x.hostname))return res.status(400).json({message:"Envie somente hostname/domínio, sem URL completa."});
 await transaction(async tx=>{
  await tx.query("INSERT INTO browsing_events(id,device_id,hostname,decision,policy_revision,rule_name,occurred_at) VALUES(?,?,?,?,?,?,?)",[uuid(),req.device.id,x.hostname.toLowerCase(),x.decision,x.policyRevision,x.ruleName,x.occurredAt||new Date().toISOString()]);
  if(x.decision==="blocked")await tx.query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'warning',?,?,?)",[uuid(),req.device.id,"browser_navigation_blocked","Navegação bloqueada",x.hostname,JSON.stringify({hostname:x.hostname,ruleName:x.ruleName,policyRevision:x.policyRevision})]);
 });
 res.status(202).json({accepted:true});
 }catch(e){next(e)}});
router.get("/policy",async(req,res,next)=>{try{
 const r=await query("SELECT revision,payload FROM policies WHERE status='published' ORDER BY revision DESC LIMIT 1");
 if(!r.rowCount)return res.status(404).json({message:"Política ainda não publicada."});
 const now=Date.now(),payload={...r.rows[0].payload,device:{id:req.device.id,name:req.device.deviceName,installMode:req.device.installMode},issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+Math.max(1,Number(process.env.POLICY_VALIDITY_HOURS||24))*3600000).toISOString()};
 const signed=signPolicy(payload);
 res.set("Cache-Control","no-store");
 res.json({revision:Number(r.rows[0].revision),status:"published",keyId:"costalog-policy-v1",signedPayload:signed.signedPayload,signature:Buffer.from(signed.signature,"base64url").toString("base64")});
 }catch(e){next(e)}});
router.post("/uninstall-request",async(req,res,next)=>{try{
 const x=z.object({reason:z.string().trim().min(5).max(1000),requestedBy:z.string().max(160).default("")}).strict().parse(req.body),id=uuid();
 await query("INSERT INTO uninstall_requests(id,device_id,request_reason,requested_by,status) VALUES(?,?,?,?,'pending')",[id,req.device.id,x.reason,x.requestedBy]);
 await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,'critical',?,?,?)",[uuid(),req.device.id,"uninstall_requested","Solicitação de remoção do agente",x.reason,JSON.stringify({requestId:id,requestedBy:x.requestedBy})]);
 res.status(202).json({requestId:id,status:"pending",message:"A solicitação foi enviada à TI. O agente permanece instalado até a aprovação central."});
 }catch(e){next(e)}});
router.get("/uninstall-approval",async(req,res,next)=>{try{
 const r=await query("SELECT id,release_payload AS releasePayload FROM uninstall_requests WHERE device_id=? AND status='approved' AND delivered_at IS NULL AND release_expires_at>NOW(3) ORDER BY reviewed_at LIMIT 1",[req.device.id]);
 if(!r.rowCount)return res.status(204).end();
 await query("UPDATE uninstall_requests SET delivered_at=NOW(3) WHERE id=?",[r.rows[0].id]);
 res.json({approval:r.rows[0].releasePayload});
 }catch(e){next(e)}});
export default router;
