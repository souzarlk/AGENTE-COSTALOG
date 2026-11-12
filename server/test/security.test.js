
import test from "node:test";
import assert from "node:assert/strict";

import {
  hashToken,
  hashAdminSessionToken,
  hashAdminPassword,
  verifyAdminPassword
} from "../src/security.js";

// Chaves fictícias utilizadas exclusivamente nos testes.
process.env.DEVICE_TOKEN_PEPPER =
  "test-device-token-pepper-at-least-32-characters";

process.env.ADMIN_SESSION_PEPPER =
  "test-admin-session-pepper-at-least-32-characters";

test("hash de token de dispositivo é determinístico", () => {
  const token = "token-de-teste-do-dispositivo";

  const firstHash = hashToken(token);
  const secondHash = hashToken(token);

  assert.equal(firstHash, secondHash);
  assert.equal(firstHash.length, 64);
  assert.notEqual(firstHash, token);
});

test("hash de sessão administrativa é determinístico", () => {
  const token = "token-de-teste-da-sessao-administrativa";

  const firstHash = hashAdminSessionToken(token);
  const secondHash = hashAdminSessionToken(token);

  assert.equal(firstHash, secondHash);
  assert.equal(firstHash.length, 64);
  assert.notEqual(firstHash, token);
});

test("senha administrativa correta é validada", async () => {
  const password = "StrongTestPassword123!";
  const passwordHash = await hashAdminPassword(password);

  assert.equal(
    await verifyAdminPassword(password, passwordHash),
    true
  );
});

test("senha administrativa incorreta é rejeitada", async () => {
  const passwordHash = await hashAdminPassword(
    "StrongTestPassword123!"
  );

  assert.equal(
    await verifyAdminPassword("SenhaIncorreta123!", passwordHash),
    false
  );
});

test("hash de senha utiliza scrypt", async () => {
  const passwordHash = await hashAdminPassword(
    "StrongTestPassword123!"
  );

  assert.equal(passwordHash.split("$")[0], "scrypt");
});

test("senhas administrativas curtas são rejeitadas", async () => {
  await assert.rejects(
    hashAdminPassword("senha123"),
    /entre 12 e 200 caracteres/
  );
});
