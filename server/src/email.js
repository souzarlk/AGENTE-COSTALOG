// Alertas por e-mail: configuração SMTP (guardada no painel), teste de envio e
// um laço que envia e-mail para a TI a cada evento crítico novo.
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import {query} from "./db.js";

const SETTING = "email_alerts";

// Config no banco (agent_settings). A senha nunca é devolvida ao painel.
export async function getEmailConfig() {
  const r = await query("SELECT setting_value AS value,updated_at AS updatedAt FROM agent_settings WHERE setting_key=?", [SETTING]);
  if (!r.rowCount) return null;
  const v = typeof r.rows[0].value === "string" ? JSON.parse(r.rows[0].value) : r.rows[0].value;
  return { ...v, updatedAt: r.rows[0].updatedAt };
}

export async function publicEmailConfig() {
  const c = await getEmailConfig();
  if (!c) return { enabled: false, configured: false };
  return {
    enabled: !!c.enabled,
    configured: true,
    host: c.host || "",
    port: c.port || 587,
    secure: !!c.secure,
    user: c.user || "",
    from: c.from || "",
    to: c.to || "",
    hasPassword: !!c.password,
    updatedAt: c.updatedAt
  };
}

export async function saveEmailConfig(input, adminId) {
  const current = (await getEmailConfig()) || {};
  // Se o painel não envia senha nova, mantém a atual.
  const password = input.password && input.password.length ? input.password : current.password || "";
  const value = {
    enabled: !!input.enabled,
    host: String(input.host || "").trim(),
    port: Number(input.port) || 587,
    secure: !!input.secure,
    user: String(input.user || "").trim(),
    password,
    from: String(input.from || "").trim(),
    to: String(input.to || "").trim()
  };
  await query(
    "INSERT INTO agent_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,NOW(3)) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=NOW(3)",
    [SETTING, JSON.stringify(value), adminId]
  );
  return value;
}

function buildTransport(c) {
  if (!c || !c.host || !c.from || !c.to) throw new Error("Configuração de e-mail incompleta (servidor, remetente e destinatário são obrigatórios).");
  return nodemailer.createTransport({
    host: c.host,
    port: Number(c.port) || 587,
    secure: !!c.secure,
    auth: c.user ? { user: c.user, pass: c.password || "" } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000
  });
}

export async function sendTestEmail(overrides, adminId) {
  const saved = (await getEmailConfig()) || {};
  const c = { ...saved, ...overrides };
  if (overrides && (!overrides.password || !overrides.password.length)) c.password = saved.password;
  const transport = buildTransport(c);
  await transport.sendMail({
    from: c.from,
    to: c.to,
    subject: "AGENTE COSTALOG — e-mail de teste",
    text: "Este é um e-mail de teste do AGENTE COSTALOG. Se você recebeu, os alertas por e-mail estão configurados corretamente."
  });
  return true;
}

function severityLabel(s) {
  return s === "critical" ? "CRÍTICO" : s === "warning" ? "Atenção" : "Informação";
}

async function sendAlertEmail(c, event) {
  const transport = buildTransport(c);
  const device = event.deviceName || "computador";
  await transport.sendMail({
    from: c.from,
    to: c.to,
    subject: `AGENTE COSTALOG — Alerta ${severityLabel(event.severity)}: ${event.title}`,
    text:
      `Alerta ${severityLabel(event.severity)} no AGENTE COSTALOG\n\n` +
      `Computador: ${device}\n` +
      `Alerta: ${event.title}\n` +
      `Detalhe: ${event.message || "-"}\n` +
      `Quando: ${new Date(event.createdAt).toLocaleString("pt-BR")}\n\n` +
      `Abra o painel do AGENTE COSTALOG para ver os detalhes.`
  });
}

// Laço: pega eventos críticos ainda não enviados por e-mail e envia.
let running = false;
export async function processEmailQueue() {
  if (running) return;
  running = true;
  try {
    const c = await getEmailConfig();
    if (!c || !c.enabled) return;

    // Eventos críticos de dispositivo, recentes, que ainda não têm entrega registrada.
    const events = await query(
      `SELECT e.id,e.device_id AS deviceId,d.device_name AS deviceName,e.severity,e.title,e.message,e.created_at AS createdAt
       FROM device_events e JOIN devices d ON d.id=e.device_id
       WHERE e.severity='critical' AND e.created_at>NOW(3)-INTERVAL 1 DAY
         AND NOT EXISTS (SELECT 1 FROM alert_deliveries a WHERE a.event_id=e.id AND a.channel='email')
       ORDER BY e.created_at ASC LIMIT 20`
    );

    for (const ev of events.rows) {
      const id = crypto.randomUUID();
      // Reserva a entrega antes de enviar, para não mandar duplicado se houver dois processos.
      try {
        await query(
          "INSERT INTO alert_deliveries(id,event_id,channel,destination,status) VALUES(?,?,'email',?,'sending')",
          [id, ev.id, c.to.slice(0, 254)]
        );
      } catch {
        continue; // outra instância já pegou este evento
      }
      try {
        await sendAlertEmail(c, ev);
        await query("UPDATE alert_deliveries SET status='sent',sent_at=NOW(3) WHERE id=?", [id]);
      } catch (error) {
        await query("UPDATE alert_deliveries SET status='failed',attempts=attempts+1,last_error=? WHERE id=?", [String(error.message || error).slice(0, 1000), id]);
      }
    }
  } catch (error) {
    console.error("AGENTE COSTALOG fila de e-mail falhou:", error.message);
  } finally {
    running = false;
  }
}

export const EMAIL_SETTING = SETTING;
