
import "dotenv/config";
import crypto from "node:crypto";
import readline from "node:readline";
import { stdin, stdout } from "node:process";

import { query, closePool } from "../src/db.js";
import { hashAdminPassword } from "../src/security.js";

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      return reject(
        new Error("Execute este cadastro diretamente no terminal do VS Code.")
      );
    }

    stdout.write(question);

    let value = "";

    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");

      if (error) reject(error);
      else resolve(value);
    };

    const onData = (buffer) => {
      for (const char of buffer.toString("utf8")) {
        if (char === "\u0003") {
          finish(new Error("Cadastro cancelado."));
          return;
        }

        if (char === "\r" || char === "\n") {
          finish();
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        if (char >= " " && char !== "\u007f") {
          value += char;
        }
      }
    };

    stdin.resume();
    stdin.setRawMode(true);
    stdin.on("data", onData);
  });
}

async function main() {
  console.log("\n======================================");
  console.log("   CADASTRO DO ADMINISTRADOR");
  console.log("       AGENTE COSTALOG");
  console.log("======================================\n");

  const username = (await ask("Usuário: ")).toLowerCase();

  if (!/^[a-z0-9._-]{3,80}$/.test(username)) {
    throw new Error(
      "Usuário inválido. Utilize de 3 a 80 caracteres: letras, números, ponto, hífen ou underline."
    );
  }

  const displayName = await ask("Nome de exibição: ");

  if (!displayName || displayName.length > 160) {
    throw new Error("Informe um nome de exibição válido.");
  }

  const password = await askHidden("Senha (não será exibida): ");

  if (password.length < 12 || password.length > 200) {
    throw new Error("A senha deve ter entre 12 e 200 caracteres.");
  }

  const confirmation = await askHidden("Confirme a senha: ");

  if (password !== confirmation) {
    throw new Error("As senhas não coincidem.");
  }

  const existing = await query(
    "SELECT id FROM admin_accounts WHERE username = ? LIMIT 1",
    [username]
  );

  if (existing.rows.length > 0) {
    throw new Error("Este usuário já está cadastrado.");
  }

  const passwordHash = await hashAdminPassword(password);
  const id = crypto.randomUUID();

  await query(
    `INSERT INTO admin_accounts (
      id,
      username,
      display_name,
      password_hash,
      role,
      active
    ) VALUES (?, ?, ?, ?, 'admin', 1)`,
    [id, username, displayName, passwordHash]
  );

  console.log("\nAdministrador criado com sucesso!");
  console.log("Usuário:", username);
  console.log("Nome:", displayName);
  console.log("Permissão: administrador");
}

try {
  await main();
} catch (error) {
  console.error("\nNão foi possível criar o administrador:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
