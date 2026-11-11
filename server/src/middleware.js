import crypto from "node:crypto";
import {query} from "./db.js";
import {verifyCentralToken,hashToken} from "./security.js";
const uuidFromSubject=subject=>{const h=crypto.createHash("sha256").update("costalog-agent:"+subject).digest("hex").slice(0,32).split("");h[12]="5";h[16]=((parseInt(h[16],16)&3)|8).toString(16);const v=h.join("");return v.slice(0,8)+"-"+v.slice(8,12)+"-"+v.slice(12,16)+"-"+v.slice(16,20)+"-"+v.slice(20)};
export async function requireAdmin(req,res,next){
 const header=req.get("authorization")||"",token=header.startsWith("Bearer ")?header.slice(7):"";
 if(!token)return res.status(401).json({error:"unauthorized",message:"Sessão administrativa necessária."});
 try{
  const claims=verifyCentralToken(token);
  const allowedSubjects=String(process.env.CENTRAL_ADMIN_SUBJECTS||"").split(",").map(v=>v.trim()).filter(Boolean);
  if(!claims.sub||!allowedSubjects.includes(claims.sub))return res.status(403).json({error:"admin_required",message:"Esta conta não está autorizada para o painel do AGENTE COSTALOG. Solicite liberação à TI."});
  const id=uuidFromSubject(claims.sub);
  await query("INSERT INTO admin_identities(id,central_subject,display_name,last_seen_at) VALUES(?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),last_seen_at=VALUES(last_seen_at)",[id,claims.sub,String(claims.name||claims.sub).slice(0,160)]);
  req.admin={id,subject:claims.sub,role:"admin"};
  next();
 }catch(e){res.status(401).json({error:"invalid_session",message:"Sessão inválida ou expirada. Entre pela Central de Notas Fiscais."})}
}
export function requireAdminWrite(req,res,next){if(!req.admin||req.admin.role!=="admin")return res.status(403).json({message:"Operação administrativa não autorizada."});next()}
export async function requireDevice(req,res,next){const header=req.get("authorization")||"",token=header.startsWith("Bearer ")?header.slice(7):"";if(!token)return res.status(401).json({message:"Credencial do dispositivo necessária."});try{const r=await query("SELECT id,device_name AS deviceName,install_mode AS installMode,status,policy_revision AS policyRevision FROM devices WHERE token_hash=?",[hashToken(token)]);const d=r.rows[0];if(!d||d.status!=="active")return res.status(401).json({message:"Dispositivo revogado ou não autorizado."});req.device=d;next()}catch(e){next(e)}}
export function errorHandler(err,req,res,next){if(err?.name==="ZodError")return res.status(400).json({error:"validation_error",message:"Dados enviados inválidos.",issues:err.issues});if(err?.code==="ER_DUP_ENTRY")return res.status(409).json({error:"duplicate",message:"Registro duplicado."});console.error("AGENTE COSTALOG API",req.id,err?.message);if(res.headersSent)return next(err);res.status(err.status||500).json({error:"internal_error",message:err.status&&err.status<500?err.message:"Erro interno. Informe o identificador de requisição à TI.",requestId:req.id})}
