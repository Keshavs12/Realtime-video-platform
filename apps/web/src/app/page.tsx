"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radio,
  Video,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Monitor,
  PenTool,
  Disc,
  Users,
  Mic,
  MessageSquare,
  Lock,
} from "lucide-react";
import styles from "../styles/landing.module.scss";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  const handleQuickJoin = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    router.push(`/dashboard/room/${roomId.trim()}`);
  };

  return (
    <div className={styles.landingPage}>
      {/* Top Navbar */}
      <header className={styles.navBar}>
        <Link href="/" className={styles.brandLogo}>
          <div className={styles.logoIcon}>
            <Radio size={20} />
          </div>
          <span className={styles.brandName}>SuperCall</span>
        </Link>

        <div className={styles.navActions}>
          <Link href="/login" className={styles.loginBtn}>
            Sign In
          </Link>
          <Link href="/signup" className={styles.signupBtn}>
            Get Started Free
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.heroSection}>
        <div className={styles.badgePill}>
          <Sparkles size={14} />
          <span>Next-Gen WebRTC Mesh Platform</span>
        </div>

        <h1 className={styles.heroTitle}>
          Crystal-Clear HD Meetings. <br />
          <span>Zero-Latency Collaboration.</span>
        </h1>

        <p className={styles.heroSubtitle}>
          Enterprise video conferencing engineered for high performance. Featuring collaborative interactive whiteboard, client-side HD recording, screen sharing, and secure mesh encryption.
        </p>

        <div className={styles.heroCtaRow}>
          <Link href="/dashboard" className={styles.btnCtaPrimary}>
            <Video size={18} />
            <span>Launch Meeting Room</span>
            <ArrowRight size={16} />
          </Link>
          <Link href="/login" className={styles.btnCtaSecondary}>
            <ShieldCheck size={18} />
            <span>Dashboard Workspace</span>
          </Link>
        </div>

        {/* Quick Join With Room ID */}
        <form onSubmit={handleQuickJoin} className={styles.quickJoinBar}>
          <input
            type="text"
            placeholder="Enter Room Code (e.g. room-alpha-92)"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button type="submit" disabled={!roomId.trim()}>
            <span>Join Call</span>
            <ArrowRight size={15} />
          </button>
        </form>
      </main>

      {/* Interactive Mock Window Showcase */}
      <section className={styles.showcaseContainer}>
        <div className={styles.mockWindow}>
          <div className={styles.windowBar}>
            <div className={styles.dots}>
              <span />
              <span />
              <span />
            </div>
            <span className={styles.windowTitle}>SuperCall Stage — Mesh Active (60fps)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#34d399", fontSize: "0.75rem", fontWeight: 600 }}>
              <Lock size={12} />
              <span>Encrypted</span>
            </div>
          </div>

          <div className={styles.mockStage}>
            {/* Tile 1: Active Speaker */}
            <div className={`${styles.mockTile} ${styles.speaking}`}>
              <div className={styles.mockAvatar}>JD</div>
              <div className={styles.mockLabel}>
                <span>John Doe (Host)</span>
                <div style={{ display: "inline-flex", alignItems: "flex-end", gap: "2px", height: "10px" }}>
                  <span style={{ width: "2px", height: "100%", background: "#10b981", borderRadius: "1px" }} />
                  <span style={{ width: "2px", height: "60%", background: "#10b981", borderRadius: "1px" }} />
                  <span style={{ width: "2px", height: "80%", background: "#10b981", borderRadius: "1px" }} />
                </div>
              </div>
            </div>

            {/* Tile 2: Second participant */}
            <div className={styles.mockTile}>
              <div className={styles.mockAvatar} style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
                SK
              </div>
              <div className={styles.mockLabel}>
                <span>Sarah Kim</span>
                <Mic size={12} style={{ color: "#94a3b8" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className={styles.featuresGrid}>
        <div className={styles.featureCard}>
          <div className={styles.iconBox}>
            <Video size={22} />
          </div>
          <h3>HD WebRTC Mesh Streaming</h3>
          <p>
            Hardware-accelerated peer-to-peer and relayed video streaming with adaptive bitrate switching for crystal-clear clarity.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconBox} style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
            <PenTool size={22} />
          </div>
          <h3>Collaborative Whiteboard</h3>
          <p>
            Real-time multi-user vector drawing canvas with smooth pen, shapes, highlighters, and instant board synchronization.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconBox} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
            <Disc size={22} />
          </div>
          <h3>Client-Side Recording Studio</h3>
          <p>
            Zero cloud storage cost. Capture screen and participant audio directly into IndexedDB with instant local .webm export.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconBox} style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
            <Monitor size={22} />
          </div>
          <h3>Smooth Screen Sharing</h3>
          <p>
            Share browser tabs, windows, or full desktops with 1080p high framerate presentation mode and presenter spotlighting.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconBox} style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
            <Users size={22} />
          </div>
          <h3>Host Governance &amp; Moderation</h3>
          <p>
            Complete room security with lock toggles, individual/bulk participant muting, kick controls, and raised-hand queues.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconBox} style={{ background: "rgba(236, 72, 153, 0.15)", color: "#f472b6" }}>
            <MessageSquare size={22} />
          </div>
          <h3>Interactive In-Call Engagement</h3>
          <p>
            Real-time instant messaging, floating emoji reaction streams, and low-bandwidth audio-priority fallback.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2026 SuperCall. Modern Realtime Video &amp; Collaboration Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
