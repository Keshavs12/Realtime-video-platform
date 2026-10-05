import { apiClient } from "../config/api";
import { RoomHistoryEntry, DashboardStats } from "../types";

export const roomService = {
  // Create an instant video room
  createRoom: async (): Promise<{ code: string; createdAt: string }> => {
    const res = await apiClient<{ code: string; createdAt: string }>("/rooms", {
      method: "POST",
    });
    return res.data;
  },

  // Check if a room exists before joining
  checkRoomExists: async (code: string): Promise<{ code: string }> => {
    const res = await apiClient<{ code: string }>(`/rooms/${code}/exists`, {
      method: "GET",
    });
    return res.data;
  },

  // Fetch meeting call history
  getRoomHistory: async (): Promise<RoomHistoryEntry[]> => {
    const res = await apiClient<RoomHistoryEntry[]>("/rooms/history", {
      method: "GET",
    });
    return res.data || [];
  },

  // Fetch dashboard summary stats
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await apiClient<DashboardStats>("/rooms/stats", {
      method: "GET",
    });
    return res.data;
  },
};
