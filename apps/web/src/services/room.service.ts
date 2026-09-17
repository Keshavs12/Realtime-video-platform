import api from "../lib/axios";

export const createRoom = async () => {
  const response = await api.post("/rooms");
  return response.data.data as { code: string; createdAt: string };
};

export const checkRoomExists = async (code: string) => {
  const response = await api.get(`/rooms/${code}/exists`);
  return response.data.data as { code: string };
};

export interface RoomHistoryEntry {
  roomCode: string;
  joinedAt: string;
  leftAt: string | null;
  durationMinutes: number;
  isHost: boolean;
  otherParticipantsCount: number;
}

export const getRoomHistory = async () => {
  const response = await api.get("/rooms/history");
  return response.data.data as RoomHistoryEntry[];
};

export interface DashboardStats {
  roomsHosted: number;
  callMinutes: number;
  activeNow: number;
  totalParticipants: number;
}

export const getDashboardStats = async () => {
  const response = await api.get("/rooms/stats");
  return response.data.data as DashboardStats;
};
