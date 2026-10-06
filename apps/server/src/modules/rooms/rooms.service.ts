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
import crypto from "node:crypto";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

const generateRoomCode = () => crypto.randomBytes(4).toString("hex");

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

export interface SummarizeMeetingInput {
    roomId: string;
    transcriptHistory?: { speaker: string; text: string; timestamp: number }[];
    messages?: { name?: string; message: string; at: number }[];
    durationSeconds?: number;
}

export interface MeetingSummaryOutput {
    executiveSummary: string;
    keyDecisions: string[];
    actionItems: { task: string; assignee: string }[];
    discussionTopics: string[];
    generatedBy: "gemini" | "heuristic";
}

export const summarizeMeeting = async (input: SummarizeMeetingInput): Promise<MeetingSummaryOutput> => {
    const transcript = input.transcriptHistory || [];
    const messages = input.messages || [];
    const duration = input.durationSeconds || 0;

    const fullTranscriptText = transcript
        .map((t) => `[${t.speaker}]: ${t.text}`)
        .join("\n");
    const fullChatText = messages
        .map((m) => `[${m.name || "Participant"}]: ${m.message}`)
        .join("\n");

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (geminiApiKey && (transcript.length > 0 || messages.length > 0)) {
        try {
            const prompt = `You are an expert AI meeting executive assistant. Analyze this meeting transcript and in-call chat log from meeting "${input.roomId}" (Duration: ${Math.round(duration / 60)} minutes).
Provide a structured executive briefing in strict JSON format:
{
  "executiveSummary": "A concise 2-3 sentence executive summary of the meeting goals, discussions, and outcomes.",
  "keyDecisions": ["List of key decisions made during the call"],
  "actionItems": [
    { "task": "Specific task to complete", "assignee": "Name of person responsible or 'Team'" }
  ],
  "discussionTopics": ["Key topic 1", "Key topic 2"]
}

TRANSCRIPT:
${fullTranscriptText || "No voice transcript recorded."}

CHAT LOG:
${fullChatText || "No chat messages recorded."}

Return ONLY valid JSON.`;

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                }
            );

            if (res.ok) {
                const data = (await res.json()) as any;
                const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(cleanJson);
                return {
                    executiveSummary: parsed.executiveSummary || "Meeting successfully concluded.",
                    keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
                    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
                    discussionTopics: Array.isArray(parsed.discussionTopics) ? parsed.discussionTopics : [],
                    generatedBy: "gemini",
                };
            }
        } catch (err) {
            console.warn("Gemini API call failed or timed out, falling back to local heuristic summarizer:", err);
        }
    }

    // Smart Local Heuristic Summarizer (Runs offline without any dependencies)
    const speakers = Array.from(new Set(transcript.map((t) => t.speaker)));
    const decisions: string[] = [];
    const actionItems: { task: string; assignee: string }[] = [];

    const actionRegex = /(?:need to|will|should|action item|todo|must|please|follow up with|assign|work on)\s+([^.!?]+)/i;
    const decisionRegex = /(?:agreed|decided|approved|confirmed|concluded|consensus|resolved)\s+([^.!?]+)/i;

    for (const item of transcript) {
        const actionMatch = item.text.match(actionRegex);
        if (actionMatch?.[1]) {
            actionItems.push({
                task: actionMatch[1].trim(),
                assignee: item.speaker || "Team",
            });
        }

        const decisionMatch = item.text.match(decisionRegex);
        if (decisionMatch?.[1]) {
            decisions.push(decisionMatch[1].trim());
        }
    }

    if (decisions.length === 0) {
        decisions.push("Team aligned on discussed roadmap and next steps.");
    }
    if (actionItems.length === 0) {
        actionItems.push({
            task: "Review meeting recap and shared notes before next session",
            assignee: speakers[0] || "All Participants",
        });
    }

    const durationMin = Math.max(1, Math.round(duration / 60));
    const execSummary =
        transcript.length > 0
            ? `The session ran for ${durationMin} minute${durationMin > 1 ? "s" : ""} with ${speakers.length || 1} active speaker(s). Main discussions focused on collaboration, delivery items, and team synchronization.`
            : `Meeting ${input.roomId} concluded after ${durationMin} minute${durationMin > 1 ? "s" : ""}. Participants synchronized on project goals and shared updates.`;

    return {
        executiveSummary: execSummary,
        keyDecisions: decisions.slice(0, 5),
        actionItems: actionItems.slice(0, 6),
        discussionTopics: speakers.length > 0 ? speakers.map((s) => `${s}'s updates`) : ["Project sync", "Action planning"],
        generatedBy: "heuristic",
    };
};

