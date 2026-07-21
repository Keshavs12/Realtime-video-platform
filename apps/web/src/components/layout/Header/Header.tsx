"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./Header.module.scss";
import ProtectedRoute from "@/components/ProtectedRoute";

interface HeaderProps {
  title?: string;
}

export const Header = ({ title = "Dashboard Overview" }: HeaderProps) => {
  const { user, loading } = useAuth();
  console.log(loading, 'loading in header');

  return (
    <ProtectedRoute>

      <header className={styles.header}>
        <h1>{title}</h1>


        <div className={styles.userMenu}>
          <span className={styles.userName}>{user?.name || "User"}</span>
          <div className={styles.avatar}>AK</div>
        </div>
      </header>
    </ProtectedRoute>


  );
};
