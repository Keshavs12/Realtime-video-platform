"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface Props {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();

  const { accessToken, loading } = useAuth();
  const isRoomPath = Boolean(pathname?.includes("/room/"));

  useEffect(() => {
    if (!loading && !accessToken && !isRoomPath) {
      router.replace("/login");
    }
  }, [loading, accessToken, router, isRoomPath]);

  if (loading && !isRoomPath) {
    return <h1>Loading...</h1>;
  }

  if (!accessToken && !isRoomPath) {
    return null;
  }

  return <>{children}</>;
}