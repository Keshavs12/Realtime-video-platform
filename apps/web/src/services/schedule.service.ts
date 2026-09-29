import api from "../lib/axios";

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

export interface CreateSchedulePayload {
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  invitees: string[];
}

export const createScheduledMeeting = async (payload: CreateSchedulePayload) => {
  const response = await api.post("/schedule", payload);
  return response.data as {
    success: boolean;
    message: string;
    data: ScheduledMeetingItem & { emailsSent: number };
  };
};

export const getScheduledMeetings = async () => {
  const response = await api.get("/schedule");
  return response.data.data as ScheduledMeetingItem[];
};

export const deleteScheduledMeeting = async (id: string) => {
  const response = await api.delete(`/schedule/${id}`);
  return response.data as { success: boolean; message: string };
};

export const sendMeetingReminders = async (id: string) => {
  const response = await api.post(`/schedule/${id}/reminders`);
  return response.data as {
    success: boolean;
    message: string;
    data: { sent: number; failed: number };
  };
};
