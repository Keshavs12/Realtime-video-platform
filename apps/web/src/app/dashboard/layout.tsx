import React from "react";
import { Sidebar } from "@/components/layout/Sidebar/Sidebar";
import { Header } from "@/components/layout/Header/Header";
import styles from "../../styles/dashboard.module.scss";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.main}>
        <Header />
        {children}
      </main>
    </div>
  );
}
