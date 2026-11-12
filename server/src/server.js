
import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { query, closePool } from "./db.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import deviceRoutes from "./routes/device.js";
import { errorHandler } from "./middleware.js";

const app = express();

app.disable("x-powered-by");

app.set(
  "trust proxy",
  process.env.TRUST_PROXY === "true" ? 1 : false
);

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

const origins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(v => v.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) {
        return cb(null, true);
      }

      const error = new Error("Origem não autorizada.");
      error.status = 403;
      cb(error);
    },
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id"
    ],
    credentials: false,
    maxAge: 600
  })
);

app.use(express.json({
  limit: "1mb",
  strict: true
}));

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use(
  "/api/",
  rateLimit({
    windowMs: 60000,
    limit: 5000,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

// =====================================================
// SAÚDE DA API
// =====================================================

app.get("/api/v1/health", async (req, res, next) => {
  try {
    await query("SELECT 1");

    res.json({
      status: "ok",
      service: "agente-costalog-api",
      time: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// AUTENTICAÇÃO ADMINISTRATIVA
// =====================================================

app.use(
  "/api/v1/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "too_many_login_attempts",
      message: "Muitas tentativas de acesso. Aguarde 15 minutos."
    },
    skipSuccessfulRequests: true
  })
);

app.use("/api/v1/auth", authRoutes);

// =====================================================
// PAINEL ADMINISTRATIVO
// =====================================================

app.use("/api/v1/admin", adminRoutes);

// =====================================================
// DISPOSITIVOS
// =====================================================

app.use(
  "/api/v1/device/enroll",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "too_many_enrollment_attempts",
      message: "Muitas tentativas de instalação. Aguarde antes de tentar novamente."
    }
  })
);

app.use("/api/v1/device", deviceRoutes);

// =====================================================
// ROTAS NÃO ENCONTRADAS
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    error: "not_found",
    message: "Rota não encontrada.",
    requestId: req.id
  });
});

app.use(errorHandler);

// =====================================================
// INICIALIZAÇÃO
// =====================================================

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";

const server = app.listen(port, host, async () => {
  try {
    await query("SELECT 1");

    console.log(
      "AGENTE COSTALOG API online em " + host + ":" + port
    );
  } catch (error) {
    console.error("Banco indisponível:", error.message);
    server.close(() => process.exit(1));
  }
});

async function shutdown(signal) {
  console.log("Encerrando:", signal);

  server.close(async () => {
    await closePool();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
