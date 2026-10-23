"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
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
  Clipboard,
  Activity,
  ShieldCheck,
  Zap,
  QrCode,
} from "lucide-react";
import styles from "../../styles/dashboard.module.scss";
import * as roomService from "@/services/room.service";
import type { DashboardStats, RoomHistoryEntry } from "@/services/room.service";
import { useAuth } from "@/context/AuthContext";
import { StudioHardwareModal } from "@/components/StudioHardwareModal";
import { RoomQrCodeModal } from "@/components/RoomQrCodeModal";

export default function DashboardPage() {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RoomHistoryEntry[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Pre-flight toggles for Instant Meeting
  const [preflightMic, setPreflightMic] = useState(true);
  const [preflightCam, setPreflightCam] = useState(true);

  // Studio Hardware Check Modal
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);

  // QR Code Join Modal
  const [selectedQrRoom, setSelectedQrRoom] = useState<string | null>(null);

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

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Extract room code if full URL was pasted
        const match = text.match(/room\/([a-zA-Z0-9_-]+)/);
        setRoomId(match ? match[1] : text.trim().toLowerCase());
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleJoinRoom = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const cleanId = roomId.trim().toLowerCase();
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

  // Human-friendly minutes formatter
  const formatMinutes = (minutes?: number) => {
    if (!minutes && minutes !== 0) return "0";
    if (minutes >= 60) {
      const hrs = Math.round(minutes / 60);
      return `${hrs.toLocaleString()} hrs`;
    }
    return `${minutes} min`;
  };

  return (
    <>
      {/* Hero Welcome Banner */}
      <section className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <h2>Welcome back, {user?.name?.split(" ")[0] || "Collaborator"} 👋</h2>
          <p>
            Enterprise WebRTC mesh platform active • Hardware-accelerated 1080p video, 60fps canvas, and zero cloud delay.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div className={styles.heroBadge}>
            <span className={styles.liveDot} />
            <span>STUN / TURN Mesh Ready</span>
          </div>
          <div className={styles.heroBadge} style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
            <Activity size={13} />
            <span>Ping: 28ms</span>
          </div>
        </div>
      </section>

      {/* Metrics Row with Sparklines */}
      <section className={styles.statsGrid}>
        {/* Card 1: Rooms Hosted */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Rooms Hosted</span>
            <div className={styles.statIconWrap} style={{ color: "#818cf8" }}>
              <Video size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            {stats ? (
              <span className={styles.statValue}>{stats.roomsHosted}</span>
            ) : (
              <span className={styles.skeletonPulse} />
            )}
            <span className={styles.statTrend}>+12%</span>
          </div>
          <span className={styles.statSubtext}>P2P Mesh Conference Rooms</span>
          {/* Subtle SVG Sparkline */}
          <svg className={styles.statSparklineSvg} viewBox="0 0 100 25" preserveAspectRatio="none">
            <path d="M0,20 Q20,10 40,16 T80,8 T100,12 L100,25 L0,25 Z" fill="rgba(99, 102, 241, 0.15)" />
            <path d="M0,20 Q20,10 40,16 T80,8 T100,12" fill="none" stroke="#6366f1" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Card 2: Call Minutes */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Call Minutes</span>
            <div className={styles.statIconWrap} style={{ color: "#c084fc" }}>
              <Clock size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            {stats ? (
              <span className={styles.statValue}>{formatMinutes(stats.callMinutes)}</span>
            ) : (
              <span className={styles.skeletonPulse} />
            )}
            <span className={styles.statTrend}>+25%</span>
          </div>
          <span className={styles.statSubtext}>{stats?.callMinutes?.toLocaleString() || "0"} total minutes streamed</span>
          {/* Subtle SVG Sparkline */}
          <svg className={styles.statSparklineSvg} viewBox="0 0 100 25" preserveAspectRatio="none">
            <path d="M0,22 Q25,18 50,12 T85,6 T100,4 L100,25 L0,25 Z" fill="rgba(168, 85, 247, 0.15)" />
            <path d="M0,22 Q25,18 50,12 T85,6 T100,4" fill="none" stroke="#a855f7" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Card 3: Active Sessions */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Active Sessions</span>
            <div className={styles.statIconWrap} style={{ color: "#34d399" }}>
              <Radio size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            {stats ? (
              <span className={styles.statValue}>{stats.activeNow}</span>
            ) : (
              <span className={styles.skeletonPulse} />
            )}
            <span className={styles.statTrend} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Live</span>
          </div>
          <span className={styles.statSubtext}>Currently active participants</span>
          {/* Subtle SVG Sparkline */}
          <svg className={styles.statSparklineSvg} viewBox="0 0 100 25" preserveAspectRatio="none">
            <path d="M0,15 Q30,5 60,18 T100,8 L100,25 L0,25 Z" fill="rgba(16, 185, 129, 0.15)" />
            <path d="M0,15 Q30,5 60,18 T100,8" fill="none" stroke="#10b981" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Card 4: Total Participants */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Total Participants</span>
            <div className={styles.statIconWrap} style={{ color: "#38bdf8" }}>
              <Users size={18} />
            </div>
          </div>
          <div className={styles.statValueRow}>
            {stats ? (
              <span className={styles.statValue}>{stats.totalParticipants}</span>
            ) : (
              <span className={styles.skeletonPulse} />
            )}
            <span className={styles.statTrend}>+18%</span>
          </div>
          <span className={styles.statSubtext}>Team &amp; guest collaborators</span>
          {/* Subtle SVG Sparkline */}
          <svg className={styles.statSparklineSvg} viewBox="0 0 100 25" preserveAspectRatio="none">
            <path d="M0,20 Q35,8 70,14 T100,6 L100,25 L0,25 Z" fill="rgba(56, 189, 248, 0.15)" />
            <path d="M0,20 Q35,8 70,14 T100,6" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          </svg>
        </div>
      </section>

      {/* Quick Action Hub */}
      <section className={styles.actionGrid}>
        {/* Instant Meeting Card with Pre-flight Check */}
        <div className={styles.actionCard}>
          <div>
            <div className={styles.actionHeader}>
              <div className={styles.actionIconBox} style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                <Sparkles size={20} />
              </div>
              <h3>Start Instant Meeting</h3>
            </div>
            <p className={styles.actionDesc}>
              Spin up a secure, hardware-accelerated video room instantly with zero waiting room delay.
            </p>

            {/* Pre-flight Hardware Toggles */}
            <div className={styles.preflightControls}>
              <button
                type="button"
                className={`${styles.preflightBtn} ${preflightMic ? styles.preflightActive : styles.preflightMuted}`}
                onClick={() => setPreflightMic((prev) => !prev)}
                title="Toggle Mic before joining"
              >
                {preflightMic ? <Mic size={14} /> : <MicOff size={14} />}
                <span>Mic {preflightMic ? "On" : "Muted"}</span>
              </button>

              <button
                type="button"
                className={`${styles.preflightBtn} ${preflightCam ? styles.preflightActive : styles.preflightMuted}`}
                onClick={() => setPreflightCam((prev) => !prev)}
                title="Toggle Camera before joining"
              >
                {preflightCam ? <Video size={14} /> : <VideoOff size={14} />}
                <span>Cam {preflightCam ? "On" : "Off"}</span>
              </button>
            </div>
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

          <button
            type="button"
            className={styles.btnTestStudio}
            onClick={() => setIsStudioModalOpen(true)}
          >
            <Sparkles size={14} />
            <span>Test Studio Hardware (Camera &amp; Mic Spectrum)</span>
          </button>
        </div>

        {/* Join Room Card with 1-Click Clipboard Paste & Slugs */}
        <div className={styles.actionCard}>
          <div>
            <div className={styles.actionHeader}>
              <div className={styles.actionIconBox} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                <LogIn size={20} />
              </div>
              <h3>Join Existing Call</h3>
            </div>
            <p className={styles.actionDesc}>
              Enter a shared room code to jump straight into an active conference with automatic camera switching.
            </p>
          </div>
          <form onSubmit={handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className={styles.inputGroupRow}>
              <input
                type="text"
                placeholder="e.g. room-alpha-92"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className={styles.inputField}
              />
              <button
                type="button"
                className={styles.btnPaste}
                onClick={handlePasteClipboard}
                title="Paste from Clipboard"
              >
                <Clipboard size={12} />
                <span>Paste</span>
              </button>
            </div>

            {/* Smart Suggested Slugs */}
            <div className={styles.slugSuggestionsRow}>
              <span className={styles.slugPromptText}>Templates:</span>
              {["quantum-falcon", "cyber-matrix", "stellar-apex"].map((slug) => (
                <button
                  key={slug}
                  type="button"
                  className={styles.slugPill}
                  onClick={() => setRoomId(slug)}
                >
                  {slug}
                </button>
              ))}
            </div>

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
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
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
                      <button
                        type="button"
                        onClick={() => setSelectedQrRoom(entry.roomCode)}
                        title="Instant Mobile Join QR Code"
                        style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", display: "flex", padding: 0 }}
                      >
                        <QrCode size={14} />
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

                    {/* Participant Avatars Stack */}
                    <div className={styles.avatarStack}>
                      <div className={styles.miniAvatar}>H</div>
                      {entry.otherParticipantsCount > 0 && (
                        <div className={styles.miniAvatar} style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
                          P
                        </div>
                      )}
                      <span className={styles.avatarCount}>
                        {entry.otherParticipantsCount > 0 ? `${entry.otherParticipantsCount + 1} connected` : "1 in room"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.itemRight}>
                  <div className={styles.qualityBadge}>
                    <ShieldCheck size={12} />
                    <span>99.8% HD Mesh</span>
                  </div>

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

      {/* Studio Hardware Check Modal */}
      <StudioHardwareModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
      />

      {/* Instant Mobile Join QR Code Modal */}
      <RoomQrCodeModal
        isOpen={Boolean(selectedQrRoom)}
        onClose={() => setSelectedQrRoom(null)}
        roomCode={selectedQrRoom || ""}
      />
    </>
  );
}
