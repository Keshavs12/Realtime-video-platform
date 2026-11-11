import { z } from "zod";

export const summarizeMeetingSchema = z.object({
    roomId: z.string().trim().min(1, "Room ID is required"),
    transcriptHistory: z.array(
        z.object({
            speaker: z.string().optional().default("Speaker"),
            text: z.string(),
            timestamp: z.number().optional().default(Date.now),
        })
    ).optional().default([]),
    messages: z.array(
        z.object({
            name: z.string().optional(),
            message: z.string(),
            at: z.number().optional().default(Date.now),
        })
    ).optional().default([]),
    durationSeconds: z.number().nonnegative().optional().default(0),
});

export type SummarizeMeetingInput = z.infer<typeof summarizeMeetingSchema>;

