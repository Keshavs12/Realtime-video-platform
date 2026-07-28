import api from '../lib/axios';
import { SignupPayload, LoginPayload } from '../types/auth';

export const signup = async (data: SignupPayload) => {
  return api.post("/auth/signup", data);
};

export const login = async (data: LoginPayload) => {
  return api.post("/auth/login", data);
};

export const getMe = async () => {
  const response = await api.get("/auth/me");
console.log(response.data, 'response.data')
  return response.data;
};

export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
}

export const refreshToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  const response = await api.post("/auth/refresh", { refreshToken });
  return response.data;
}

