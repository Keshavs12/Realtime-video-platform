"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./Sidebar.module.scss";
import { logout } from "@/services/auth.service";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const { logout: logoutContext } = useAuth();
  const router = useRouter();

const handleLogout = async ()=>{
  try{
    await logout();
    logoutContext();
    router.replace("/login");

  }
  catch(error){
    console.error("Logout failed:", error);
  }

}

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayVisible : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.logo}>VideoPlatform</div>
        <nav className={styles.nav}>
          <Link href="/dashboard" className={pathname === "/dashboard" ? styles.active : ""} onClick={onClose}>
            Overview
          </Link>
          <Link href="/dashboard/videos" className={pathname === "/dashboard/videos" ? styles.active : ""} onClick={onClose}>
            My Videos
          </Link>
          <Link href="/dashboard/analytics" className={pathname === "/dashboard/analytics" ? styles.active : ""} onClick={onClose}>
            Analytics
          </Link>
          <Link href="/dashboard/settings" className={pathname === "/dashboard/settings" ? styles.active : ""} onClick={onClose}>
            Settings
          </Link>
        </nav>
        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};
