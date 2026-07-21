import api from '../lib/axios';
import { SignupPayload, LoginPayload } from '../types/auth';

export const signup = async (data: SignupPayload) => {
    return api.post("/auth/signup", data);
};

export const login = async (data: LoginPayload) => {
    return api.post("/auth/login", data);
};

export const getMe = async (token: string) => {
  const response = await api.get("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};