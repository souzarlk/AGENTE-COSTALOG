import {Router} from "express";
import crypto from "node:crypto";
import {z} from "zod";
import {query,transaction} from "../db.js";
import {newToken,hashToken,signPolicy,signReleaseApproval} from "../security.js";
import {requireAdmin,requireAdminWrite} from "../middleware.js";

const router=Router();
router.use(requireAdmin);
const hostname=/^(?=.{1,253}$)(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const ruleSchema=z.object({name:z.string().trim().min(2).max(120),hostname:z.string().trim().toLowerCase().refine(v=>hostname.test(v),"Hostname inválido."),action:z.enum(["allow","block"]),scopeType:z.enum(["all","group","device"]).default("all"),scopeValue:z.string().max(160).default(""),enabled:z.boolean().default(true)}).strict();
const certRuleSchema=z.object({name:z.string().trim().min(2).max(120),hostname:z.string().trim().toLowerCase().refine(v=>hostname.test(v),"Hostname inválido."),certificateScope:z.string().max(120).default("managed"),enabled:z.boolean().default(true)}).strict();
const uuid=()=>crypto.randomUUID();
router.get("/me",(req,res)=>res.json({authenticated:true,admin:{id:req.admin.id,subject:req.admin.subject,role:"admin"}}));
router.get("/dashboard",async(req,res,next)=>{try{
 const [d,e,b,c]=await Promise.all([
  query("SELECT COUNT(*) total,SUM(status='active') active,SUM(last_seen_at>=TIMESTAMPADD(MINUTE,-5,NOW(3))) online FROM devices"),
  query("SELECT COUNT(*) total FROM device_events WHERE created_at>=CURDATE()"),
  query("SELECT COUNT(*) total FROM browsing_events WHERE occurred_at>=CURDATE() AND decision='blocked'"),
  query("SELECT COUNT(*) total FROM installed_certificates WHERE not_after<=TIMESTAMPADD(DAY,30,NOW(3))")
 ]);
 res.json({devices:d.rows[0],eventsToday:e.rows[0].total,blockedToday:b.rows[0].total,certificatesExpiring:c.rows[0].total,mode:"live"});
 }catch(e){next(e)}});
router.get("/devices",async(req,res,next)=>{try{const r=await query("SELECT id,device_name AS deviceName,windows_username AS username,domain_name AS domainName,os_caption AS osCaption,os_version AS osVersion,os_build AS osBuild,manufacturer,model,cpu_name AS cpuName,ram_total_bytes AS ramTotalBytes,agent_version AS agentVersion,install_mode AS installMode,status,policy_revision AS policyRevision,first_boot_at AS firstBootAt,last_boot_at AS lastBootAt,last_seen_at AS lastSeenAt,last_ip AS lastIp,enrolled_at AS enrolledAt FROM devices ORDER BY device_name");res.json({items:r.rows})}catch(e){next(e)}});
router.patch("/devices/:id/status",requireAdminWrite,async(req,res,next)=>{try{const s=z.enum(["active","disabled","revoked"]).parse(req.body.status);const r=await query("UPDATE devices SET status=?,updated_at=NOW(3) WHERE id=?",[s,req.params.id]);if(!r.rowCount)return res.status(404).json({message:"Dispositivo não encontrado."});await audit(null,"device_status_changed","Status do dispositivo alterado",s,{deviceId:req.params.id,adminId:req.admin.id});res.json({ok:true,status:s})}catch(e){next(e)}});
router.get("/web-rules",async(req,res,next)=>{try{const r=await query("SELECT id,name,hostname,action,scope_type AS scopeType,scope_value AS scopeValue,enabled,updated_at AS updatedAt FROM web_rules ORDER BY hostname");res.json({items:r.rows})}catch(e){next(e)}});
router.post("/web-rules",requireAdminWrite,async(req,res,next)=>{try{const x=ruleSchema.parse(req.body);const id=uuid();await query("INSERT INTO web_rules(id,name,hostname,action,scope_type,scope_value,enabled,created_by) VALUES(?,?,?,?,?,?,?,?)",[id,x.name,x.hostname,x.action,x.scopeType,x.scopeValue,x.enabled,req.admin.id]);await audit(null,"web_rule_created","Regra de navegação cadastrada",x.hostname,{adminId:req.admin.id,ruleId:id});res.status(201).json({id,...x})}catch(e){next(e)}});
router.patch("/web-rules/:id",requireAdminWrite,async(req,res,next)=>{try{const x=z.object({enabled:z.boolean()}).strict().parse(req.body);const r=await query("UPDATE web_rules SET enabled=?,updated_at=NOW(3) WHERE id=?",[x.enabled,req.params.id]);if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});res.json({ok:true})}catch(e){next(e)}});
router.delete("/web-rules/:id",requireAdminWrite,async(req,res,next)=>{try{const r=await query("DELETE FROM web_rules WHERE id=?",[req.params.id]);if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});await audit(null,"web_rule_deleted","Regra de navegação removida","",{adminId:req.admin.id,ruleId:req.params.id});res.status(204).end()}catch(e){next(e)}});
router.get("/certificate-rules",async(req,res,next)=>{try{const r=await query("SELECT id,name,hostname,certificate_scope AS certificateScope,enabled,updated_at AS updatedAt FROM certificate_site_rules ORDER BY hostname");res.json({items:r.rows})}catch(e){next(e)}});
router.post("/certificate-rules",requireAdminWrite,async(req,res,next)=>{try{const x=certRuleSchema.parse(req.body);const id=uuid();await query("INSERT INTO certificate_site_rules(id,name,hostname,certificate_scope,enabled,created_by) VALUES(?,?,?,?,?,?)",[id,x.name,x.hostname,x.certificateScope,x.enabled,req.admin.id]);await audit(null,"certificate_rule_created","Regra de site para certificado criada",x.hostname,{adminId:req.admin.id,ruleId:id});res.status(201).json({id,...x})}catch(e){next(e)}});
router.patch("/certificate-rules/:id",requireAdminWrite,async(req,res,next)=>{try{const x=z.object({enabled:z.boolean()}).strict().parse(req.body);const r=await query("UPDATE certificate_site_rules SET enabled=?,updated_at=NOW(3) WHERE id=?",[x.enabled,req.params.id]);if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});res.json({ok:true})}catch(e){next(e)}});
router.delete("/certificate-rules/:id",requireAdminWrite,async(req,res,next)=>{try{const r=await query("DELETE FROM certificate_site_rules WHERE id=?",[req.params.id]);if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});res.status(204).end()}catch(e){next(e)}});
router.get("/events",async(req,res,next)=>{try{const limit=Math.min(200,Math.max(1,Number(req.query.limit)||50));const r=await query("SELECT e.id,e.device_id AS deviceId,d.device_name AS deviceName,e.event_type AS eventType,e.severity,e.title,e.message,e.details,e.created_at AS createdAt FROM device_events e LEFT JOIN devices d ON d.id=e.device_id ORDER BY e.created_at DESC LIMIT ?",[limit]);res.json({items:r.rows})}catch(e){next(e)}});
router.get("/browsing-events",async(req,res,next)=>{try{const limit=Math.min(500,Math.max(1,Number(req.query.limit)||100));const r=await query("SELECT b.id,b.hostname,b.decision,b.policy_revision AS policyRevision,b.rule_name AS ruleName,b.occurred_at AS occurredAt,d.device_name AS deviceName FROM browsing_events b JOIN devices d ON d.id=b.device_id ORDER BY b.occurred_at DESC LIMIT ?",[limit]);res.json({items:r.rows})}catch(e){next(e)}});
router.get("/certificates",async(req,res,next)=>{try{const r=await query("SELECT c.id,c.subject_name AS subjectName,c.issuer_name AS issuerName,c.serial_number AS serialNumber,c.thumbprint_sha1 AS thumbprintSha1,c.thumbprint_sha256 AS thumbprintSha256,c.not_before AS notBefore,c.not_after AS notAfter,c.store_name AS storeName,c.has_private_key AS hasPrivateKey,c.observed_at AS observedAt,d.device_name AS deviceName FROM installed_certificates c JOIN devices d ON d.id=c.device_id ORDER BY c.not_after");res.json({items:r.rows})}catch(e){next(e)}});
router.post("/enrollment-tokens",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({
  installationPassword:z.string().trim().min(16).max(128).refine(v=>/[A-Za-z]/.test(v)&&/\d/.test(v),"Use pelo menos 16 caracteres, incluindo letras e números."),
  expiresMinutes:z.number().int().min(5).max(1440).default(60),
  installMode:z.enum(["certificate","certificate-and-web"]).default("certificate-and-web")
 }).strict().parse(req.body);
 const id=uuid(),minutes=x.expiresMinutes;
 await query("INSERT INTO enrollment_tokens(id,token_hash,created_by,expires_at,install_mode) VALUES(?,?,?,TIMESTAMPADD(MINUTE,?,NOW(3)),?)",[id,hashToken(x.installationPassword),req.admin.id,minutes,x.installMode]);
 await audit(null,"enrollment_created","Senha temporária de instalação criada","",{adminId:req.admin.id,expiresMinutes:minutes,installMode:x.installMode});
 res.status(201).json({created:true,expiresMinutes:minutes,singleUse:true,installMode:x.installMode,warning:"A senha não pode ser recuperada. Ela será consumida no primeiro cadastro."});
 }catch(e){next(e)}});
router.get("/policy",async(req,res,next)=>{try{const r=await query("SELECT revision,status,payload,signature,published_at AS publishedAt FROM policies WHERE status='published' ORDER BY revision DESC LIMIT 1");res.json(r.rows[0]||{revision:0,status:"draft",payload:{mode:"deny-by-default",webRules:[],certificateRules:[]}})}catch(e){next(e)}});
router.post("/policy/publish",requireAdminWrite,async(req,res,next)=>{try{
 const result=await transaction(async tx=>{
  await tx.query("SELECT id FROM agent_policy_lock WHERE id=1 FOR UPDATE");
  const w=await tx.query("SELECT name,hostname,action,scope_type AS scopeType,scope_value AS scopeValue FROM web_rules WHERE enabled=1 ORDER BY hostname");
  const c=await tx.query("SELECT name,hostname,certificate_scope AS certificateScope FROM certificate_site_rules WHERE enabled=1 ORDER BY hostname");
  const rev=await tx.query("SELECT COALESCE(MAX(revision),0)+1 revision FROM policies");
  const payload={schemaVersion:1,product:"AGENTE COSTALOG",revision:Number(rev.rows[0].revision),issuedAt:new Date().toISOString(),mode:"managed",defaults:{web:"deny",certificate:"deny"},webRules:w.rows,certificateRules:c.rows,allowedDestinations:w.rows.filter(rule=>rule.action==="allow").map(rule=>rule.hostname),deviceControls:{blockUnauthorizedSoftware:true,usbStorage:"block-by-default",wallpaper:"managed",uninstallRequiresApproval:true}};
  const signed=signPolicy(payload);await tx.query("INSERT INTO policies(revision,status,payload,signature,created_by) VALUES(?,'published',?,?,?)",[payload.revision,JSON.stringify(payload),signed.signature,req.admin.id]);
  return{revision:payload.revision,webRules:w.rowCount,certificateRules:c.rowCount,publishedAt:new Date().toISOString()};
 });
 await audit(null,"policy_published","Política corporativa publicada","",{adminId:req.admin.id,...result});res.json({...result,status:"published"});
 }catch(e){next(e)}});
router.get("/uninstall-requests",async(req,res,next)=>{try{const r=await query("SELECT u.id,u.device_id AS deviceId,d.device_name AS deviceName,u.request_reason AS reason,u.requested_by AS requestedBy,u.status,u.requested_at AS requestedAt FROM uninstall_requests u JOIN devices d ON d.id=u.device_id ORDER BY u.requested_at DESC LIMIT 100");res.json({items:r.rows})}catch(e){next(e)}});
router.post("/uninstall-requests/:id/review",requireAdminWrite,async(req,res,next)=>{try{
 const decision=z.enum(["approve","reject"]).parse(req.body.decision);
 const found=await query("SELECT * FROM uninstall_requests WHERE id=? AND status='pending'",[req.params.id]);if(!found.rowCount)return res.status(404).json({message:"Solicitação pendente não encontrada."});
 if(decision==="reject"){await query("UPDATE uninstall_requests SET status='rejected',reviewed_by=?,reviewed_at=NOW(3) WHERE id=?",[req.admin.id,req.params.id]);await audit(found.rows[0].device_id,"uninstall_rejected","Solicitação de desinstalação recusada","",{adminId:req.admin.id,requestId:req.params.id});return res.json({status:"rejected"})}
 const releaseToken=newToken(40),expires=new Date(Date.now()+5*60*1000),payload={purpose:"agent-uninstall",requestId:req.params.id,deviceId:found.rows[0].device_id,expiresAt:expires.toISOString(),nonce:newToken(16)};
 const signed=signReleaseApproval(payload);await query("UPDATE uninstall_requests SET status='approved',reviewed_by=?,reviewed_at=NOW(3),release_payload=?,release_expires_at=? WHERE id=?",[req.admin.id,JSON.stringify(signed),expires,req.params.id]);
 await audit(found.rows[0].device_id,"uninstall_approved","Autorização temporária de remoção emitida","",{adminId:req.admin.id,requestId:req.params.id,expiresAt:expires.toISOString()});
 res.json({status:"approved",signedApproval:signed,expiresAt:expires.toISOString(),warning:"Autorização assinada entregue ao dispositivo na próxima consulta; uso único."});
 }catch(e){next(e)}});
router.get("/settings",async(req,res,next)=>{try{const r=await query("SELECT setting_key AS key,setting_value AS value,updated_at AS updatedAt FROM agent_settings ORDER BY setting_key");res.json({items:r.rows})}catch(e){next(e)}});
router.put("/settings/:key",requireAdminWrite,async(req,res,next)=>{try{const key=z.string().regex(/^[a-z0-9_.-]{2,100}$/).parse(req.params.key);const value=z.unknown().parse(req.body.value);await query("INSERT INTO agent_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=NOW(3)",[key,JSON.stringify(value),req.admin.id]);await audit(null,"setting_changed","Configuração administrativa alterada",key,{adminId:req.admin.id});res.json({ok:true,key,value})}catch(e){next(e)}});
router.get("/mail-integrations",async(req,res,next)=>{try{const r=await query("SELECT id,provider,mailbox,display_name AS displayName,status,scopes,last_sync_at AS lastSyncAt FROM mail_integrations ORDER BY mailbox");res.json({items:r.rows})}catch(e){next(e)}});
router.post("/mail-integrations",requireAdminWrite,async(req,res,next)=>{try{const x=z.object({provider:z.enum(["microsoft-graph","imap-oauth"]),mailbox:z.string().email().max(254),displayName:z.string().max(160).default(""),scopes:z.array(z.string().max(100)).max(20)}).strict().parse(req.body);const id=uuid();await query("INSERT INTO mail_integrations(id,provider,mailbox,display_name,status,scopes) VALUES(?,?,?,?,'pending',?)",[id,x.provider,x.mailbox,x.displayName,JSON.stringify(x.scopes)]);await audit(null,"mail_integration_created","Integração de caixa autorizada para configuração",x.mailbox,{adminId:req.admin.id,provider:x.provider,scopes:x.scopes});res.status(201).json({id,...x,status:"pending"})}catch(e){next(e)}});
async function audit(deviceId,eventType,title,message,details){await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,?,?,?,?)",[uuid(),deviceId,eventType,"info",title,message,JSON.stringify(details||{})])}
export default router;
