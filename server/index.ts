import * as dotenv from "dotenv";
dotenv.config();

import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRouter } from "./router.js";
import { startScheduler } from "./scheduler.js";
import { processUpload } from "./upload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10mb" }));

// tRPC
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  })
);

// Upload planilha
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado" });
    return;
  }
  try {
    const result = await processUpload(req.file.buffer);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Servir frontend em produção
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "public");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] 🚀 Rodando na porta ${PORT}`);
  if (process.env.DATABASE_URL) {
    startScheduler();
  } else {
    console.warn("[Server] ⚠️  DATABASE_URL não definida — scheduler não iniciado");
  }
});
