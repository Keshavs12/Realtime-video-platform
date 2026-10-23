"use client";

import React, { useState } from "react";
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
  Plus,
  Loader2,
  HardDrive,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import styles from "./Sidebar.module.scss";
import { logout } from "@/services/auth.service";
import * as roomService from "@/services/room.service";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const { logout: logoutContext } = useAuth();
  const router = useRouter();
  const [isStartingQuickCall, setIsStartingQuickCall] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      logoutContext();
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleQuickInstantCall = async () => {
    if (isStartingQuickCall) return;
    setIsStartingQuickCall(true);
    try {
      const room = await roomService.createRoom();
      router.push(`/dashboard/room/${room.code}`);
      onClose?.();
    } catch (err) {
      console.error("Failed to launch instant room:", err);
    } finally {
      setIsStartingQuickCall(false);
    }
  };

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, badge: "Live", badgeType: "live" },
    { href: "/dashboard/schedule", label: "Schedule & Invites", icon: CalendarDays, badge: "Upcoming", badgeType: "neutral" },
    { href: "/dashboard/videos", label: "My Videos & Studio", icon: Video, badge: "HD", badgeType: "accent" },
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
        {/* Brand & Organization Header */}
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

        {/* Primary Action Button: Start Instant Call */}
        <div className={styles.quickCallContainer}>
          <button
            type="button"
            onClick={handleQuickInstantCall}
            disabled={isStartingQuickCall}
            className={styles.btnQuickCall}
          >
            {isStartingQuickCall ? (
              <Loader2 size={16} className={styles.spinner} />
            ) : (
              <Plus size={16} strokeWidth={2.5} />
            )}
            <span>Start Instant Call</span>
            <span className={styles.shortcutKey}>⌘N</span>
          </button>
        </div>

        {/* Navigation Section */}
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
                <span className={styles.linkLabel}>{item.label}</span>
                {item.badge && (
                  <span
                    className={`${styles.navBadge} ${
                      item.badgeType === "live"
                        ? styles.liveBadge
                        : item.badgeType === "accent"
                        ? styles.accentBadge
                        : styles.neutralBadge
                    }`}
                  >
                    {item.badgeType === "live" && <span className={styles.radarDot} />}
                    {item.badge}
                  </span>
                )}
                {isActive && <div className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </nav>

        {/* Enterprise Bottom Widgets */}
        <div className={styles.sidebarBottomWidgets}>
          {/* Storage & Cloud Quota Card */}
          <div className={styles.storageCard}>
            <div className={styles.storageHeader}>
              <div className={styles.storageTitle}>
                <HardDrive size={13} />
                <span>Cloud Storage</span>
              </div>
              <span className={styles.storageRatio}>1.2 / 50 GB</span>
            </div>
            <div className={styles.storageBarTrack}>
              <div className={styles.storageBarFill} style={{ width: "24%" }} />
            </div>
          </div>

          {/* Infrastructure Health Badge */}
          <div className={styles.infraBadge}>
            <div className={styles.infraStatusDot} />
            <div className={styles.infraText}>
              <span className={styles.infraName}>Render Signaling Online</span>
              <span className={styles.infraLatency}>28ms • Mesh Active</span>
            </div>
            <ShieldCheck size={14} className={styles.infraShield} />
          </div>

          {/* Mobile Companion Callout */}
          <Link href="/#mobile-app" className={styles.mobileCallout} onClick={onClose}>
            <div className={styles.mobileCalloutIcon}>
              <Smartphone size={16} />
            </div>
            <div className={styles.mobileCalloutContent}>
              <span className={styles.mobileCalloutTitle}>SuperCall Mobile</span>
              <span className={styles.mobileCalloutSub}>Android &amp; iOS PWA</span>
            </div>
            <ExternalLink size={13} className={styles.mobileArrow} />
          </Link>
        </div>

        {/* Footer: Sign Out */}
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
