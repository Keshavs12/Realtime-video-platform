/**
 * --------------------------------------------------------------------------
 * Rooms Service
 * --------------------------------------------------------------------------
 *
 * Business logic for creating rooms and reading call history/stats derived
 * from Room + RoomParticipant rows. Room membership itself (join/leave) is
 * recorded from the socket layer (see src/socket/index.ts), not here.
 * --------------------------------------------------------------------------
 */
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

const generateRoomCode = () => Math.random().toString(36).substring(2, 10);

export const createRoom = async (hostId: string) => {
    // Extremely unlikely to collide, but retry on the off chance it does
    // rather than letting the unique constraint throw a raw 500.
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const existing = await prisma.room.findUnique({ where: { code } });
        if (!existing) {
            const room = await prisma.room.create({
                data: { code, hostId },
                select: { code: true, createdAt: true },
            });
            return room;
        }
    }
    throw new AppError("Could not generate a unique room code, please try again.", 500);
};

export const checkRoomExists = async (code: string) => {
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
        throw new AppError("Room not found.", 404);
    }
    return { code: room.code };
};

const minutesBetween = (start: Date, end: Date) => (end.getTime() - start.getTime()) / 60000;

export const getRoomHistory = async (userId: string) => {
    const participations = await prisma.roomParticipant.findMany({
        where: { userId },
        orderBy: { joinedAt: "desc" },
        include: { room: { select: { code: true, createdAt: true, hostId: true } } },
    });

    const now = new Date();

    return Promise.all(
        participations.map(async (p) => {
            const otherParticipants = await prisma.roomParticipant.findMany({
                where: { roomId: p.roomId, userId: { not: userId } },
                select: { userId: true },
                distinct: ["userId"],
            });

            return {
                roomCode: p.room.code,
                joinedAt: p.joinedAt,
                leftAt: p.leftAt,
                durationMinutes: Math.round(minutesBetween(p.joinedAt, p.leftAt ?? now)),
                isHost: p.room.hostId === userId,
                otherParticipantsCount: otherParticipants.length,
            };
        })
    );
};

export const getDashboardStats = async (userId: string) => {
    const now = new Date();

    const [roomsHosted, myParticipations, activeParticipations, hostedParticipants] = await Promise.all([
        prisma.room.count({ where: { hostId: userId } }),
        prisma.roomParticipant.findMany({
            where: { userId },
            select: { joinedAt: true, leftAt: true },
        }),
        prisma.roomParticipant.findMany({
            where: { userId, leftAt: null },
            select: { roomId: true },
            distinct: ["roomId"],
        }),
        prisma.roomParticipant.findMany({
            where: { room: { hostId: userId }, userId: { not: userId } },
            select: { userId: true },
            distinct: ["userId"],
        }),
    ]);

    const callMinutes = Math.round(
        myParticipations.reduce((sum, p) => sum + minutesBetween(p.joinedAt, p.leftAt ?? now), 0)
    );

    return {
        roomsHosted,
        callMinutes,
        activeNow: activeParticipations.length,
        totalParticipants: hostedParticipants.length,
    };
};
