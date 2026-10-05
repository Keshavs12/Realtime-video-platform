import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "../types";
import { authService } from "../services/auth.service";
import { getStoredToken, getStoredServerUrl, setStoredServerUrl, clearAuthTokens } from "../config/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  serverUrl: string;
  login: (email: string, pass: string) => Promise<void>;
  sendSignupOtp: (name: string, email: string, pass: string) => Promise<void>;
  verifySignupOtp: (email: string, otp: string) => Promise<void>;
  resendSignupOtp: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  changeServerUrl: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState<string>("");

  const initAuth = async () => {
    try {
      setIsLoading(true);
      const currentUrl = await getStoredServerUrl();
      setServerUrl(currentUrl);

      const token = await getStoredToken();
      if (token) {
        try {
          const profile = await authService.getMe();
          if (profile && profile.id) {
            setUser(profile);
          } else {
            await clearAuthTokens();
            setUser(null);
          }
        } catch {
          await clearAuthTokens();
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await authService.login({ email, password: pass });
    setUser(res.data.user);
  };

  const sendSignupOtp = async (name: string, email: string, pass: string) => {
    await authService.sendSignupOtp({ name, email, password: pass });
  };

  const verifySignupOtp = async (email: string, otp: string) => {
    const res = await authService.verifySignupOtp(email, otp);
    setUser(res.data.user);
  };

  const resendSignupOtp = async (email: string) => {
    await authService.resendSignupOtp(email);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const profile = await authService.getMe();
      if (profile && profile.id) {
        setUser(profile);
      }
    } catch {
      // Ignore
    }
  };

  const updateName = async (name: string) => {
    const updated = await authService.updateProfile(name);
    setUser(updated);
  };

  const changeServerUrl = async (url: string) => {
    await setStoredServerUrl(url);
    setServerUrl(url);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        serverUrl,
        login,
        sendSignupOtp,
        verifySignupOtp,
        resendSignupOtp,
        logout,
        refreshUser,
        updateName,
        changeServerUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
