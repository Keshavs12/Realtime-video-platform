import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import routes from "./routes";
import { logger } from "./utils/logger";
import cookieParser from "cookie-parser";
import { prisma } from "./config/prisma";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { allowedOrigins } from "./config/cors";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(pinoHttp({ logger }));

app.use(express.json());
app.use(cookieParser());

// Deep Health Check Endpoints (for Load Balancers, Docker, and K8s)
const healthHandler = async (_req: express.Request, res: express.Response) => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - start;
    const memory = process.memoryUsage();

    res.status(200).json({
      status: "healthy",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: "connected",
        dbLatencyMs,
        memory: {
          rssMb: Math.round(memory.rss / 1024 / 1024),
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        },
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Health check probe failed");
    res.status(503).json({
      status: "unhealthy",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: "disconnected",
        error: err?.message || "Database connection error",
      },
    });
  }
};

app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;