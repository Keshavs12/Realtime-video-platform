"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface Props {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const router = useRouter();

  const { accessToken, loading } = useAuth();

  useEffect(() => {
    if (!loading && !accessToken) {
      router.replace("/login");
    }
  }, [loading, accessToken, router]);

  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (!accessToken) {
    return null;
  }

  return <>{children}</>;
}