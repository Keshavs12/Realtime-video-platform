import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { allowedOrigins } from "../config/cors";
import { prisma } from "../config/prisma";

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
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // Closes out the caller's currently-open RoomParticipant row (if any) for
    // a given room code, so history/stats reflect that they actually left.
    const closeOpenParticipation = async (roomCode: string, userId: string) => {
        const room = await prisma.room.findUnique({ where: { code: roomCode } });
        if (!room) return;

        const openParticipation = await prisma.roomParticipant.findFirst({
            where: { roomId: room.id, userId, leftAt: null },
            orderBy: { joinedAt: "desc" },
        });

        if (openParticipation) {
            await prisma.roomParticipant.update({
                where: { id: openParticipation.id },
                data: { leftAt: new Date() },
            });
        }
    };

    // Register event handlers
    io.on("connection", (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // 1. Join Room
        socket.on("join-room", async (payload: JoinRoomPayload) => {
            const { roomId, userId, name } = payload;

            // The room must already exist (created via POST /api/v1/rooms) —
            // this is a safety net in case the client somehow skips that check.
            const room = await prisma.room.findUnique({ where: { code: roomId } });
            if (!room) {
                console.warn(`⚠️ Rejected join-room for unknown room code: ${roomId}`);
                socket.emit("room-not-found", { roomId });
                return;
            }

            // Evict any existing stale sockets for the same userId in this room
            const existingSockets = await io.in(roomId).fetchSockets();
            for (const s of existingSockets) {
                if (s.data.userId === userId && s.id !== socket.id) {
                    console.log(`🧹 Removing stale socket ${s.id} for user ${userId} from room ${roomId}`);
                    s.leave(roomId);
                    socket.to(roomId).emit("user-left", {
                        socketId: s.id,
                        userId,
                    });
                    await closeOpenParticipation(roomId, userId);
                }
            }

            // Store information on socket.data for cleanup on disconnect
            socket.data.roomId = roomId;
            socket.data.roomDbId = room.id;
            socket.data.userId = userId;
            socket.data.name = name;

            socket.join(roomId);
            await prisma.roomParticipant.create({
                data: { roomId: room.id, userId },
            });
            console.log(`🚪 User ${userId} (${name || "Guest"}) joined room: ${roomId}`);

            // Broadcast to other users in the room
            socket.to(roomId).emit("user-joined", {
                socketId: socket.id,
                userId,
                name,
            });

            // Fetch other sockets in the room for presence tracking
            const sockets = await io.in(roomId).fetchSockets();
            const seenUsers = new Set<string>();
            const usersInRoom: { socketId: string; userId: string; name?: string }[] = [];

            for (const s of sockets) {
                const peerUserId = s.data.userId as string;
                if (s.id !== socket.id && peerUserId && peerUserId !== userId && !seenUsers.has(peerUserId)) {
                    seenUsers.add(peerUserId);
                    usersInRoom.push({
                        socketId: s.id,
                        userId: peerUserId,
                        name: s.data.name as string | undefined,
                    });
                }
            }

            // Return current list of users to the joiner
            socket.emit("room-users", {
                roomId,
                users: usersInRoom,
            });

            // Replay persisted chat history so a page refresh (or a fresh
            // join) doesn't lose prior messages in this room.
            try {
                const history = await prisma.chatMessage.findMany({
                    where: { roomId: room.id },
                    orderBy: { createdAt: "asc" },
                    take: 200,
                    include: { user: { select: { name: true } } },
                });

                socket.emit("chat-history", {
                    messages: history.map((m) => ({
                        userId: m.userId,
                        name: m.user.name,
                        message: m.message,
                        at: m.createdAt.getTime(),
                    })),
                });
            } catch (err) {
                console.error("Failed to load chat history:", err);
            }
        });

        // 2. Leave Room
        const handleLeaveRoom = async () => {
            const { roomId, userId } = socket.data;

            if (roomId) {
                console.log(`🚪 User ${userId} leaving room: ${roomId}`);
                socket.leave(roomId);

                // Broadcast user-left to others in the room
                socket.to(roomId).emit("user-left", {
                    socketId: socket.id,
                    userId,
                });

                await closeOpenParticipation(roomId, userId);

                // Clear room info from socket.data
                socket.data.roomId = undefined;
                socket.data.roomDbId = undefined;
                socket.data.userId = undefined;
                socket.data.name = undefined;
            }
        };

        socket.on("leave-room", () => {
            handleLeaveRoom().catch((err) => console.error("Error handling leave-room:", err));
        });

        // 3. WebRTC Signaling Relays
        socket.on("offer", (payload: { to: string; offer: any; userId?: string; name?: string }) => {
            const { to, offer } = payload;
            io.to(to).emit("offer", {
                from: socket.id,
                offer,
                userId: payload.userId || socket.data.userId,
                name: payload.name || socket.data.name,
            });
        });

        socket.on("answer", (payload: { to: string; answer: any; userId?: string; name?: string }) => {
            const { to, answer } = payload;
            io.to(to).emit("answer", {
                from: socket.id,
                answer,
                userId: payload.userId || socket.data.userId,
                name: payload.name || socket.data.name,
            });
        });

        socket.on("ice-candidate", (payload: { to: string; candidate: any }) => {
            const { to, candidate } = payload;
            io.to(to).emit("ice-candidate", {
                from: socket.id,
                candidate,
            });
        });

        // 3b. In-call text chat — persisted so it survives a page refresh.
        socket.on("chat-message", (payload: { message: string }) => {
            const { roomId, roomDbId, userId, name } = socket.data;
            const message = String(payload?.message || "").trim();
            if (!roomId || !message) return;

            const at = Date.now();

            socket.to(roomId).emit("chat-message", {
                from: socket.id,
                userId,
                name,
                message,
                at,
            });

            if (roomDbId) {
                prisma.chatMessage
                    .create({ data: { roomId: roomDbId, userId, message } })
                    .catch((err) => console.error("Failed to persist chat message:", err));
            }
        });

        // 4. Disconnect
        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
            handleLeaveRoom().catch((err) => console.error("Error handling disconnect cleanup:", err));
        });
    });

    return io;
};
