
import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import {
  newToken,
  hashAdminSessionToken,
  verifyAdminPassword
} from "../security.js";
import { requireAdmin } from "../middleware.js";

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(1).max(200)
});

// =====================================================
// LOGIN ADMINISTRATIVO
// =====================================================

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const username = data.username.toLowerCase();

    const result = await query(
      `SELECT
        id,
        username,
        display_name AS displayName,
        password_hash AS passwordHash,
        role,
        active
      FROM admin_accounts
      WHERE username = ?
      LIMIT 1`,
      [username]
    );

    const account = result.rows[0];

    if (
      !account ||
      !account.active ||
      !(await verifyAdminPassword(data.password, account.passwordHash))
    ) {
      return res.status(401).json({
        error: "invalid_credentials",
        message: "Usuário ou senha incorretos."
      });
    }

    if (account.role !== "admin") {
      return res.status(403).json({
        error: "admin_required",
        message: "Esta conta não possui permissão administrativa."
      });
    }

    const token = newToken(32);
    const tokenHash = hashAdminSessionToken(token);
    const sessionId = crypto.randomUUID();

    await query(
      `INSERT INTO admin_sessions (
        id,
        admin_id,
        token_hash,
        expires_at
      ) VALUES (
        ?,
        ?,
        ?,
        DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 8 HOUR)
      )`,
      [sessionId, account.id, tokenHash]
    );

    await query(
      "UPDATE admin_accounts SET last_seen_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [account.id]
    );

    res.status(200).json({
      authenticated: true,
      token,
      expiresIn: 28800,
      admin: {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        role: account.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// ENCERRAMENTO DA SESSÃO
// =====================================================

router.post("/logout", requireAdmin, async (req, res, next) => {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : "";

    await query(
      `UPDATE admin_sessions
       SET revoked_at = UTC_TIMESTAMP(3)
       WHERE token_hash = ?
         AND revoked_at IS NULL`,
      [hashAdminSessionToken(token)]
    );

    res.status(200).json({
      authenticated: false,
      message: "Sessão encerrada com sucesso."
    });
  } catch (error) {
    next(error);
  }
});

export default router;
