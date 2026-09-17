import http from "node:http";
import app from "./app";
import { initSocketServer } from "./socket";
import { logger } from "./utils/logger";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO server
initSocketServer(server);

server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});