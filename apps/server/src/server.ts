import http from "http";
import app from "./app";
import { initSocketServer } from "./socket";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO server
initSocketServer(server);

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});