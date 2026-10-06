"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Menu, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./Header.module.scss";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

export const Header = ({
  title = "Dashboard Overview",
  subtitle = "High-definition video rooms & collaboration space",
  onMenuClick,
}: HeaderProps) => {
  const { user } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return "SC";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className={styles.titleText}>{title}</h1>
          <p className={styles.subtitleText}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.statusPill}>
          <span className={styles.statusDot} />
          <ShieldCheck size={14} className={styles.statusIcon} />
          <span>Encrypted Mesh</span>
        </div>

        <div className={styles.userMenu}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name || "Team Member"}</span>
            <span className={styles.userEmail}>{user?.email || "Connected"}</span>
          </div>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar}>
              {getInitials(user?.name)}
            </div>
            <span className={styles.onlineBadge} />
          </div>
        </div>
      </div>
    </header>
  );
};
