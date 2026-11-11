import { z } from "zod";

export const createMeetingSchema = z.object({
    title: z.string().trim().min(1, "Meeting title is required").max(200, "Title is too long"),
    description: z.string().trim().max(1000).optional(),
    scheduledAt: z.string().datetime({ offset: true }).or(z.string().min(1, "Invalid date format")),
    durationMinutes: z.number().int().min(5).max(720).optional().default(30),
    invitees: z.union([z.array(z.string()), z.string()]).optional().default([]),
    frontendUrl: z.string().url().optional(),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

