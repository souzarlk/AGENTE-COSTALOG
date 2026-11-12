// Desinstalação autorizada do agente: por senha (definida no painel) ou pelo painel.
import crypto from "node:crypto";
import {promisify} from "node:util";
import {query} from "./db.js";
import {newToken,signReleaseApproval,verifyAdminPassword} from "./security.js";

const scrypt=promisify(crypto.scrypt);
const SETTING="uninstall_password";

export async function hashSecret(password){
 const salt=crypto.randomBytes(16);
 const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return ["scrypt",32768,8,1,salt.toString("base64url"),Buffer.from(key).toString("base64url")].join("$");
}

export async function getUninstallPasswordInfo(){
 const r=await query("SELECT setting_value AS value,updated_at AS updatedAt FROM agent_settings WHERE setting_key=?",[SETTING]);
 if(!r.rowCount)return{configured:false,hash:null,updatedAt:null};
 const v=r.rows[0].value;
 const hash=typeof v==="string"?JSON.parse(v).hash:v?.hash;
 return{configured:!!hash,hash:hash||null,updatedAt:r.rows[0].updatedAt};
}

export async function setUninstallPassword(password,adminId){
 const hash=await hashSecret(password);
 await query("INSERT INTO agent_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=NOW(3)",[SETTING,JSON.stringify({hash}),adminId]);
}

export async function checkUninstallPassword(password){
 const info=await getUninstallPasswordInfo();
 if(!info.configured)return{configured:false,ok:false};
 return{configured:true,ok:await verifyAdminPassword(password,info.hash)};
}

// Cria uma autorização assinada, de uso único e válida por 10 minutos.
export async function createUninstallApproval(deviceId,requestedBy,reason,adminId,deliveredNow=false){
 const id=crypto.randomUUID();
 const expires=new Date(Date.now()+10*60*1000);
 const payload={purpose:"agent-uninstall",requestId:id,deviceId,expiresAt:expires.toISOString(),nonce:newToken(16)};
 const signed=signReleaseApproval(payload);
 await query("INSERT INTO uninstall_requests(id,device_id,request_reason,requested_by,status,reviewed_by,reviewed_at,release_payload,release_expires_at,delivered_at) VALUES(?,?,?,?,'approved',?,NOW(3),?,?,?)",[id,deviceId,reason.slice(0,1000),requestedBy.slice(0,160),adminId,JSON.stringify(signed),expires,deliveredNow?new Date():null]);
 return{requestId:id,signed,expiresAt:expires.toISOString()};
}

export const UNINSTALL_SETTING=SETTING;
