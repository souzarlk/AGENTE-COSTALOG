
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

function requiredSecret(name) {
  const value = process.env[name];

  if (!value || value.length < 32) {
    throw new Error(`${name} deve conter pelo menos 32 caracteres.`);
  }

  return value;
}

// =====================================================
// TOKENS DOS COMPUTADORES
// =====================================================

export function hashToken(value) {
  return crypto
    .createHmac("sha256", requiredSecret("DEVICE_TOKEN_PEPPER"))
    .update(String(value))
    .digest("hex");
}

export function newToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

// =====================================================
// SESSÕES ADMINISTRATIVAS DO AGENTE COSTALOG
// =====================================================

export function hashAdminSessionToken(value) {
  return crypto
    .createHmac("sha256", requiredSecret("ADMIN_SESSION_PEPPER"))
    .update(String(value))
    .digest("hex");
}

// =====================================================
// SENHAS DOS ADMINISTRADORES
// =====================================================

export async function hashAdminPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 200) {
    throw new Error("A senha administrativa deve ter entre 12 e 200 caracteres.");
  }

  const salt = crypto.randomBytes(16);
  const options = {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  };

  const derivedKey = await scrypt(password, salt, 64, options);

  return [
    "scrypt",
    options.N,
    options.r,
    options.p,
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url")
  ].join("$");
}

export async function verifyAdminPassword(password, storedHash) {
  try {
    if (typeof password !== "string" || typeof storedHash !== "string") {
      return false;
    }

    const parts = storedHash.split("$");

    if (parts.length !== 6 || parts[0] !== "scrypt") {
      return false;
    }

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);

    if (N !== 32768 || r !== 8 || p !== 1) {
      return false;
    }

    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");

    if (salt.length !== 16 || expected.length !== 64) {
      return false;
    }

    const actual = Buffer.from(
      await scrypt(password, salt, 64, {
        N,
        r,
        p,
        maxmem: 64 * 1024 * 1024
      })
    );

    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// =====================================================
// ASSINATURA DAS POLÍTICAS DO AGENTE
// =====================================================

export function signPolicy(payload) {
  const keyText = process.env.POLICY_SIGNING_PRIVATE_KEY_BASE64;

  if (!keyText) {
    throw new Error("Chave privada de assinatura de política não configurada.");
  }

  const key = crypto.createPrivateKey(
    Buffer.from(keyText, "base64").toString("utf8")
  );

  const signed = Buffer.from(JSON.stringify(payload));

  const signature = crypto
    .sign("RSA-SHA256", signed, key)
    .toString("base64");

  return {
    payload,
    signedPayload: signed.toString("base64"),
    signature,
    algorithm: "RSA-SHA256"
  };
}

export function signReleaseApproval(payload) {
  return signPolicy(payload);
}
