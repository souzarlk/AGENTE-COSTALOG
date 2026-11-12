// Controles aplicados nos computadores pela política assinada:
// bloqueio de pendrive (USB) e papel de parede padrão da empresa.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {query} from "./db.js";

const SETTING = "device_controls";

export function wallpaperDir() {
  return path.resolve(process.env.WALLPAPER_DIR || "wallpaper");
}

const DEFAULTS = { usbStorageBlock: false, wallpaperEnabled: false, wallpaperFile: "", wallpaperSha256: "" };

export async function getDeviceControls() {
  const r = await query("SELECT setting_value AS value,updated_at AS updatedAt FROM agent_settings WHERE setting_key=?", [SETTING]);
  if (!r.rowCount) return { ...DEFAULTS, updatedAt: null };
  const v = typeof r.rows[0].value === "string" ? JSON.parse(r.rows[0].value) : r.rows[0].value;
  return { ...DEFAULTS, ...v, updatedAt: r.rows[0].updatedAt };
}

async function save(value, adminId) {
  await query(
    "INSERT INTO agent_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=NOW(3)",
    [SETTING, JSON.stringify(value), adminId]
  );
}

export async function setUsbBlock(enabled, adminId) {
  const c = await getDeviceControls();
  const value = { usbStorageBlock: !!enabled, wallpaperEnabled: c.wallpaperEnabled, wallpaperFile: c.wallpaperFile, wallpaperSha256: c.wallpaperSha256 };
  await save(value, adminId);
  return value;
}

// Recebe a imagem em base64 (data URL ou puro). Guarda como arquivo e liga o papel de parede.
export async function setWallpaper(base64, adminId) {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(String(base64 || ""));
  const raw = m ? m[2] : String(base64 || "");
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length < 64) throw new Error("Imagem inválida.");
  if (buffer.length > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB.");
  // Confere a assinatura do arquivo (PNG ou JPEG).
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8;
  if (!isPng && !isJpg) throw new Error("Envie uma imagem PNG ou JPG.");

  fs.mkdirSync(wallpaperDir(), { recursive: true });
  const sha = crypto.createHash("sha256").update(buffer).digest("hex");
  const file = "wallpaper-" + sha.slice(0, 16) + (isPng ? ".png" : ".jpg");
  fs.writeFileSync(path.join(wallpaperDir(), file), buffer);

  const c = await getDeviceControls();
  const value = { usbStorageBlock: c.usbStorageBlock, wallpaperEnabled: true, wallpaperFile: file, wallpaperSha256: sha };
  await save(value, adminId);
  return { wallpaperSha256: sha, size: buffer.length };
}

export async function setWallpaperEnabled(enabled, adminId) {
  const c = await getDeviceControls();
  const value = { usbStorageBlock: c.usbStorageBlock, wallpaperEnabled: !!enabled, wallpaperFile: c.wallpaperFile, wallpaperSha256: c.wallpaperSha256 };
  await save(value, adminId);
  return value;
}

export function wallpaperPath(file) {
  if (!file || /[\\/]/.test(file)) return null;
  const full = path.join(wallpaperDir(), file);
  return full.startsWith(wallpaperDir()) && fs.existsSync(full) ? full : null;
}

// Bloco que entra na política assinada enviada ao agente.
export async function policyDeviceControls() {
  const c = await getDeviceControls();
  const hasWallpaper = c.wallpaperEnabled && c.wallpaperFile && c.wallpaperSha256;
  return {
    usbStorage: c.usbStorageBlock ? "block" : "allow",
    uninstallRequiresApproval: true,
    wallpaper: hasWallpaper
      ? { mode: "managed", sha256: c.wallpaperSha256, url: "api/v1/device/wallpaper" }
      : { mode: "user" }
  };
}

export const DEVICE_CONTROLS_SETTING = SETTING;
