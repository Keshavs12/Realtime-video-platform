import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { emailService } from "../../services/email.service";

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
    input: CreateScheduledMeetingInput
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

    // Send email invitations via Nodemailer
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
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

    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";

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

export const sendMeetingReminders = async (meetingId: string, userId: string, userName: string) => {
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

    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
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
