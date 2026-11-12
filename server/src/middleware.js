
import { query } from "./db.js";
import {
  hashToken,
  hashAdminSessionToken
} from "./security.js";

// =====================================================
// AUTENTICAÇÃO ADMINISTRATIVA DO AGENTE COSTALOG
// =====================================================

export async function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Sessão administrativa necessária."
    });
  }

  try {
    const tokenHash = hashAdminSessionToken(token);

    const result = await query(
      `SELECT
        a.id,
        a.username,
        a.display_name AS displayName,
        a.role
      FROM admin_sessions s
      INNER JOIN admin_accounts a ON a.id = s.admin_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP(3)
        AND a.active = 1
      LIMIT 1`,
      [tokenHash]
    );

    const admin = result.rows[0];

    if (!admin) {
      return res.status(401).json({
        error: "invalid_session",
        message: "Sessão inválida ou expirada. Entre novamente no AGENTE COSTALOG."
      });
    }

    req.admin = {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role
    };

    await query(
      "UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP(3) WHERE token_hash = ?",
      [tokenHash]
    );

    await query(
      "UPDATE admin_accounts SET last_seen_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [admin.id]
    );

    next();
  } catch (error) {
    next(error);
  }
}

// =====================================================
// AUTORIZAÇÃO DE OPERAÇÕES ADMINISTRATIVAS
// =====================================================

export function requireAdminWrite(req, res, next) {
  if (!req.admin || req.admin.role !== "admin") {
    return res.status(403).json({
      message: "Operação administrativa não autorizada."
    });
  }

  next();
}

// =====================================================
// AUTENTICAÇÃO DOS COMPUTADORES
// Mantida separada do login administrativo.
// =====================================================

export async function requireDevice(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Credencial do dispositivo necessária."
    });
  }

  try {
    const result = await query(
      `SELECT
        id,
        device_name AS deviceName,
        install_mode AS installMode,
        status,
        policy_revision AS policyRevision
      FROM devices
      WHERE token_hash = ?`,
      [hashToken(token)]
    );

    const device = result.rows[0];

    if (!device || device.status !== "active") {
      return res.status(401).json({
        message: "Dispositivo revogado ou não autorizado."
      });
    }

    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
}

// =====================================================
// TRATAMENTO CENTRALIZADO DE ERROS
// =====================================================

export function errorHandler(err, req, res, next) {
  if (err?.name === "ZodError") {
    return res.status(400).json({
      error: "validation_error",
      message: "Dados enviados inválidos.",
      issues: err.issues
    });
  }

  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      error: "duplicate",
      message: "Registro duplicado."
    });
  }

  console.error(
    "AGENTE COSTALOG API",
    req.id,
    err?.message
  );

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: "internal_error",
    message:
      err.status && err.status < 500
        ? err.message
        : "Erro interno. Informe o identificador de requisição à TI.",
    requestId: req.id
  });
}
