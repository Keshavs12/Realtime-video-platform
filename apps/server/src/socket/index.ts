import { Server as HttpServer } from "node:http";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { isOriginAllowed } from "../config/cors";
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

export interface WhiteboardPoint {
    x: number;
    y: number;
}

export interface WhiteboardElement {
    id: string;
    type: "path" | "line" | "rect" | "circle";
    tool: "pen" | "highlighter" | "eraser" | "line" | "rect" | "circle";
    color: string;
    size: number;
    points?: WhiteboardPoint[];
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    userId?: string;
}

// In-memory whiteboard elements history per room (up to 2000 elements)
const roomWhiteboardHistory = new Map<string, WhiteboardElement[]>();


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
            origin: (origin, callback) => {
                if (isOriginAllowed(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error(`Origin ${origin} not allowed by CORS`));
                }
            },
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

    // Enforce JWT authentication on registered users, or support Guest users (Google Meet style)
    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace("Bearer ", "");

            if (!token) {
                const guestName = (socket.handshake.auth?.guestName as string) || "Guest";
                socket.data.userId = `guest-${crypto.randomUUID().slice(0, 8)}`;
                socket.data.name = guestName.trim() || "Guest";
                socket.data.email = "";
                socket.data.isGuest = true;
                return next();
            }

            const payload = verifyAccessToken(token);
            socket.data.userId = payload.userId;
            socket.data.name = payload.name;
            socket.data.email = payload.email;
            socket.data.isGuest = false;

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
            console.warn("Token verification failed or expired; falling back gracefully to guest session:", err);
            const guestName = (socket.handshake.auth?.guestName as string) || "Guest";
            socket.data.userId = `guest-${crypto.randomUUID().slice(0, 8)}`;
            socket.data.name = guestName.trim() || "Guest";
            socket.data.email = "";
            socket.data.isGuest = true;
            next();
        }
    });

    // Closes out the caller's currently-open RoomParticipant row (if any) for
    // a given room code, so history/stats reflect that they actually left.
    const closeOpenParticipation = async (roomCode: string, userId: string) => {
        if (!userId || userId.startsWith("guest-")) return;
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

    // Set of currently locked rooms (in-memory, synchronized across sockets)
    const lockedRooms = new Set<string>();

    const resolveJoinUserName = async (
        socket: any,
        userId: string,
        payloadName?: string
    ): Promise<string | undefined> => {
        if (!socket.data.name && payloadName) {
            socket.data.name = payloadName;
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
        return name;
    };

    const evictStaleSockets = async (
        targetIo: Server,
        currentSocket: any,
        roomId: string,
        userId: string
    ) => {
        const existingSockets = await targetIo.in(roomId).fetchSockets();
        const staleSockets = existingSockets.filter((s) => s.data.userId === userId && s.id !== currentSocket.id);
        if (staleSockets.length > 0) {
            await Promise.all(
                staleSockets.map(async (s) => {
                    console.log(`🧹 Removing stale socket ${s.id} for user ${userId} from room ${roomId}`);
                    s.leave(roomId);
                    currentSocket.to(roomId).emit("user-left", {
                        socketId: s.id,
                        userId,
                    });
                    await closeOpenParticipation(roomId, userId);
                })
            );
        }
    };

    const getRoomPeerUsers = async (
        targetIo: Server,
        roomId: string,
        currentSocketId: string,
        currentUserId: string
    ) => {
        const sockets = await targetIo.in(roomId).fetchSockets();
        const seenUsers = new Set<string>();
        const usersInRoom: { socketId: string; userId: string; name?: string; isHost?: boolean }[] = [];

        for (const s of sockets) {
            const peerUserId = s.data.userId as string;
            if (s.id !== currentSocketId && peerUserId && peerUserId !== currentUserId && !seenUsers.has(peerUserId)) {
                seenUsers.add(peerUserId);
                usersInRoom.push({
                    socketId: s.id,
                    userId: peerUserId,
                    name: s.data.name as string | undefined,
                    isHost: s.data.isHost as boolean | undefined,
                });
            }
        }
        return usersInRoom;
    };

    const replayChatHistory = async (targetSocket: any, roomDbId: string) => {
        try {
            const history = await prisma.chatMessage.findMany({
                where: { roomId: roomDbId },
                orderBy: { createdAt: "asc" },
                take: 200,
                include: { user: { select: { name: true } } },
            });

            targetSocket.emit("chat-history", {
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
    };

    // Register event handlers
    io.on("connection", (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // 1. Join Room
        socket.on("join-room", async (payload: JoinRoomPayload) => {
            const { roomId } = payload;
            const userId = socket.data.userId as string;

            const name = await resolveJoinUserName(socket, userId, payload?.name);

            if (!userId) {
                console.warn(`⚠️ Rejected join-room: unauthenticated socket ${socket.id}`);
                socket.emit("error", { message: "Authentication required" });
                return;
            }

            const room = await prisma.room.findUnique({ where: { code: roomId } });
            if (!room) {
                console.warn(`⚠️ Rejected join-room for unknown room code: ${roomId}`);
                socket.emit("room-not-found", { roomId });
                return;
            }

            const isHost = room.hostId === userId;
            if (lockedRooms.has(roomId) && !isHost) {
                console.warn(`🔒 Rejected join-room: room ${roomId} is locked by host`);
                socket.emit("room-locked", {
                    roomId,
                    message: "This room is currently locked by the host. Please ask the host to unlock.",
                });
                return;
            }

            await evictStaleSockets(io, socket, roomId, userId);

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

            socket.data.roomId = roomId;
            socket.data.roomDbId = room.id;
            socket.data.isHost = isHost;

            await socket.join(roomId);
            if (!socket.data.isGuest) {
                try {
                    await prisma.roomParticipant.create({
                        data: { roomId: room.id, userId },
                    });
                } catch (dbErr) {
                    console.error("Failed to record room participant in DB:", dbErr);
                }
            }
            console.log(`🚪 User ${userId} (${name || "Guest"})${isHost ? " [HOST]" : ""} joined room: ${roomId}`);

            socket.emit("room-info", {
                roomId,
                isHost,
                isLocked: lockedRooms.has(roomId),
                hostId: room.hostId,
            });

            socket.to(roomId).emit("user-joined", {
                socketId: socket.id,
                userId,
                name,
                isHost,
            });

            const usersInRoom = await getRoomPeerUsers(io, roomId, socket.id, userId);
            socket.emit("room-users", {
                roomId,
                users: usersInRoom,
            });

            await replayChatHistory(socket, room.id);
        });

        // 1b. Update participant display name (e.g. guest sets name in Green Room lobby)
        socket.on("update-name", ({ name }: { name: string }) => {
            if (name && typeof name === "string" && name.trim()) {
                const cleanName = name.trim();
                socket.data.name = cleanName;
                const roomId = socket.data.roomId;
                if (roomId) {
                    console.log(`👤 User ${socket.data.userId} updated name to: ${cleanName} in room ${roomId}`);
                    io.in(roomId).emit("user-name-updated", {
                        socketId: socket.id,
                        userId: socket.data.userId,
                        name: cleanName,
                    });
                }
            }
        });

        // 2. Leave Room
        const handleLeaveRoom = async () => {
            const { roomId, userId } = socket.data;

            if (roomId && userId) {
                console.log(`🚪 User ${userId} leaving room: ${roomId}`);
                await socket.leave(roomId);

                // Broadcast user-left to others in the room
                socket.to(roomId).emit("user-left", {
                    socketId: socket.id,
                    userId,
                });

                await closeOpenParticipation(roomId, userId);

                // Clear room info from socket.data while preserving authenticated user identity
                socket.data.roomId = undefined;
                socket.data.roomDbId = undefined;

                // Clean up whiteboard history if room stays empty for 5 minutes
                const remainingSockets = await io.in(roomId).fetchSockets();
                if (remainingSockets.length === 0) {
                    setTimeout(async () => {
                        const check = await io.in(roomId).fetchSockets();
                        if (check.length === 0) {
                            roomWhiteboardHistory.delete(roomId);
                        }
                    }, 5 * 60 * 1000);
                }
            }
        };

        socket.on("leave-room", () => {
            void handleLeaveRoom().catch((err) => console.error("Error handling leave-room:", err));
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

        // 3c. Host Controls (Lock Room, Mute Participant, Mute All, Kick Participant)
        socket.on("toggle-room-lock", () => {
            const { roomId, isHost } = socket.data;
            if (!roomId || !isHost) {
                socket.emit("error", { message: "Only the room host can lock or unlock the room" });
                return;
            }

            const currentlyLocked = lockedRooms.has(roomId);
            if (currentlyLocked) {
                lockedRooms.delete(roomId);
            } else {
                lockedRooms.add(roomId);
            }
            const isLocked = !currentlyLocked;

            console.log(`🔒 Room ${roomId} lock toggled by host: isLocked = ${isLocked}`);
            io.to(roomId).emit("room-lock-changed", { roomId, isLocked });
        });

        socket.on("host-mute-peer", (payload: { targetSocketId: string }) => {
            const { roomId, isHost } = socket.data;
            if (!roomId || !isHost) {
                socket.emit("error", { message: "Only the room host can mute participants" });
                return;
            }
            const { targetSocketId } = payload;
            if (!targetSocketId) return;

            console.log(`🔇 Host ${socket.id} muted participant ${targetSocketId} in room ${roomId}`);
            io.to(targetSocketId).emit("muted-by-host", {
                roomId,
                message: "You were muted by the meeting host.",
            });
        });

        socket.on("host-mute-all", () => {
            const { roomId, isHost } = socket.data;
            if (!roomId || !isHost) {
                socket.emit("error", { message: "Only the room host can mute all participants" });
                return;
            }

            console.log(`🔇 Host ${socket.id} muted all participants in room ${roomId}`);
            socket.to(roomId).emit("muted-by-host", {
                roomId,
                message: "All participants were muted by the meeting host.",
            });
        });

        socket.on("host-kick-peer", async (payload: { targetSocketId: string }) => {
            const { roomId, isHost } = socket.data;
            if (!roomId || !isHost) {
                socket.emit("error", { message: "Only the room host can remove participants" });
                return;
            }
            const { targetSocketId } = payload;
            if (!targetSocketId || targetSocketId === socket.id) return;

            const targetSockets = await io.in(roomId).fetchSockets();
            const target = targetSockets.find((s) => s.id === targetSocketId);

            if (target) {
                console.log(`🚫 Host ${socket.id} kicked participant ${targetSocketId} (${target.data.userId}) from room ${roomId}`);
                target.emit("kicked-by-host", {
                    roomId,
                    message: "You have been removed from the meeting by the host.",
                });

                // Evict target socket from room and close DB participation
                target.leave(roomId);
                socket.to(roomId).emit("user-left", {
                    socketId: target.id,
                    userId: target.data.userId,
                });
                if (target.data.userId) {
                    await closeOpenParticipation(roomId, target.data.userId);
                }
                target.data.roomId = undefined;
            }
        });

        // 3d. Raise Hand Interaction
        socket.on("toggle-raise-hand", (payload: { isRaised: boolean }) => {
            const { roomId, userId, name } = socket.data;
            if (!roomId || !userId) return;

            io.to(roomId).emit("peer-hand-toggled", {
                socketId: socket.id,
                userId,
                name: name || "Guest",
                isRaised: Boolean(payload?.isRaised),
            });
        });

        // 3e. Floating Emoji Reactions
        socket.on("send-reaction", (payload: { emoji: string }) => {
            if (isRateLimited("reaction", 5, 2000)) {
                return; // Silently drop excess rapid reactions
            }
            const { roomId, name } = socket.data;
            const emoji = String(payload?.emoji || "").trim();
            if (!roomId || !emoji) return;

            io.to(roomId).emit("reaction-received", {
                id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                emoji,
                fromSocketId: socket.id,
                fromName: name || "Guest",
            });
        });

        // 3f. Screen Share Status Notification
        socket.on("screen-share-status", (payload: { isSharing: boolean }) => {
            const { roomId, userId, name } = socket.data;
            if (!roomId) return;

            socket.to(roomId).emit("peer-screen-share", {
                socketId: socket.id,
                userId,
                name: name || "Guest",
                isSharing: Boolean(payload?.isSharing),
            });
        });

        // 3g. Real-Time Collaborative Whiteboard
        socket.on("whiteboard-draw", (payload: {
            prevX: number;
            prevY: number;
            currX: number;
            currY: number;
            color: string;
            size: number;
            tool: string;
        }) => {
            const { roomId } = socket.data;
            if (!roomId || !payload) return;
            // Broadcast live streaming line segment to all other peers in the room
            socket.to(roomId).emit("whiteboard-draw", payload);
        });

        socket.on("whiteboard-element-add", (element: WhiteboardElement) => {
            const { roomId, userId } = socket.data;
            if (!roomId || !element) return;

            element.userId = userId;
            let history = roomWhiteboardHistory.get(roomId);
            if (!history) {
                history = [];
                roomWhiteboardHistory.set(roomId, history);
            }
            history.push(element);
            if (history.length > 2000) {
                history.shift();
            }

            // Broadcast newly completed element to other peers
            socket.to(roomId).emit("whiteboard-element-add", element);
        });

        socket.on("whiteboard-undo", () => {
            const { roomId } = socket.data;
            if (!roomId) return;
            const history = roomWhiteboardHistory.get(roomId);
            if (history && history.length > 0) {
                history.pop();
                io.to(roomId).emit("whiteboard-history", { elements: history });
            }
        });

        socket.on("whiteboard-clear", () => {
            const { roomId } = socket.data;
            if (!roomId) return;
            roomWhiteboardHistory.set(roomId, []);
            io.to(roomId).emit("whiteboard-clear");
        });

        socket.on("whiteboard-request-history", () => {
            const { roomId } = socket.data;
            if (!roomId) return;
            const history = roomWhiteboardHistory.get(roomId) || [];
            socket.emit("whiteboard-history", { elements: history });
        });

        // 4. Disconnect
        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
            void handleLeaveRoom().catch((err) => console.error("Error handling disconnect cleanup:", err));
        });
    });

    return io;
};
