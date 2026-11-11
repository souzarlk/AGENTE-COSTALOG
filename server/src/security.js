import crypto from "node:crypto";
const pepper=()=>{const v=process.env.DEVICE_TOKEN_PEPPER;if(!v||v.length<32)throw new Error("DEVICE_TOKEN_PEPPER deve conter pelo menos 32 caracteres.");return v};
export function hashToken(value){return crypto.createHmac("sha256",pepper()).update(String(value)).digest("hex")}
export function newToken(bytes=32){return crypto.randomBytes(bytes).toString("base64url")}
export function verifyCentralToken(token){
 const secret=process.env.CENTRAL_ADMIN_AUTH_SECRET;if(!secret||secret.length<32)throw new Error("Identidade central não configurada.");
 const parts=String(token||"").split(".");if(parts.length!==3)throw new Error("Token inválido.");
 const input=parts[0]+"."+parts[1],expected=crypto.createHmac("sha256",secret).update(input).digest("base64url");
 const a=Buffer.from(expected),b=Buffer.from(parts[2]);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error("Assinatura inválida.");
 const header=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")),claims=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
 if(header.alg!=="HS256"||header.typ!=="JWT")throw new Error("Algoritmo não aceito.");
 if(claims.iss!==(process.env.CENTRAL_TOKEN_ISSUER||"costalog-central-notas-fiscais"))throw new Error("Emissor não aceito.");
 const now=Math.floor(Date.now()/1000);if(!claims.sub||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60)throw new Error("Sessão expirada ou inválida.");
 return claims;
}
export function signPolicy(payload){const keyText=process.env.POLICY_SIGNING_PRIVATE_KEY_BASE64;if(!keyText)throw new Error("Chave privada de assinatura de política não configurada.");const key=crypto.createPrivateKey(Buffer.from(keyText,"base64").toString("utf8"));const signature=crypto.sign("RSA-SHA256",Buffer.from(JSON.stringify(payload)),key).toString("base64url");return{payload,signature,algorithm:"RSA-SHA256"}}
export function signReleaseApproval(payload){return signPolicy(payload)}
