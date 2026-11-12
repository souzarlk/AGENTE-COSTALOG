// Versões do agente publicadas para atualização automática.
// Cada versão é um arquivo server/agent-releases/costalog-agent-X.Y.Z.zip
// gerado por windows-agent/installer/Publish-AgentRelease.ps1.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const pattern=/^costalog-agent-(\d+)\.(\d+)\.(\d+)\.zip$/;
const hashCache=new Map();

export function releasesDir(){
 return path.resolve(process.env.AGENT_RELEASES_DIR||"agent-releases");
}

export function compareVersions(a,b){
 const pa=String(a||"0").split(".").map(n=>parseInt(n,10)||0);
 const pb=String(b||"0").split(".").map(n=>parseInt(n,10)||0);
 for(let i=0;i<3;i++){
  const d=(pa[i]||0)-(pb[i]||0);
  if(d!==0)return d;
 }
 return 0;
}

function sha256File(file){
 return new Promise((resolve,reject)=>{
  const hash=crypto.createHash("sha256");
  fs.createReadStream(file).on("error",reject).on("data",d=>hash.update(d)).on("end",()=>resolve(hash.digest("hex")));
 });
}

export async function latestRelease(){
 let files;
 try{files=await fs.promises.readdir(releasesDir())}catch{return null}
 const releases=files
  .map(file=>{const m=pattern.exec(file);return m?{file,version:`${Number(m[1])}.${Number(m[2])}.${Number(m[3])}`}:null})
  .filter(Boolean)
  .sort((a,b)=>compareVersions(b.version,a.version));
 if(!releases.length)return null;
 const latest=releases[0];
 const full=path.join(releasesDir(),latest.file);
 const stat=await fs.promises.stat(full);
 let cached=hashCache.get(full);
 if(!cached||cached.mtimeMs!==stat.mtimeMs||cached.size!==stat.size){
  cached={mtimeMs:stat.mtimeMs,size:stat.size,sha256:await sha256File(full)};
  hashCache.set(full,cached);
 }
 return{version:latest.version,file:full,size:cached.size,sha256:cached.sha256,publishedAt:new Date(stat.mtimeMs).toISOString()};
}
