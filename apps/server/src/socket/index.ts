import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { allowedOrigins } from "../config/cors";
import { prisma } from "../config/prisma";
import { verifyAccessToken } from "../utils/jwt";

let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;

/**
 * Cleanly closes active Redis pub/sub connections during graceful shutdown.
 */
export const closeRedisClients = async () => {
    if (redisPubClient) {
        await redisPubClient.quit();
        redisPubClient = null;
    }
    if (redisSubClient) {
        await redisSubClient.quit();
        redisSubClient = null;
    }
};

interface JoinRoomPayload {
    roomId: string;
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
        maxHttpBufferSize: 256 * 1024, // 256 KB max payload to prevent buffer overflow attacks
    });

    // Horizontal Scaling: Attach Redis Pub/Sub adapter if REDIS_URL is provided in environment.
    // Falls back gracefully to default in-memory adapter for local dev without errors.
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        try {
            redisPubClient = new Redis(redisUrl, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                lazyConnect: true,
            });
            redisSubClient = redisPubClient.duplicate();

            Promise.all([redisPubClient.connect(), redisSubClient.connect()])
                .then(() => {
                    io.adapter(createAdapter(redisPubClient!, redisSubClient!));
                    console.log("📡 Socket.IO Redis adapter connected for multi-instance horizontal scaling");
                })
                .catch((err) => {
                    console.warn(
                        `⚠️ Failed to connect to Redis for Socket.IO scaling, running on default in-memory adapter: ${err.message}`
                    );
                });
        } catch (err: any) {
            console.warn(`⚠️ Could not initialize Redis adapter, running in-memory: ${err.message}`);
        }
    } else {
        console.log("ℹ️ No REDIS_URL provided — running Socket.IO with default in-memory adapter");
    }

    // Enforce JWT authentication on every incoming socket connection
    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace("Bearer ", "");

            if (!token) {
                return next(new Error("Authentication error: Access token required"));
            }

            const payload = verifyAccessToken(token);
            socket.data.userId = payload.userId;
            socket.data.name = payload.name;
            socket.data.email = payload.email;

            // If name is missing from JWT payload (e.g. existing active session token), fetch from DB
            if (!socket.data.name && socket.data.userId) {
                try {
                    const user = await prisma.user.findUnique({
                        where: { id: socket.data.userId },
                        select: { name: true },
                    });
                    if (user?.name) {
                        socket.data.name = user.name;
                    }
                } catch (dbErr) {
                    console.error("Failed to load user name for socket:", dbErr);
                }
            }

            next();
        } catch (err) {
            console.warn(`🔒 Unauthorized socket connection attempt rejected: ${socket.id}`);
            return next(new Error("Authentication error: Invalid or expired token"));
        }
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
            const { roomId } = payload;
            const userId = socket.data.userId as string;

            if (!socket.data.name && payload?.name) {
                socket.data.name = payload.name;
            }

            let name = socket.data.name as string | undefined;
            if (!name && userId) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { name: true },
                    });
                    if (dbUser?.name) {
                        name = dbUser.name;
                        socket.data.name = dbUser.name;
                    }
                } catch (dbErr) {
                    console.error("Failed to load user name on join-room:", dbErr);
                }
            }

            if (!userId) {
                console.warn(`⚠️ Rejected join-room: unauthenticated socket ${socket.id}`);
                socket.emit("error", { message: "Authentication required" });
                return;
            }

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

            // Enforce room capacity limit (Full Mesh WebRTC cannot exceed 8 peers)
            const MAX_ROOM_CAPACITY = 8;
            const activeSockets = await io.in(roomId).fetchSockets();
            const activeUsers = new Set(activeSockets.map((s) => s.data.userId).filter(Boolean));
            if (!activeUsers.has(userId) && activeUsers.size >= MAX_ROOM_CAPACITY) {
                console.warn(`⚠️ Rejected join-room: room ${roomId} is full (${activeUsers.size}/${MAX_ROOM_CAPACITY})`);
                socket.emit("room-full", {
                    roomId,
                    maxCapacity: MAX_ROOM_CAPACITY,
                    message: "Room is full. Maximum participant limit reached.",
                });
                return;
            }

            // Store information on socket.data for cleanup on disconnect
            socket.data.roomId = roomId;
            socket.data.roomDbId = room.id;
            socket.data.isHost = room.hostId === userId;

            socket.join(roomId);
            try {
                await prisma.roomParticipant.create({
                    data: { roomId: room.id, userId },
                });
            } catch (dbErr) {
                console.error("Failed to record room participant in DB:", dbErr);
            }
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

            if (roomId && userId) {
                console.log(`🚪 User ${userId} leaving room: ${roomId}`);
                socket.leave(roomId);

                // Broadcast user-left to others in the room
                socket.to(roomId).emit("user-left", {
                    socketId: socket.id,
                    userId,
                });

                await closeOpenParticipation(roomId, userId);

                // Clear room info from socket.data while preserving authenticated user identity
                socket.data.roomId = undefined;
                socket.data.roomDbId = undefined;
            }
        };

        socket.on("leave-room", () => {
            handleLeaveRoom().catch((err) => console.error("Error handling leave-room:", err));
        });

        // Rate limiting helper using sliding window per socket
        const isRateLimited = (action: string, limit: number, windowMs: number): boolean => {
            if (!socket.data.rateLimits) {
                socket.data.rateLimits = new Map<string, number[]>();
            }

            const now = Date.now();
            const map = socket.data.rateLimits as Map<string, number[]>;
            const timestamps = (map.get(action) || []).filter((t) => now - t < windowMs);

            if (timestamps.length >= limit) {
                map.set(action, timestamps);
                return true;
            }

            timestamps.push(now);
            map.set(action, timestamps);
            return false;
        };

        // 3. WebRTC Signaling Relays (Enforce that sender is in an active room)
        socket.on("offer", (payload: { to: string; offer: any; userId?: string; name?: string }) => {
            if (!socket.data.roomId) return;
            if (isRateLimited("signaling", 60, 3000)) {
                socket.emit("rate-limit", { action: "offer", message: "Signaling rate limit exceeded. Please wait." });
                return;
            }
            const { to, offer } = payload;
            if (!to || !offer) return;
            io.to(to).emit("offer", {
                from: socket.id,
                offer,
                userId: socket.data.userId || payload.userId,
                name: socket.data.name || payload.name,
            });
        });

        socket.on("answer", (payload: { to: string; answer: any; userId?: string; name?: string }) => {
            if (!socket.data.roomId) return;
            if (isRateLimited("signaling", 60, 3000)) {
                socket.emit("rate-limit", { action: "answer", message: "Signaling rate limit exceeded. Please wait." });
                return;
            }
            const { to, answer } = payload;
            if (!to || !answer) return;
            io.to(to).emit("answer", {
                from: socket.id,
                answer,
                userId: socket.data.userId || payload.userId,
                name: socket.data.name || payload.name,
            });
        });

        socket.on("ice-candidate", (payload: { to: string; candidate: any }) => {
            if (!socket.data.roomId) return;
            if (isRateLimited("signaling", 60, 3000)) {
                socket.emit("rate-limit", { action: "ice-candidate", message: "Signaling rate limit exceeded. Please wait." });
                return;
            }
            const { to, candidate } = payload;
            if (!to || !candidate) return;
            io.to(to).emit("ice-candidate", {
                from: socket.id,
                candidate,
            });
        });

        // 3b. In-call text chat — persisted with rate limiting and payload length limits.
        socket.on("chat-message", (payload: { message: string }) => {
            if (isRateLimited("chat", 5, 3000)) {
                socket.emit("rate-limit", {
                    action: "chat-message",
                    message: "You are sending messages too fast. Please slow down.",
                });
                return;
            }

            const { roomId, roomDbId, userId, name } = socket.data;
            let message = String(payload?.message || "").trim();
            if (!roomId || !message) return;

            // Enforce maximum length of 1000 characters to prevent memory/bandwidth exhaustion
            if (message.length > 1000) {
                message = message.substring(0, 1000);
            }

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
