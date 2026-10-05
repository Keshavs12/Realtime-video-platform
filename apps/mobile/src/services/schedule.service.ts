import { apiClient } from "../config/api";
import { ScheduledMeetingItem } from "../types";

export interface CreateScheduleInput {
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  invitees: string[];
}

export const scheduleService = {
  // List scheduled meetings
  getScheduledMeetings: async (): Promise<ScheduledMeetingItem[]> => {
    const res = await apiClient<ScheduledMeetingItem[]>("/schedule", {
      method: "GET",
    });
    return res.data || [];
  },

  // Create scheduled meeting and automatically dispatch email invites
  createScheduledMeeting: async (input: CreateScheduleInput): Promise<{
    meeting: ScheduledMeetingItem;
    emailsSent: number;
  }> => {
    const res = await apiClient<any>("/schedule", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return {
      meeting: res.data,
      emailsSent: res.data?.emailsSent ?? 0,
    };
  },

  // Delete scheduled meeting
  deleteScheduledMeeting: async (id: string): Promise<boolean> => {
    await apiClient(`/schedule/${id}`, {
      method: "DELETE",
    });
    return true;
  },

  // Send reminder emails to invitees
  sendMeetingReminders: async (id: string): Promise<{ sent: number; failed: number }> => {
    const res = await apiClient<{ sent: number; failed: number }>(`/schedule/${id}/reminders`, {
      method: "POST",
    });
    return res.data;
  },
};
