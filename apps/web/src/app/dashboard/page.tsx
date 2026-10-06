"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Clock,
  Radio,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  LogIn,
  History,
  Copy,
  Check,
  Shield,
  Loader2,
} from "lucide-react";
import styles from "../../styles/dashboard.module.scss";
import * as roomService from "@/services/room.service";
import type { DashboardStats, RoomHistoryEntry } from "@/services/room.service";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RoomHistoryEntry[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        roomService.getDashboardStats(),
        roomService.getRoomHistory(),
      ]);
      setStats(statsData);
      setRecentActivity(historyData.slice(0, 6));
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  };

  const handleJoinRoom = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const cleanId = roomId.trim();
    if (!cleanId || isJoining) return;

    setJoinError("");
    setIsJoining(true);
    try {
      await roomService.checkRoomExists(cleanId);
      router.push(`/dashboard/room/${cleanId}`);
    } catch (err) {
      console.warn("Room check failed:", err);
      setJoinError("Room not found. Check the ID and try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const room = await roomService.createRoom();
      router.push(`/dashboard/room/${room.code}`);
    } catch (err) {
      console.error("Failed to create room:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyRoomCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <>
      {/* Hero Welcome Banner */}
      <section className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <h2>Welcome back, {user?.name?.split(" ")[0] || "Collaborator"} 👋</h2>
          <p>
            Experience ultra-low latency WebRTC mesh streaming, crystal-clear audio, and seamless collaborative tools.
          </p>
        </div>
        <div className={styles.heroBadge}>
          <span className={styles.liveDot} />
          <span>STUN / TURN Mesh Ready</span>
        </div>
      </section>

      {/* Metrics Row */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Rooms Hosted</span>
            <div className={styles.statIconWrap} style={{ color: "#818cf8" }}>
              <Video size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{stats ? stats.roomsHosted : "0"}</span>
            <span className={styles.statTrend}>+12%</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Call Minutes</span>
            <div className={styles.statIconWrap} style={{ color: "#c084fc" }}>
              <Clock size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{stats ? stats.callMinutes : "0"}</span>
            <span className={styles.statTrend}>+25%</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Active Sessions</span>
            <div className={styles.statIconWrap} style={{ color: "#34d399" }}>
              <Radio size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{stats ? stats.activeNow : "0"}</span>
            <span className={styles.statTrend} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Live</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Total Participants</span>
            <div className={styles.statIconWrap} style={{ color: "#38bdf8" }}>
              <Users size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            <span className={styles.statValue}>{stats ? stats.totalParticipants : "0"}</span>
            <span className={styles.statTrend}>+18%</span>
          </div>
        </div>
      </section>

      {/* Quick Action Hub */}
      <section className={styles.actionGrid}>
        {/* Instant Meeting Card */}
        <div className={styles.actionCard}>
          <div>
            <div className={styles.actionHeader}>
              <div className={styles.actionIconBox} style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                <Sparkles size={20} />
              </div>
              <h3>Start Instant Meeting</h3>
            </div>
            <p className={styles.actionDesc}>
              Spin up a secure, hardware-accelerated video room instantly. Share your room code or link to collaborate.
            </p>
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleCreateRoom}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Creating Room…</span>
              </>
            ) : (
              <>
                <Video size={18} />
                <span>Launch New Room</span>
              </>
            )}
          </button>
        </div>

        {/* Join Room Card */}
        <div className={styles.actionCard}>
          <div>
            <div className={styles.actionHeader}>
              <div className={styles.actionIconBox} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                <LogIn size={20} />
              </div>
              <h3>Join Existing Call</h3>
            </div>
            <p className={styles.actionDesc}>
              Enter a shared room code to jump straight into an active conference with your camera and mic preview.
            </p>
          </div>
          <form onSubmit={handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              type="text"
              placeholder="e.g. room-alpha-92"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={styles.inputField}
            />
            {joinError && (
              <span style={{ color: "#f87171", fontSize: "0.8rem" }}>{joinError}</span>
            )}
            <button
              type="submit"
              disabled={!roomId.trim() || isJoining}
              className={styles.btnJoin}
            >
              {isJoining ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <ArrowRight size={18} />
                  <span>Enter Room</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Schedule Call Card */}
        <div className={styles.actionCard}>
          <div>
            <div className={styles.actionHeader}>
              <div className={styles.actionIconBox} style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
                <Calendar size={20} />
              </div>
              <h3>Schedule &amp; Invites</h3>
            </div>
            <p className={styles.actionDesc}>
              Organize upcoming meetings, set automatic calendar reminders, and dispatch customized email invites via Nodemailer.
            </p>
          </div>
          <button
            type="button"
            className={styles.btnSchedule}
            onClick={() => router.push("/dashboard/schedule")}
          >
            <Calendar size={18} />
            <span>Open Meeting Scheduler</span>
          </button>
        </div>
      </section>

      {/* Recent Sessions */}
      <section className={styles.activityCard}>
        <div className={styles.activityTitleRow}>
          <h3>
            <History size={18} style={{ color: "#818cf8" }} />
            <span>Recent Sessions &amp; Activity</span>
          </h3>
          <span className={styles.historyCount}>{recentActivity.length} recorded</span>
        </div>

        {recentActivity.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b" }}>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>No session activity found yet. Launch a room above to get started!</p>
          </div>
        ) : (
          <div className={styles.activityList}>
            {recentActivity.map((entry, i) => (
              <div
                key={`${entry.roomCode}-${entry.joinedAt}-${i}`}
                className={styles.activityItem}
              >
                <div className={styles.itemLeft}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span className={styles.roomCodeBadge}>{entry.roomCode}</span>
                      <button
                        type="button"
                        onClick={() => copyRoomCode(entry.roomCode)}
                        title="Copy Room Code"
                        style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", display: "flex", padding: 0 }}
                      >
                        {copiedCode === entry.roomCode ? (
                          <Check size={14} style={{ color: "#34d399" }} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <span className={`${styles.roleBadge} ${entry.isHost ? styles.host : styles.guest}`}>
                        {entry.isHost ? "Host" : "Participant"}
                      </span>
                    </div>
                    <div className={styles.itemMeta}>
                      {new Date(entry.joinedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {entry.otherParticipantsCount > 0 &&
                        ` · With ${entry.otherParticipantsCount} participant${entry.otherParticipantsCount > 1 ? "s" : ""}`}
                    </div>
                  </div>
                </div>

                <div className={styles.itemRight}>
                  <span className={styles.durationPill}>
                    {entry.durationMinutes} min call
                  </span>
                  <button
                    type="button"
                    className={styles.rejoinBtn}
                    onClick={() => router.push(`/dashboard/room/${entry.roomCode}`)}
                  >
                    <span>Rejoin</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
