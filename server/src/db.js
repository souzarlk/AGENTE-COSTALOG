import mysql from "mysql2/promise";
const required=["DB_HOST","DB_USER","DB_PASSWORD","DB_NAME"];
const missing=required.filter(k=>!process.env[k]||/REPLACE_WITH|CHANGE_ME/i.test(process.env[k]));
if(missing.length)throw new Error("Variáveis MariaDB ausentes ou inválidas: "+missing.join(", "));
const port=Number(process.env.DB_PORT||3306);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error("DB_PORT inválida.");
const pool=mysql.createPool({host:process.env.DB_HOST,port,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,waitForConnections:true,connectionLimit:Math.max(2,Number(process.env.DB_POOL_MAX||10)),queueLimit:0,connectTimeout:10000,timezone:"Z",charset:"utf8mb4",decimalNumbers:true,ssl:process.env.DB_SSL==="true"?{rejectUnauthorized:true}:undefined});
pool.on("connection",c=>{c.query("SET time_zone = '+00:00'");});
function normalize(rows){return rows.map(row=>{const out={...row};for(const k of ["metadata","payload","snapshot","details","config","network","scopes","setting_value"]){if(typeof out[k]==="string"){try{out[k]=JSON.parse(out[k])}catch{}}}for(const k of ["enabled","active","approved"]){if(k in out)out[k]=Boolean(out[k])}return out})}
// MariaDB não aceita datas ISO com "Z" ou fuso (ex.: 2026-11-12T11:00:00.000Z).
// Converte esses textos em Date; com timezone "Z" o mysql2 grava em UTC.
const isoDate=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;
function toDbParams(params){return (params||[]).map(v=>{if(typeof v==="string"&&isoDate.test(v)){const d=new Date(v);if(!Number.isNaN(d.getTime()))return d}return v})}
export async function query(sql,params=[]){const [result]=await pool.execute(sql,toDbParams(params));if(Array.isArray(result)){const rows=normalize(result);return{rows,rowCount:rows.length}}return{rows:[],rowCount:Number(result.affectedRows||0),insertId:result.insertId}}
export async function transaction(fn){const c=await pool.getConnection();try{await c.beginTransaction();const result=await fn({query:async(sql,p=[])=>{const [r]=await c.execute(sql,toDbParams(p));return Array.isArray(r)?{rows:normalize(r),rowCount:r.length}:{rows:[],rowCount:Number(r.affectedRows||0),insertId:r.insertId}}});await c.commit();return result}catch(e){await c.rollback();throw e}finally{c.release()}}
export async function closePool(){await pool.end()}
