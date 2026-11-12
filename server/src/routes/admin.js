
import {Router} from "express";
import crypto from "node:crypto";
import {z} from "zod";
import {query,transaction} from "../db.js";
import {newToken,hashToken,signPolicy,signReleaseApproval} from "../security.js";
import {requireAdmin,requireAdminWrite} from "../middleware.js";
import {latestRelease,latestInstaller} from "../agentReleases.js";
import {certVisibleSql} from "../certFilter.js";
import {getUninstallPasswordInfo,setUninstallPassword,createUninstallApproval,UNINSTALL_SETTING} from "../uninstall.js";
import {publicEmailConfig,saveEmailConfig,sendTestEmail} from "../email.js";
import {getDeviceControls,setUsbBlock,setWallpaper,setWallpaperEnabled,policyDeviceControls} from "../deviceControls.js";

const router=Router();
router.use(requireAdmin);

const hostname=/^(?=.{1,253}$)(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const ruleSchema=z.object({
  name:z.string().trim().min(2).max(120),
  hostname:z.string().trim().toLowerCase().refine(v=>hostname.test(v),"Hostname inválido."),
  action:z.enum(["allow","block"]),
  scopeType:z.enum(["all","group","device"]).default("all"),
  scopeValue:z.string().max(160).default(""),
  enabled:z.boolean().default(true)
}).strict();

const certRuleSchema=z.object({
  name:z.string().trim().min(2).max(120),
  hostname:z.string().trim().toLowerCase().refine(v=>hostname.test(v),"Hostname inválido."),
  certificateScope:z.string().max(120).default("managed"),
  enabled:z.boolean().default(true)
}).strict();

const uuid=()=>crypto.randomUUID();

// DADOS DO ADMINISTRADOR AUTENTICADO
router.get("/me",(req,res)=>res.json({
  authenticated:true,
  admin:{
    id:req.admin.id,
    username:req.admin.username,
    displayName:req.admin.displayName,
    role:req.admin.role
  }
}));

router.get("/dashboard",async(req,res,next)=>{try{
 const [d,e,b,c]=await Promise.all([
  query("SELECT COUNT(*) total,SUM(status='active') active,SUM(last_seen_at>=TIMESTAMPADD(MINUTE,-5,NOW(3))) online FROM devices"),
  query("SELECT COUNT(*) total FROM device_events WHERE created_at>=CURDATE()"),
  query("SELECT COUNT(*) total FROM browsing_events WHERE occurred_at>=CURDATE() AND decision='blocked'"),
  query("SELECT COUNT(*) total FROM installed_certificates WHERE not_after<=TIMESTAMPADD(DAY,30,NOW(3)) AND "+certVisibleSql(""))
 ]);
 res.json({devices:d.rows[0],eventsToday:e.rows[0].total,blockedToday:b.rows[0].total,certificatesExpiring:c.rows[0].total,mode:"live"});
 }catch(e){next(e)}});

router.get("/agent-release",async(req,res,next)=>{try{
 const [r,i]=await Promise.all([latestRelease(),latestInstaller()]);
 res.json({...(r?{version:r.version,size:r.size,sha256:r.sha256,publishedAt:r.publishedAt}:{version:null}),installer:i?{version:i.version,size:i.size,publishedAt:i.publishedAt,apiBaseUrl:i.apiBaseUrl,fileName:i.fileName}:null});
 }catch(e){next(e)}});

router.get("/agent-installer",async(req,res,next)=>{try{
 const i=await latestInstaller();
 if(!i)return res.status(404).json({message:"Nenhum instalador publicado."});
 await audit(null,"installer_downloaded","Instalador do agente baixado","Versão "+i.version,{adminId:req.admin.id,version:i.version});
 res.set("Cache-Control","no-store");
 res.download(i.file,i.fileName,err=>{if(err&&!res.headersSent)next(err)});
 }catch(e){next(e)}});

router.get("/devices/:id",async(req,res,next)=>{try{
 const id=req.params.id;
 const d=await query("SELECT id,device_name AS deviceName,windows_username AS username,domain_name AS domainName,os_caption AS osCaption,os_version AS osVersion,os_build AS osBuild,manufacturer,model,cpu_name AS cpuName,ram_total_bytes AS ramTotalBytes,agent_version AS agentVersion,install_mode AS installMode,status,policy_revision AS policyRevision,first_boot_at AS firstBootAt,last_boot_at AS lastBootAt,last_seen_at AS lastSeenAt,last_ip AS lastIp,enrolled_at AS enrolledAt FROM devices WHERE id=?",[id]);
 if(!d.rowCount)return res.status(404).json({message:"Computador não encontrado."});
 const [t,disks,certs,events]=await Promise.all([
  query("SELECT cpu_percent AS cpuPercent,memory_used_bytes AS memoryUsedBytes,memory_total_bytes AS memoryTotalBytes,uptime_seconds AS uptimeSeconds,network,collected_at AS collectedAt FROM telemetry_snapshots WHERE device_id=? ORDER BY collected_at DESC LIMIT 1",[id]),
  query("SELECT drive_letter AS driveLetter,volume_label AS volumeLabel,filesystem,media_type AS mediaType,disk_model AS diskModel,total_bytes AS totalBytes,free_bytes AS freeBytes,used_percent AS usedPercent,smart_health AS smartHealth,temperature_c AS temperatureC,wear_percent AS wearPercent,collected_at AS collectedAt FROM device_disks WHERE device_id=? ORDER BY drive_letter",[id]),
  query("SELECT subject_name AS subjectName,issuer_name AS issuerName,serial_number AS serialNumber,thumbprint_sha1 AS thumbprintSha1,not_before AS notBefore,not_after AS notAfter,store_name AS storeName,has_private_key AS hasPrivateKey FROM installed_certificates WHERE device_id=? AND "+certVisibleSql("")+" ORDER BY not_after",[id]),
  query("SELECT event_type AS eventType,severity,title,message,created_at AS createdAt FROM device_events WHERE device_id=? ORDER BY created_at DESC LIMIT 40",[id])
 ]);
 res.json({device:d.rows[0],telemetry:t.rows[0]||null,disks:disks.rows,certificates:certs.rows,events:events.rows});
 }catch(e){next(e)}});

router.get("/health",async(req,res,next)=>{try{
 const [disks,events]=await Promise.all([
  query("SELECT k.device_id AS deviceId,d.device_name AS deviceName,k.drive_letter AS driveLetter,k.media_type AS mediaType,k.disk_model AS diskModel,k.total_bytes AS totalBytes,k.free_bytes AS freeBytes,k.used_percent AS usedPercent,k.smart_health AS smartHealth,k.temperature_c AS temperatureC,k.wear_percent AS wearPercent,k.collected_at AS collectedAt FROM device_disks k JOIN devices d ON d.id=k.device_id WHERE d.status='active' ORDER BY k.used_percent DESC"),
  query("SELECT e.device_id AS deviceId,d.device_name AS deviceName,e.event_type AS eventType,e.severity,e.title,e.message,e.created_at AS createdAt FROM device_events e JOIN devices d ON d.id=e.device_id WHERE e.severity IN ('critical','warning') AND e.created_at>NOW(3)-INTERVAL 7 DAY ORDER BY e.created_at DESC LIMIT 200")
 ]);
 res.json({disks:disks.rows,events:events.rows});
 }catch(e){next(e)}});

router.get("/devices",async(req,res,next)=>{try{
 const r=await query("SELECT id,device_name AS deviceName,windows_username AS username,domain_name AS domainName,os_caption AS osCaption,os_version AS osVersion,os_build AS osBuild,manufacturer,model,cpu_name AS cpuName,ram_total_bytes AS ramTotalBytes,agent_version AS agentVersion,install_mode AS installMode,status,policy_revision AS policyRevision,first_boot_at AS firstBootAt,last_boot_at AS lastBootAt,last_seen_at AS lastSeenAt,last_ip AS lastIp,enrolled_at AS enrolledAt FROM devices ORDER BY device_name");
 res.json({items:r.rows});
 }catch(e){next(e)}});

router.patch("/devices/:id/status",requireAdminWrite,async(req,res,next)=>{try{
 const s=z.enum(["active","disabled","revoked"]).parse(req.body.status);
 const r=await query("UPDATE devices SET status=?,updated_at=NOW(3) WHERE id=?",[s,req.params.id]);
 if(!r.rowCount)return res.status(404).json({message:"Dispositivo não encontrado."});
 await audit(null,"device_status_changed","Status do dispositivo alterado",s,{deviceId:req.params.id,adminId:req.admin.id});
 res.json({ok:true,status:s});
 }catch(e){next(e)}});

router.get("/web-rules",async(req,res,next)=>{try{
 const r=await query("SELECT id,name,hostname,action,scope_type AS scopeType,scope_value AS scopeValue,enabled,updated_at AS updatedAt FROM web_rules ORDER BY hostname");
 res.json({items:r.rows});
 }catch(e){next(e)}});

router.post("/web-rules",requireAdminWrite,async(req,res,next)=>{try{
 const x=ruleSchema.parse(req.body);
 const id=uuid();
 await query("INSERT INTO web_rules(id,name,hostname,action,scope_type,scope_value,enabled,created_by) VALUES(?,?,?,?,?,?,?,?)",[id,x.name,x.hostname,x.action,x.scopeType,x.scopeValue,x.enabled,req.admin.id]);
 await audit(null,"web_rule_created","Regra de navegação cadastrada",x.hostname,{adminId:req.admin.id,ruleId:id});
 res.status(201).json({id,...x,...await autoPublish(req.admin.id)});
 }catch(e){next(e)}});

router.patch("/web-rules/:id",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({enabled:z.boolean()}).strict().parse(req.body);
 const r=await query("UPDATE web_rules SET enabled=?,updated_at=NOW(3) WHERE id=?",[x.enabled,req.params.id]);
 if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});
 res.json({ok:true,...await autoPublish(req.admin.id)});
 }catch(e){next(e)}});

router.delete("/web-rules/:id",requireAdminWrite,async(req,res,next)=>{try{
 const r=await query("DELETE FROM web_rules WHERE id=?",[req.params.id]);
 if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});
 await audit(null,"web_rule_deleted","Regra de navegação removida","",{adminId:req.admin.id,ruleId:req.params.id});
 res.json({ok:true,...await autoPublish(req.admin.id)});
 }catch(e){next(e)}});

router.get("/certificate-rules",async(req,res,next)=>{try{
 const r=await query("SELECT id,name,hostname,certificate_scope AS certificateScope,enabled,updated_at AS updatedAt FROM certificate_site_rules ORDER BY hostname");
 res.json({items:r.rows});
 }catch(e){next(e)}});

router.post("/certificate-rules",requireAdminWrite,async(req,res,next)=>{try{
 const x=certRuleSchema.parse(req.body);
 const id=uuid();
 await query("INSERT INTO certificate_site_rules(id,name,hostname,certificate_scope,enabled,created_by) VALUES(?,?,?,?,?,?)",[id,x.name,x.hostname,x.certificateScope,x.enabled,req.admin.id]);
 await audit(null,"certificate_rule_created","Regra de site para certificado criada",x.hostname,{adminId:req.admin.id,ruleId:id});
 res.status(201).json({id,...x,...await autoPublish(req.admin.id)});
 }catch(e){next(e)}});

router.patch("/certificate-rules/:id",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({enabled:z.boolean()}).strict().parse(req.body);
 const r=await query("UPDATE certificate_site_rules SET enabled=?,updated_at=NOW(3) WHERE id=?",[x.enabled,req.params.id]);
 if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});
 res.json({ok:true,...await autoPublish(req.admin.id)});
 }catch(e){next(e)}});

router.delete("/certificate-rules/:id",requireAdminWrite,async(req,res,next)=>{try{
 const r=await query("DELETE FROM certificate_site_rules WHERE id=?",[req.params.id]);
 if(!r.rowCount)return res.status(404).json({message:"Regra não encontrada."});
 res.json({ok:true,...await autoPublish(req.admin.id)});
 }catch(e){next(e)}});

// Filtros comuns da auditoria: período (1, 7 ou 30 dias) e nível (all, warning = crítico+atenção, critical).
function eventFilters(req){
 const days=[1,7,30].includes(Number(req.query.days))?Number(req.query.days):7;
 const level=["critical","warning"].includes(String(req.query.severity))?String(req.query.severity):"all";
 const sevSql=level==="critical"?" AND e.severity='critical'":level==="warning"?" AND e.severity IN ('critical','warning')":"";
 return{days,level,sevSql};
}

// Resumo da auditoria por computador (e um grupo para ações do painel).
router.get("/events/summary",async(req,res,next)=>{try{
 const f=eventFilters(req);
 const [devices,admin,open]=await Promise.all([
  query("SELECT d.id AS deviceId,d.device_name AS deviceName,d.windows_username AS username,d.status,COUNT(e.id) AS total,SUM(e.severity='critical') AS critical,SUM(e.severity='warning') AS warning,SUM(e.severity='critical' AND e.acknowledged_at IS NULL) AS openCritical,MAX(e.created_at) AS lastEvent FROM devices d LEFT JOIN device_events e ON e.device_id=d.id AND e.created_at>NOW(3)-INTERVAL ? DAY"+f.sevSql+" GROUP BY d.id,d.device_name,d.windows_username,d.status ORDER BY openCritical DESC,critical DESC,d.device_name",[f.days]),
  query("SELECT COUNT(e.id) AS total,SUM(e.severity='critical') AS critical,SUM(e.severity='warning') AS warning,MAX(e.created_at) AS lastEvent FROM device_events e WHERE e.device_id IS NULL AND e.created_at>NOW(3)-INTERVAL ? DAY"+f.sevSql,[f.days]),
  query("SELECT COUNT(*) AS total FROM device_events WHERE severity='critical' AND device_id IS NOT NULL AND acknowledged_at IS NULL")
 ]);
 res.json({days:f.days,severity:f.level,devices:devices.rows,admin:admin.rows[0],openCritical:Number(open.rows[0].total)});
 }catch(e){next(e)}});

// Eventos de um computador (deviceId) ou do painel (deviceId=admin).
router.get("/events",async(req,res,next)=>{try{
 const f=eventFilters(req);
 const limit=Math.min(300,Math.max(1,Number(req.query.limit)||200));
 const deviceId=String(req.query.deviceId||"");
 const q=String(req.query.q||"").trim().slice(0,100);
 const like="%"+q.replace(/[\\%_]/g,m=>"\\"+m)+"%";
 let where=" WHERE e.created_at>NOW(3)-INTERVAL ? DAY"+f.sevSql;
 const params=[f.days];
 if(deviceId==="admin")where+=" AND e.device_id IS NULL";
 else if(deviceId){where+=" AND e.device_id=?";params.push(deviceId)}
 if(q){where+=" AND (e.title LIKE ? OR e.message LIKE ?)";params.push(like,like)}
 params.push(limit);
 const r=await query("SELECT e.id,e.device_id AS deviceId,d.device_name AS deviceName,e.event_type AS eventType,e.severity,e.title,e.message,e.details,e.created_at AS createdAt,e.acknowledged_at AS acknowledgedAt FROM device_events e LEFT JOIN devices d ON d.id=e.device_id"+where+" ORDER BY e.created_at DESC LIMIT ?",params);
 res.json({items:r.rows});
 }catch(e){next(e)}});

// Alertas críticos não lidos (sino de notificações do painel).
router.get("/alerts",async(req,res,next)=>{try{
 const [items,count]=await Promise.all([
  query("SELECT e.id,e.device_id AS deviceId,d.device_name AS deviceName,e.event_type AS eventType,e.title,e.message,e.created_at AS createdAt FROM device_events e JOIN devices d ON d.id=e.device_id WHERE e.severity='critical' AND e.acknowledged_at IS NULL ORDER BY e.created_at DESC LIMIT 30"),
  query("SELECT COUNT(*) AS total FROM device_events WHERE severity='critical' AND device_id IS NOT NULL AND acknowledged_at IS NULL")
 ]);
 res.json({open:Number(count.rows[0].total),items:items.rows});
 }catch(e){next(e)}});

router.post("/alerts/ack-all",requireAdminWrite,async(req,res,next)=>{try{
 const r=await query("UPDATE device_events SET acknowledged_at=NOW(3),acknowledged_by=? WHERE severity='critical' AND device_id IS NOT NULL AND acknowledged_at IS NULL",[req.admin.id]);
 res.json({ok:true,acknowledged:r.rowCount});
 }catch(e){next(e)}});

router.post("/alerts/:id/ack",requireAdminWrite,async(req,res,next)=>{try{
 const r=await query("UPDATE device_events SET acknowledged_at=NOW(3),acknowledged_by=? WHERE id=? AND acknowledged_at IS NULL",[req.admin.id,req.params.id]);
 res.json({ok:true,acknowledged:r.rowCount});
 }catch(e){next(e)}});

// Resumo de navegação por computador no período (1, 7 ou 30 dias).
router.get("/browsing/summary",async(req,res,next)=>{try{
 const days=[1,7,30].includes(Number(req.query.days))?Number(req.query.days):1;
 const r=await query("SELECT d.id AS deviceId,d.device_name AS deviceName,d.windows_username AS username,COUNT(b.id) AS visits,COUNT(DISTINCT b.hostname) AS sites,MAX(b.occurred_at) AS lastVisit,SUM(CASE WHEN b.id IS NOT NULL AND (b.decision='blocked' OR EXISTS(SELECT 1 FROM web_rules w WHERE w.enabled=1 AND w.action='block' AND (b.hostname=w.hostname OR b.hostname LIKE CONCAT('%.',w.hostname)))) THEN 1 ELSE 0 END) AS blockedVisits,SUM(CASE WHEN b.decision='blocked' THEN 1 ELSE 0 END) AS blockedAttempts FROM devices d LEFT JOIN browsing_events b ON b.device_id=d.id AND b.occurred_at>NOW(3)-INTERVAL ? DAY WHERE d.status='active' GROUP BY d.id,d.device_name,d.windows_username ORDER BY d.device_name",[days]);
 res.json({days,items:r.rows});
 }catch(e){next(e)}});

// Visitas de um computador, com pesquisa por site, título ou endereço.
router.get("/browsing",async(req,res,next)=>{try{
 const days=[1,7,30].includes(Number(req.query.days))?Number(req.query.days):1;
 const deviceId=String(req.query.deviceId||"");
 if(!deviceId)return res.status(400).json({message:"Informe o computador."});
 const q=String(req.query.q||"").trim().slice(0,100);
 const like="%"+q.replace(/[\\%_]/g,m=>"\\"+m)+"%";
 const onlyBlocked=req.query.blocked==="1";
 const filter=(q?" AND (b.hostname LIKE ? OR b.page_title LIKE ? OR b.url LIKE ?)":"")+(onlyBlocked?" AND (b.decision='blocked' OR EXISTS(SELECT 1 FROM web_rules w WHERE w.enabled=1 AND w.action='block' AND (b.hostname=w.hostname OR b.hostname LIKE CONCAT('%.',w.hostname))))":"");
 const params=q?[deviceId,days,like,like,like]:[deviceId,days];
 const [items,top]=await Promise.all([
  query("SELECT b.occurred_at AS occurredAt,b.hostname,b.url,b.page_title AS title,b.browser,b.windows_user AS windowsUser,b.decision,(b.decision='blocked' OR EXISTS(SELECT 1 FROM web_rules w WHERE w.enabled=1 AND w.action='block' AND (b.hostname=w.hostname OR b.hostname LIKE CONCAT('%.',w.hostname)))) AS blocked FROM browsing_events b WHERE b.device_id=? AND b.occurred_at>NOW(3)-INTERVAL ? DAY"+filter+" ORDER BY b.occurred_at DESC LIMIT 300",params),
  query("SELECT b.hostname,COUNT(*) AS visits,MAX((b.decision='blocked' OR EXISTS(SELECT 1 FROM web_rules w WHERE w.enabled=1 AND w.action='block' AND (b.hostname=w.hostname OR b.hostname LIKE CONCAT('%.',w.hostname))))) AS blocked FROM browsing_events b WHERE b.device_id=? AND b.occurred_at>NOW(3)-INTERVAL ? DAY"+filter+" GROUP BY b.hostname ORDER BY visits DESC LIMIT 10",params)
 ]);
 res.json({days,items:items.rows,topSites:top.rows});
 }catch(e){next(e)}});

router.get("/browsing-events",async(req,res,next)=>{try{
 const limit=Math.min(500,Math.max(1,Number(req.query.limit)||100));
 const r=await query("SELECT b.id,b.hostname,b.decision,b.policy_revision AS policyRevision,b.rule_name AS ruleName,b.occurred_at AS occurredAt,d.device_name AS deviceName FROM browsing_events b JOIN devices d ON d.id=b.device_id ORDER BY b.occurred_at DESC LIMIT ?",[limit]);
 res.json({items:r.rows});
 }catch(e){next(e)}});

router.get("/certificates",async(req,res,next)=>{try{
 const r=await query("SELECT c.id,c.subject_name AS subjectName,c.issuer_name AS issuerName,c.serial_number AS serialNumber,c.thumbprint_sha1 AS thumbprintSha1,c.thumbprint_sha256 AS thumbprintSha256,c.not_before AS notBefore,c.not_after AS notAfter,c.store_name AS storeName,c.has_private_key AS hasPrivateKey,c.observed_at AS observedAt,c.device_id AS deviceId,d.device_name AS deviceName,d.windows_username AS username FROM installed_certificates c JOIN devices d ON d.id=c.device_id WHERE "+certVisibleSql("c")+" ORDER BY d.device_name,c.not_after");
 res.json({items:r.rows});
 }catch(e){next(e)}});

// Registro de uso dos certificados (Sites para certificados).
router.get("/certificate-usage",async(req,res,next)=>{try{
 const days=[1,7,30].includes(Number(req.query.days))?Number(req.query.days):7;
 const r=await query("SELECT e.id,e.device_id AS deviceId,d.device_name AS deviceName,e.event_type AS eventType,e.severity,e.title,e.message,e.details,e.created_at AS createdAt FROM device_events e JOIN devices d ON d.id=e.device_id WHERE e.event_type LIKE 'certificate\\_use\\_%' AND e.created_at>NOW(3)-INTERVAL ? DAY ORDER BY e.created_at DESC LIMIT 300",[days]);
 res.json({days,items:r.rows});
 }catch(e){next(e)}});

router.post("/enrollment-tokens",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({
  installationPassword:z.string().trim().min(8).max(128).refine(v=>/[A-Za-z]/.test(v)&&/\d/.test(v),"Use pelo menos 8 caracteres, incluindo letras e números."),
  expiresMinutes:z.number().int().refine(v=>v===0||(v>=5&&v<=1440),"Validade inválida.").default(60),
  installMode:z.enum(["certificate","certificate-and-web"]).default("certificate-and-web")
 }).strict().parse(req.body);

 const id=uuid(),minutes=x.expiresMinutes;

 await query("INSERT INTO enrollment_tokens(id,token_hash,created_by,expires_at,install_mode) VALUES(?,?,?,IF(?=0,TIMESTAMPADD(YEAR,100,NOW(3)),TIMESTAMPADD(MINUTE,?,NOW(3))),?)",[id,hashToken(x.installationPassword),req.admin.id,minutes,minutes,x.installMode]);

 await audit(null,"enrollment_created","Senha temporária de instalação criada","",{adminId:req.admin.id,expiresMinutes:minutes,installMode:x.installMode});

 res.status(201).json({
  created:true,
  expiresMinutes:minutes,
  singleUse:true,
  installMode:x.installMode,
  warning:"A senha não pode ser recuperada. Ela será consumida no primeiro cadastro."
 });
 }catch(e){next(e)}});

router.get("/policy",async(req,res,next)=>{try{
 const r=await query("SELECT revision,status,payload,signature,published_at AS publishedAt FROM policies WHERE status='published' ORDER BY revision DESC LIMIT 1");
 res.json(r.rows[0]||{revision:0,status:"draft",payload:{mode:"managed",webRules:[],certificateRules:[]}});
 }catch(e){next(e)}});

// Publica uma nova revisão assinada da política com as regras ativas.
// Os agentes consultam a API a cada ~45 s e aplicam a revisão mais recente.
async function publishPolicy(adminId){
 const result=await transaction(async tx=>{
  await tx.query("SELECT id FROM agent_policy_lock WHERE id=1 FOR UPDATE");

  const w=await tx.query("SELECT name,hostname,action,scope_type AS scopeType,scope_value AS scopeValue FROM web_rules WHERE enabled=1 ORDER BY hostname");
  const c=await tx.query("SELECT name,hostname,certificate_scope AS certificateScope FROM certificate_site_rules WHERE enabled=1 ORDER BY hostname");
  const rev=await tx.query("SELECT COALESCE(MAX(revision),0)+1 revision FROM policies");

  const payload={
   schemaVersion:1,
   product:"AGENTE COSTALOG",
   revision:Number(rev.rows[0].revision),
   issuedAt:new Date().toISOString(),
   mode:"managed",
   // Navegação: tudo liberado, exceto a lista de bloqueio.
   // Certificados: somente os sites autorizados (aplicação técnica ainda em desenvolvimento).
   defaults:{web:"allow",certificate:"deny"},
   webRules:w.rows,
   certificateRules:c.rows,
   allowedDestinations:w.rows.filter(rule=>rule.action==="allow").map(rule=>rule.hostname),
   deviceControls:await policyDeviceControls()
  };

  const signed=signPolicy(payload);

  await tx.query("INSERT INTO policies(revision,status,payload,signature,created_by) VALUES(?,'published',?,?,?)",[payload.revision,JSON.stringify(payload),signed.signature,adminId]);

  return{
   revision:payload.revision,
   webRules:w.rowCount,
   certificateRules:c.rowCount,
   publishedAt:new Date().toISOString()
  };
 });

 await audit(null,"policy_published","Política corporativa publicada","Revisão "+result.revision,{adminId,...result});
 return result;
}

// Publica após alterar regras sem impedir o salvamento da regra se a assinatura falhar.
async function autoPublish(adminId){
 try{const p=await publishPolicy(adminId);return{policyRevision:p.revision}}
 catch(e){console.error("AGENTE COSTALOG publicação automática falhou:",e.message);return{policyError:"Regra salva, mas a política não foi publicada: "+e.message}}
}

router.post("/policy/publish",requireAdminWrite,async(req,res,next)=>{try{
 const result=await publishPolicy(req.admin.id);
 res.json({...result,status:"published"});
 }catch(e){next(e)}});

router.get("/uninstall-requests",async(req,res,next)=>{try{
 const r=await query("SELECT u.id,u.device_id AS deviceId,d.device_name AS deviceName,u.request_reason AS reason,u.requested_by AS requestedBy,u.status,u.requested_at AS requestedAt FROM uninstall_requests u JOIN devices d ON d.id=u.device_id ORDER BY u.requested_at DESC LIMIT 100");
 res.json({items:r.rows});
 }catch(e){next(e)}});

router.post("/uninstall-requests/:id/review",requireAdminWrite,async(req,res,next)=>{try{
 const decision=z.enum(["approve","reject"]).parse(req.body.decision);

 const found=await query("SELECT * FROM uninstall_requests WHERE id=? AND status='pending'",[req.params.id]);

 if(!found.rowCount)return res.status(404).json({message:"Solicitação pendente não encontrada."});

 if(decision==="reject"){
  await query("UPDATE uninstall_requests SET status='rejected',reviewed_by=?,reviewed_at=NOW(3) WHERE id=?",[req.admin.id,req.params.id]);
  await audit(found.rows[0].device_id,"uninstall_rejected","Solicitação de desinstalação recusada","",{adminId:req.admin.id,requestId:req.params.id});
  return res.json({status:"rejected"});
 }

 const releaseToken=newToken(40);
 const expires=new Date(Date.now()+5*60*1000);
 const payload={
  purpose:"agent-uninstall",
  requestId:req.params.id,
  deviceId:found.rows[0].device_id,
  expiresAt:expires.toISOString(),
  nonce:newToken(16)
 };

 const signed=signReleaseApproval(payload);

 await query("UPDATE uninstall_requests SET status='approved',reviewed_by=?,reviewed_at=NOW(3),release_payload=?,release_expires_at=? WHERE id=?",[req.admin.id,JSON.stringify(signed),expires,req.params.id]);

 await audit(found.rows[0].device_id,"uninstall_approved","Autorização temporária de remoção emitida","",{adminId:req.admin.id,requestId:req.params.id,expiresAt:expires.toISOString()});

 res.json({
  status:"approved",
  signedApproval:signed,
  expiresAt:expires.toISOString(),
  warning:"Autorização assinada entregue ao dispositivo na próxima consulta; uso único."
 });
 }catch(e){next(e)}});

router.get("/uninstall-password",async(req,res,next)=>{try{
 const i=await getUninstallPasswordInfo();
 res.json({configured:i.configured,updatedAt:i.updatedAt});
 }catch(e){next(e)}});

router.put("/uninstall-password",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({password:z.string().min(8).max(128).refine(v=>/[A-Za-z]/.test(v)&&/\d/.test(v),"Use pelo menos 8 caracteres, com letras e números.")}).strict().parse(req.body);
 await setUninstallPassword(x.password,req.admin.id);
 await audit(null,"uninstall_password_changed","Senha de desinstalação alterada","",{adminId:req.admin.id});
 res.json({ok:true});
 }catch(e){next(e)}});

router.post("/devices/:id/uninstall",requireAdminWrite,async(req,res,next)=>{try{
 const d=await query("SELECT id,device_name AS deviceName FROM devices WHERE id=? AND status='active'",[req.params.id]);
 if(!d.rowCount)return res.status(404).json({message:"Computador não encontrado ou já removido."});
 const a=await createUninstallApproval(req.params.id,"Painel ("+(req.admin.username||"TI")+")","Desinstalação solicitada pelo painel",req.admin.id);
 await audit(req.params.id,"uninstall_approved","Desinstalação enviada pelo painel",d.rows[0].deviceName,{adminId:req.admin.id,requestId:a.requestId});
 res.json({ok:true,expiresAt:a.expiresAt,message:"O agente será removido na próxima comunicação do computador (até ~1 minuto)."});
 }catch(e){next(e)}});

// ===== Configurações gerais: e-mail, pendrive (USB), papel de parede =====
router.get("/email-settings",async(req,res,next)=>{try{
 res.json(await publicEmailConfig());
 }catch(e){next(e)}});

router.put("/email-settings",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({enabled:z.boolean().default(false),host:z.string().max(200).default(""),port:z.number().int().min(1).max(65535).default(587),secure:z.boolean().default(false),user:z.string().max(200).default(""),password:z.string().max(400).optional(),from:z.string().max(254).default(""),to:z.string().max(254).default("")}).strict().parse(req.body);
 await saveEmailConfig(x,req.admin.id);
 await audit(null,"email_settings_changed","Configuração de alertas por e-mail alterada","",{adminId:req.admin.id,enabled:x.enabled});
 res.json(await publicEmailConfig());
 }catch(e){next(e)}});

router.post("/email-settings/test",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({host:z.string().max(200).optional(),port:z.number().int().optional(),secure:z.boolean().optional(),user:z.string().max(200).optional(),password:z.string().max(400).optional(),from:z.string().max(254).optional(),to:z.string().max(254).optional()}).strict().parse(req.body||{});
 await sendTestEmail(x,req.admin.id);
 res.json({ok:true,message:"E-mail de teste enviado."});
 }catch(e){res.status(400).json({message:"Falha ao enviar: "+(e.message||"erro")})}});

router.get("/device-controls",async(req,res,next)=>{try{
 const c=await getDeviceControls();
 res.json({usbStorageBlock:!!c.usbStorageBlock,wallpaperEnabled:!!c.wallpaperEnabled,hasWallpaper:!!(c.wallpaperFile&&c.wallpaperSha256),updatedAt:c.updatedAt});
 }catch(e){next(e)}});

router.put("/device-controls/usb",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({enabled:z.boolean()}).strict().parse(req.body);
 await setUsbBlock(x.enabled,req.admin.id);
 const p=await publishPolicy(req.admin.id);
 await audit(null,"device_control_changed","Bloqueio de pendrive "+(x.enabled?"ativado":"desativado"),"",{adminId:req.admin.id});
 res.json({ok:true,enabled:x.enabled,policyRevision:p.revision});
 }catch(e){next(e)}});

router.put("/device-controls/wallpaper",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({image:z.string().min(100).max(12000000)}).strict().parse(req.body);
 const r=await setWallpaper(x.image,req.admin.id);
 const p=await publishPolicy(req.admin.id);
 await audit(null,"device_control_changed","Papel de parede padrão enviado","",{adminId:req.admin.id});
 res.json({ok:true,...r,policyRevision:p.revision});
 }catch(e){res.status(400).json({message:e.message||"Falha ao enviar a imagem."})}});

router.put("/device-controls/wallpaper-enabled",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({enabled:z.boolean()}).strict().parse(req.body);
 await setWallpaperEnabled(x.enabled,req.admin.id);
 const p=await publishPolicy(req.admin.id);
 res.json({ok:true,enabled:x.enabled,policyRevision:p.revision});
 }catch(e){next(e)}});

router.get("/settings",async(req,res,next)=>{try{
 const r=await query("SELECT setting_key AS key,setting_value AS value,updated_at AS updatedAt FROM agent_settings WHERE setting_key<>? ORDER BY setting_key",[UNINSTALL_SETTING]);
 res.json({items:r.rows});
 }catch(e){next(e)}});

router.put("/settings/:key",requireAdminWrite,async(req,res,next)=>{try{
 const key=z.string().regex(/^[a-z0-9_.-]{2,100}$/).refine(k=>k!==UNINSTALL_SETTING,"Use a rota própria da senha de desinstalação.").parse(req.params.key);
 const value=z.unknown().parse(req.body.value);

 await query("INSERT INTO agent_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=NOW(3)",[key,JSON.stringify(value),req.admin.id]);

 await audit(null,"setting_changed","Configuração administrativa alterada",key,{adminId:req.admin.id});

 res.json({ok:true,key,value});
 }catch(e){next(e)}});

router.get("/mail-integrations",async(req,res,next)=>{try{
 const r=await query("SELECT id,provider,mailbox,display_name AS displayName,status,scopes,last_sync_at AS lastSyncAt FROM mail_integrations ORDER BY mailbox");
 res.json({items:r.rows});
 }catch(e){next(e)}});

router.post("/mail-integrations",requireAdminWrite,async(req,res,next)=>{try{
 const x=z.object({
  provider:z.enum(["microsoft-graph","imap-oauth"]),
  mailbox:z.string().email().max(254),
  displayName:z.string().max(160).default(""),
  scopes:z.array(z.string().max(100)).max(20)
 }).strict().parse(req.body);

 const id=uuid();

 await query("INSERT INTO mail_integrations(id,provider,mailbox,display_name,status,scopes) VALUES(?,?,?,?,'pending',?)",[id,x.provider,x.mailbox,x.displayName,JSON.stringify(x.scopes)]);

 await audit(null,"mail_integration_created","Integração de caixa autorizada para configuração",x.mailbox,{adminId:req.admin.id,provider:x.provider,scopes:x.scopes});

 res.status(201).json({id,...x,status:"pending"});
 }catch(e){next(e)}});

async function audit(deviceId,eventType,title,message,details){
 await query("INSERT INTO device_events(id,device_id,event_type,severity,title,message,details) VALUES(?,?,?,?,?,?,?)",[uuid(),deviceId,eventType,"info",title,message,JSON.stringify(details||{})]);
}

export default router;
