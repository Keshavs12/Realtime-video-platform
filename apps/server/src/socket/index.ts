import { Server as HttpServer } from "http";
import { Server } from "socket.io";

interface JoinRoomPayload {
    roomId: string;
    userId: string;
    name?: string;
}

/**
 * Initializes and configures the Socket.IO server.
 * Handles room management (join, leave, presence) and WebRTC signaling.
 *
 * @param server - The HTTP Server instance.
 * @returns The initialized Socket.IO Server instance.
 */
export const initSocketServer = (server: HttpServer): Server => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // Register event handlers
    io.on("connection", (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // 1. Join Room
        socket.on("join-room", async (payload: JoinRoomPayload) => {
            const { roomId, userId, name } = payload;

            // Store information on socket.data for cleanup on disconnect
            socket.data.roomId = roomId;
            socket.data.userId = userId;
            socket.data.name = name;

            socket.join(roomId);
            console.log(`🚪 User ${userId} (${name || "Guest"}) joined room: ${roomId}`);

            // Broadcast to other users in the room
            socket.to(roomId).emit("user-joined", {
                socketId: socket.id,
                userId,
                name,
            });

            // Fetch other sockets in the room for presence tracking
            const sockets = await io.in(roomId).fetchSockets();
            const usersInRoom = sockets
                .filter((s) => s.id !== socket.id)
                .map((s) => ({
                    socketId: s.id,
                    userId: s.data.userId as string,
                    name: s.data.name as string | undefined,
                }));

            // Return current list of users to the joiner
            socket.emit("room-users", {
                roomId,
                users: usersInRoom,
            });
        });

        // 2. Leave Room
        const handleLeaveRoom = () => {
            const { roomId, userId } = socket.data;

            if (roomId) {
                console.log(`🚪 User ${userId} leaving room: ${roomId}`);
                socket.leave(roomId);

                // Broadcast user-left to others in the room
                socket.to(roomId).emit("user-left", {
                    socketId: socket.id,
                    userId,
                });

                // Clear room info from socket.data
                socket.data.roomId = undefined;
                socket.data.userId = undefined;
                socket.data.name = undefined;
            }
        };

        socket.on("leave-room", handleLeaveRoom);

        // 3. WebRTC Signaling Relays
        socket.on("offer", (payload: { to: string; offer: any }) => {
            const { to, offer } = payload;
            io.to(to).emit("offer", {
                from: socket.id,
                offer,
            });
        });

        socket.on("answer", (payload: { to: string; answer: any }) => {
            const { to, answer } = payload;
            io.to(to).emit("answer", {
                from: socket.id,
                answer,
            });
        });

        socket.on("ice-candidate", (payload: { to: string; candidate: any }) => {
            const { to, candidate } = payload;
            io.to(to).emit("ice-candidate", {
                from: socket.id,
                candidate,
            });
        });

        // 4. Disconnect
        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
            handleLeaveRoom();
        });
    });

    return io;
};
