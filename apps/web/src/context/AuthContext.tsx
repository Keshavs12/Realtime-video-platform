"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { getMe } from "@/services/auth.service";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;

  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface Props {
  children: ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

useEffect(() => {
  initializeAuth();
}, []);


const initializeAuth = async () => {
  try {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setLoading(false);
      return;
    }

    setAccessToken(token);

    const response = await getMe();

    setUser(response.user);
  } catch (error) {
    console.error(error);

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");

    setUser(null);
    setAccessToken(null);
  } finally {
    setLoading(false);
  }
};

  const memoizedLogin = useCallback((newUser: User, token: string) => {
    localStorage.setItem("accessToken", token);
    setUser(newUser);
    setAccessToken(token);
  }, []);

  const memoizedUpdateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const memoizedLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    setAccessToken(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      accessToken,
      login: memoizedLogin,
      logout: memoizedLogout,
      updateUser: memoizedUpdateUser,
      loading,
    }),
    [user, accessToken, memoizedLogin, memoizedLogout, memoizedUpdateUser, loading]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};