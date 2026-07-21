"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./Sidebar.module.scss";

export const Sidebar = () => {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>VideoPlatform</div>
      <nav className={styles.nav}>
        <Link href="/dashboard" className={pathname === "/dashboard" ? styles.active : ""}>
          Overview
        </Link>
        <Link href="/dashboard/videos" className={pathname === "/dashboard/videos" ? styles.active : ""}>
          My Videos
        </Link>
        <Link href="/dashboard/analytics" className={pathname === "/dashboard/analytics" ? styles.active : ""}>
          Analytics
        </Link>
        <Link href="/dashboard/settings" className={pathname === "/dashboard/settings" ? styles.active : ""}>
          Settings
        </Link>
      </nav>
      <div className={styles.sidebarFooter}>
        <button onClick={handleLogout} className={styles.logoutButton}>
          Logout
        </button>
      </div>
    </aside>
  );
};
