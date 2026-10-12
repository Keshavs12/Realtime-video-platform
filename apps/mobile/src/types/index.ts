export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface ScheduledMeetingItem {
  id: string;
  title: string;
  description: string | null;
  roomCode: string;
  scheduledAt: string;
  durationMinutes: number;
  hostId: string;
  host: {
    id: string;
    name: string;
    email: string;
  };
  invitees: string;
  inviteeList: string[];
  isHost: boolean;
  meetingUrl: string;
  createdAt: string;
}

export interface RoomHistoryEntry {
  roomCode: string;
  joinedAt: string;
  leftAt: string | null;
  durationMinutes: number;
  isHost: boolean;
  otherParticipantsCount: number;
}

export interface DashboardStats {
  roomsHosted: number;
  callMinutes: number;
  activeNow: number;
  totalParticipants: number;
}

export interface ChatMessage {
  id?: string;
  userId?: string;
  name?: string;
  message: string;
  at: number;
  isLocal: boolean;
}

export interface Participant {
  socketId: string;
  userId: string;
  name: string;
  isHost?: boolean;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  isHandRaised?: boolean;
  isSharing?: boolean;
  stream?: any;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  fromName: string;
  fromSocketId: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollItem {
  id: string;
  question: string;
  creatorName: string;
  options: PollOption[];
  voters?: Record<string, string>; // userId -> optionId
  createdAt: number;
}

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardElement {
  id: string;
  type: "path" | "line" | "rect" | "circle";
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points?: WhiteboardPoint[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  userId?: string;
}
