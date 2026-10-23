"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  Menu,
  ShieldCheck,
  Search,
  Bell,
  Command,
  CheckCircle2,
  Video,
  Clock,
  Sparkles,
  X,
  ArrowRight,
  Keyboard,
} from "lucide-react";
import styles from "./Header.module.scss";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";

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
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: ⌘K or Ctrl+K for search, ? for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsShortcutsOpen(false);
      } else if (e.key === "?" && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return "SC";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const notifications = [
    {
      id: "1",
      title: "Signaling Server Connected",
      desc: "Live connection to Render backend (latency: 28ms).",
      time: "Just now",
      type: "success",
    },
    {
      id: "2",
      title: "Mobile App Ready",
      desc: "Download SuperCall APK for Android or install PWA for iOS.",
      time: "10m ago",
      type: "info",
    },
    {
      id: "3",
      title: "WebRTC Mesh Encryption",
      desc: "End-to-end DTLS-SRTP active on all room channels.",
      time: "1h ago",
      type: "shield",
    },
  ];

  const handleQuickNavigate = (path: string) => {
    setIsSearchOpen(false);
    router.push(path);
  };

  return (
    <header className={styles.header}>
      {/* Title & Mobile Hamburger */}
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

      {/* Global Quick Command Bar (Center) */}
      <div className={styles.centerSection}>
        <button
          type="button"
          className={styles.commandSearchBar}
          onClick={() => setIsSearchOpen(true)}
        >
          <Search size={15} className={styles.searchIcon} />
          <span className={styles.searchText}>Search rooms, invites, studio recordings...</span>
          <kbd className={styles.cmdKey}>
            <Command size={11} /> K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Mesh Status, Notifications & Profile */}
      <div className={styles.rightSection}>
        <div className={styles.statusPill}>
          <span className={styles.statusDot} />
          <ShieldCheck size={14} className={styles.statusIcon} />
          <span>Encrypted Mesh</span>
        </div>

        {/* Keyboard Shortcuts Trigger */}
        <button
          type="button"
          className={styles.shortcutsButton}
          onClick={() => setIsShortcutsOpen(true)}
          title="Keyboard Shortcuts (?)"
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard size={17} />
        </button>

        {/* Notification Bell Dropdown */}
        <div className={styles.notificationWrapper} ref={notifRef}>
          <button
            type="button"
            className={`${styles.bellButton} ${isNotificationsOpen ? styles.bellActive : ""}`}
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            aria-label="View notifications"
          >
            <Bell size={18} />
            <span className={styles.unreadDot} />
          </button>

          {isNotificationsOpen && (
            <div className={styles.notificationsDropdown}>
              <div className={styles.notifHeader}>
                <div>
                  <span className={styles.notifTitle}>Notifications</span>
                  <span className={styles.notifBadge}>3 New</span>
                </div>
                <span className={styles.markRead}>Mark all read</span>
              </div>

              <div className={styles.notifList}>
                {notifications.map((n) => (
                  <div key={n.id} className={styles.notifItem}>
                    <div className={styles.notifIconWrap}>
                      {n.type === "success" && <CheckCircle2 size={15} style={{ color: "#10b981" }} />}
                      {n.type === "info" && <Video size={15} style={{ color: "#818cf8" }} />}
                      {n.type === "shield" && <ShieldCheck size={15} style={{ color: "#38bdf8" }} />}
                    </div>
                    <div className={styles.notifContent}>
                      <div className={styles.notifItemTitle}>{n.title}</div>
                      <div className={styles.notifItemDesc}>{n.desc}</div>
                      <div className={styles.notifTime}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
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

      {/* Global Command Palette Modal */}
      {isSearchOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSearchOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalSearchInputRow}>
              <Search size={18} className={styles.modalSearchIcon} />
              <input
                type="text"
                autoFocus
                placeholder="Type a command or search (e.g. Schedule, Videos, Room ID)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.modalInput}
              />
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsSearchOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.quickCommandsList}>
              <div className={styles.groupTitle}>QUICK NAVIGATION</div>
              <button
                type="button"
                className={styles.commandItem}
                onClick={() => handleQuickNavigate("/dashboard/schedule")}
              >
                <Clock size={16} />
                <span>Open Meeting Scheduler &amp; Invites</span>
                <ArrowRight size={14} className={styles.commandArrow} />
              </button>

              <button
                type="button"
                className={styles.commandItem}
                onClick={() => handleQuickNavigate("/dashboard/videos")}
              >
                <Video size={16} />
                <span>Go to Cloud Studio &amp; Recordings</span>
                <ArrowRight size={14} className={styles.commandArrow} />
              </button>

              <button
                type="button"
                className={styles.commandItem}
                onClick={() => handleQuickNavigate("/dashboard/analytics")}
              >
                <Sparkles size={16} />
                <span>View WebRTC Mesh Network Analytics</span>
                <ArrowRight size={14} className={styles.commandArrow} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Enterprise Keyboard Shortcuts Cheatsheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </header>
  );
};
