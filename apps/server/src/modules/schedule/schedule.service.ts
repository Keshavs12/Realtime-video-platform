import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { emailService } from "../../services/email.service";
import os from "os";

export const getLanIpAddress = (): string | null => {
    try {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            const netList = interfaces[name];
            if (!netList) continue;
            for (const net of netList) {
                if (
                    net.family === "IPv4" &&
                    !net.internal &&
                    !net.address.startsWith("172.17.") &&
                    !net.address.startsWith("172.18.")
                ) {
                    return net.address;
                }
            }
        }
    } catch {
        // Fallback if network interfaces cannot be read
    }
    return null;
};

export const resolveAppUrl = (clientOrigin?: string): string => {
    const envUrl = process.env.FRONTEND_URL || process.env.APP_URL;

    // 1. If an explicit clientOrigin was sent that is NOT localhost (e.g. domain, tunnel, public IP)
    if (clientOrigin && !clientOrigin.includes("localhost") && !clientOrigin.includes("127.0.0.1")) {
        return clientOrigin.replace(/\/+$/, "");
    }

    // 2. If FRONTEND_URL or APP_URL is configured in server .env
    if (envUrl) {
        return envUrl.replace(/\/+$/, "");
    }

    // 3. If clientOrigin was localhost or missing, resolve to host machine's LAN IP so recipients can access
    const lanIp = getLanIpAddress();
    if (lanIp) {
        return `http://${lanIp}:3000`;
    }

    return clientOrigin ? clientOrigin.replace(/\/+$/, "") : "http://localhost:3000";
};

export interface CreateScheduledMeetingInput {
    title: string;
    description?: string;
    scheduledAt: string | Date;
    durationMinutes?: number;
    invitees?: string[] | string;
}

export const createScheduledMeeting = async (
    userId: string,
    userEmail: string,
    userName: string,
    input: CreateScheduledMeetingInput,
    clientOrigin?: string
) => {
    const { title, description, scheduledAt, durationMinutes = 30, invitees = [] } = input;

    if (!title || !title.trim()) {
        throw new AppError("Meeting title is required.", 400);
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
        throw new AppError("Invalid scheduled date and time.", 400);
    }

    // Generate clean room code
    const roomCode = `room-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // Parse and sanitize invitee emails
    let inviteeList: string[] = [];
    if (Array.isArray(invitees)) {
        inviteeList = invitees.map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    } else if (typeof invitees === "string") {
        inviteeList = invitees
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    }
    inviteeList = Array.from(new Set(inviteeList));

    // Pre-create the Room so it's recognized by signaling
    await prisma.room.create({
        data: {
            code: roomCode,
            hostId: userId,
        },
    });

    // Create the ScheduledMeeting record
    const meeting = await prisma.scheduledMeeting.create({
        data: {
            title: title.trim(),
            description: description?.trim() || null,
            roomCode,
            scheduledAt: scheduledDate,
            durationMinutes: Number(durationMinutes) || 30,
            hostId: userId,
            invitees: inviteeList.join(","),
        },
        include: {
            host: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    // Send email invitations via Nodemailer (using reachable URL)
    const appUrl = resolveAppUrl(clientOrigin);
    const meetingUrl = `${appUrl}/dashboard/room/${roomCode}`;

    let emailsSent = 0;
    if (inviteeList.length > 0) {
        const sendResult = await emailService.sendMeetingInvite({
            to: inviteeList,
            hostName: userName || "SuperCall Host",
            meetingTitle: title.trim(),
            meetingDescription: description?.trim(),
            roomCode,
            scheduledAt: scheduledDate,
            durationMinutes: Number(durationMinutes) || 30,
            meetingUrl,
        });
        emailsSent = sendResult.sent;
    }

    return {
        ...meeting,
        inviteeList,
        emailsSent,
        meetingUrl,
    };
};

export const getScheduledMeetings = async (userId: string, userEmail: string) => {
    const meetings = await prisma.scheduledMeeting.findMany({
        where: {
            OR: [
                { hostId: userId },
                { invitees: { contains: userEmail } },
            ],
        },
        orderBy: {
            scheduledAt: "asc",
        },
        include: {
            host: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    const appUrl = resolveAppUrl();

    return meetings.map((m) => {
        const inviteeList = m.invitees ? m.invitees.split(",").map((e) => e.trim()).filter(Boolean) : [];
        return {
            ...m,
            inviteeList,
            isHost: m.hostId === userId,
            meetingUrl: `${appUrl}/dashboard/room/${m.roomCode}`,
        };
    });
};

export const deleteScheduledMeeting = async (meetingId: string, userId: string) => {
    const meeting = await prisma.scheduledMeeting.findUnique({
        where: { id: meetingId },
    });

    if (!meeting) {
        throw new AppError("Scheduled meeting not found.", 404);
    }

    if (meeting.hostId !== userId) {
        throw new AppError("Only the meeting host can cancel this scheduled meeting.", 403);
    }

    await prisma.scheduledMeeting.delete({
        where: { id: meetingId },
    });

    return true;
};

export const sendMeetingReminders = async (
    meetingId: string,
    userId: string,
    userName: string,
    clientOrigin?: string
) => {
    const meeting = await prisma.scheduledMeeting.findUnique({
        where: { id: meetingId },
    });

    if (!meeting) {
        throw new AppError("Scheduled meeting not found.", 404);
    }

    if (meeting.hostId !== userId) {
        throw new AppError("Only the meeting host can send reminders.", 403);
    }

    const inviteeList = meeting.invitees ? meeting.invitees.split(",").map((e) => e.trim()).filter(Boolean) : [];
    if (inviteeList.length === 0) {
        return { sent: 0, failed: 0 };
    }

    const appUrl = resolveAppUrl(clientOrigin);
    const meetingUrl = `${appUrl}/dashboard/room/${meeting.roomCode}`;

    return await emailService.sendMeetingInvite({
        to: inviteeList,
        hostName: userName || "SuperCall Host",
        meetingTitle: `Reminder: ${meeting.title}`,
        meetingDescription: meeting.description || undefined,
        roomCode: meeting.roomCode,
        scheduledAt: meeting.scheduledAt,
        durationMinutes: meeting.durationMinutes,
        meetingUrl,
    });
};
