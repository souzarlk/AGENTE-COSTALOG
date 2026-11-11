import "dotenv/config";
import fs from "node:fs/promises";
import {query,closePool} from "../src/db.js";
const sql=await fs.readFile(new URL("../migrations/001_init.sql",import.meta.url),"utf8");
const statements=sql.replace(/^\s*--.*$/gm,"").split(";").map(s=>s.trim()).filter(Boolean);
try{for(const statement of statements)await query(statement);console.log("Migração MariaDB 001 aplicada/verificada.")}finally{await closePool()}
