"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar/Sidebar";
import { Header } from "@/components/layout/Header/Header";
import ProtectedRoute from "@/components/ProtectedRoute";
import styles from "../../styles/dashboard.module.scss";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className={styles.container}>
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className={styles.main}>
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
