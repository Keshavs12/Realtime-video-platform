import http from "node:http";
import app from "./app";
import { initSocketServer, closeRedisClients } from "./socket";
import { logger } from "./utils/logger";
import { prisma } from "./config/prisma";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO server
const io = initSocketServer(server);

server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});

// Graceful Shutdown Handlers for Zero-Downtime Deployments
const gracefulShutdown = async (signal: string) => {
    logger.info(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

    // 10-second safety fallback timeout to avoid hanging indefinitely
    const forceExitTimeout = setTimeout(() => {
        logger.error("[Shutdown] Timed out waiting for connections to close. Forcing exit.");
        process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    try {
        // 1. Close Socket.IO connections cleanly
        await new Promise<void>((resolve) => {
            io.close(() => {
                logger.info("[Shutdown] Socket.IO server closed.");
                resolve();
            });
        });

        // 2. Stop accepting new HTTP requests
        await new Promise<void>((resolve) => {
            server.close(() => {
                logger.info("[Shutdown] HTTP server closed.");
                resolve();
            });
        });

        // 3. Drain and disconnect database connection pool
        await prisma.$disconnect();
        logger.info("[Shutdown] Prisma database connection pool closed.");

        // 4. Disconnect Redis pub/sub clients if active
        await closeRedisClients();
        logger.info("[Shutdown] Redis connections closed.");

        logger.info("[Shutdown] Graceful shutdown completed cleanly. Exiting.");
        process.exit(0);
    } catch (err) {
        logger.error({ err }, "[Shutdown] Error occurred during graceful shutdown");
        process.exit(1);
    }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));