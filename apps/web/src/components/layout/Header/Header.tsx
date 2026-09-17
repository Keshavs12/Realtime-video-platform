"use client";

import { useAuth } from "@/context/AuthContext";
import styles from "./Header.module.scss";

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

export const Header = ({ title = "Dashboard Overview", onMenuClick }: HeaderProps) => {
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>
        <h1>{title}</h1>
      </div>

      <div className={styles.userMenu}>
        <span className={styles.userName}>{user?.name || "User"}</span>
        <div className={styles.avatar}>AK</div>
      </div>
    </header>
  );
};
