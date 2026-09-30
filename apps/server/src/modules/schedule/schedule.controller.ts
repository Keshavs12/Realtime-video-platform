import { asyncHandler } from "../../utils/asyncHandler";
import * as scheduleService from "./schedule.service";

export const createMeeting = asyncHandler(async (req, res) => {
    const rawOrigin = req.body?.frontendUrl || req.get("origin") || req.get("referer");
    let clientOrigin: string | undefined;
    if (rawOrigin) {
        try {
            clientOrigin = new URL(rawOrigin).origin;
        } catch {
            clientOrigin = String(rawOrigin).replace(/\/+$/, "");
        }
    }

    const meeting = await scheduleService.createScheduledMeeting(
        req.user!.userId,
        req.user!.email,
        req.user!.name || "SuperCall Host",
        req.body,
        clientOrigin
    );

    res.status(201).json({
        success: true,
        message: "Meeting scheduled and email invitations sent successfully.",
        data: meeting,
    });
});

export const getMeetings = asyncHandler(async (req, res) => {
    const meetings = await scheduleService.getScheduledMeetings(
        req.user!.userId,
        req.user!.email
    );

    res.status(200).json({
        success: true,
        data: meetings,
    });
});

export const deleteMeeting = asyncHandler(async (req, res) => {
    await scheduleService.deleteScheduledMeeting(
        String(req.params.id),
        req.user!.userId
    );

    res.status(200).json({
        success: true,
        message: "Scheduled meeting cancelled successfully.",
    });
});

export const sendReminders = asyncHandler(async (req, res) => {
    const rawOrigin = req.body?.frontendUrl || req.get("origin") || req.get("referer");
    let clientOrigin: string | undefined;
    if (rawOrigin) {
        try {
            clientOrigin = new URL(rawOrigin).origin;
        } catch {
            clientOrigin = String(rawOrigin).replace(/\/+$/, "");
        }
    }

    const result = await scheduleService.sendMeetingReminders(
        String(req.params.id),
        req.user!.userId,
        req.user!.name || "SuperCall Host",
        clientOrigin
    );

    res.status(200).json({
        success: true,
        message: `Reminders sent to ${result.sent} invitees.`,
        data: result,
    });
});
