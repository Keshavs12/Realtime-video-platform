"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  CalendarDays,
  Video,
  BarChart3,
  Settings,
  LogOut,
  X,
  Radio,
} from "lucide-react";
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

  const handleLogout = async () => {
    try {
      await logout();
      logoutContext();
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/schedule", label: "Schedule & Invites", icon: CalendarDays },
    { href: "/dashboard/videos", label: "My Videos & Studio", icon: Video },
    { href: "/dashboard/analytics", label: "Call Analytics", icon: BarChart3 },
    { href: "/dashboard/settings", label: "Account Settings", icon: Settings },
  ];

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayVisible : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.logoRow}>
          <div className={styles.logoBadge}>
            <div className={styles.logoIcon}>
              <Radio size={20} className={styles.pulseIcon} />
            </div>
            <div>
              <div className={styles.logoText}>SuperCall</div>
              <span className={styles.logoTag}>ENTERPRISE</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className={styles.nav}>
          <div className={styles.sectionLabel}>WORKSPACE</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                onClick={onClose}
              >
                <div className={styles.iconWrapper}>
                  <Icon size={18} />
                </div>
                <span>{item.label}</span>
                {isActive && <div className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            onClick={handleLogout}
            className={styles.logoutButton}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
