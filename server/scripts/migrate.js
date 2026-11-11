import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {query,closePool} from "../src/db.js";

const directory=fileURLToPath(new URL("../migrations/",import.meta.url));
const entries=(await fs.readdir(directory))
 .filter(name=>/^\d+_[a-z0-9_-]+\.sql$/i.test(name))
 .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));

try{
 for(const file of entries){
  const sql=await fs.readFile(path.join(directory,file),"utf8");
  const statements=sql.replace(/^\s*--.*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean);
  for(const statement of statements) await query(statement);
  console.log("Migração aplicada/verificada: "+file);
 }
}finally{
 await closePool();
}
