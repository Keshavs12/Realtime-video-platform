import { apiClient, saveAuthTokens, clearAuthTokens } from "../config/api";
import { User, AuthResponse } from "../types";

export const authService = {
  // Signup Step 1: Send OTP to user's email
  sendSignupOtp: async (data: { name: string; email: string; password: string }) => {
    return apiClient<{ message: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Resend OTP
  resendSignupOtp: async (email: string) => {
    return apiClient<{ message: string }>("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  // Signup Step 2: Verify OTP and create user
  verifySignupOtp: async (email: string, otp: string): Promise<AuthResponse> => {
    const res = await apiClient<AuthResponse["data"]>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
    if (res.data?.accessToken && res.data?.refreshToken) {
      await saveAuthTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res as unknown as AuthResponse;
  },

  // Standard Login
  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await apiClient<AuthResponse["data"]>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.data?.accessToken && res.data?.refreshToken) {
      await saveAuthTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res as unknown as AuthResponse;
  },

  // Get current user profile
  getMe: async (): Promise<User> => {
    const res = await apiClient<{ user: User }>("/auth/me", {
      method: "GET",
    });
    return (res.data as any)?.user || (res as any)?.data || (res as any)?.user;
  },

  // Update user profile name
  updateProfile: async (name: string): Promise<User> => {
    const res = await apiClient<User>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    return res.data;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiClient("/auth/me/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Logout
  logout: async () => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    } finally {
      await clearAuthTokens();
    }
  },
};
