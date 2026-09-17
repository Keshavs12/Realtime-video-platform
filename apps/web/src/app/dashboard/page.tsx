"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from "next/navigation";
import styles from '../../styles/dashboard.module.scss';
import { getMe } from "@/services/auth.service";
import * as roomService from "@/services/room.service";
import type { DashboardStats, RoomHistoryEntry } from "@/services/room.service";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [roomId, setRoomId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RoomHistoryEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchUser();
    fetchDashboardData();
  }, []);

  const fetchUser = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return ;
    try {
      const response = await getMe();
      setUser(response.user);
    } catch (err) {
      console.error("Failed to fetch user:", err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        roomService.getDashboardStats(),
        roomService.getRoomHistory(),
      ]);
      setStats(statsData);
      setRecentActivity(historyData.slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || isJoining) return;

    setJoinError("");
    setIsJoining(true);
    try {
      await roomService.checkRoomExists(roomId.trim());
      router.push(`/dashboard/room/${roomId.trim()}`);
    } catch (err) {
      setJoinError("Room not found. Check the ID and try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async () => {
    try {
      const room = await roomService.createRoom();
      router.push(`/dashboard/room/${room.code}`);
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  return (
    <>
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Rooms Hosted</h3>
          <div className={styles.value}>{stats ? stats.roomsHosted : "—"}</div>
        </div>
        <div className={styles.card}>
          <h3>Call Minutes</h3>
          <div className={styles.value}>{stats ? stats.callMinutes : "—"}</div>
        </div>
        <div className={styles.card}>
          <h3>Active Now</h3>
          <div className={styles.value}>{stats ? stats.activeNow : "—"}</div>
        </div>
        <div className={styles.card}>
          <h3>Total Participants</h3>
          <div className={styles.value}>{stats ? stats.totalParticipants : "—"}</div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Create Video Room */}
        <div className={styles.card}>
          <h3>Start a Video Stream</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Create a new room instantly and invite others to join your video session.
            </p>
            <button
              onClick={handleCreateRoom}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              📹 Create New Room
            </button>
          </div>
        </div>

        {/* Join Video Room */}
        <div className={styles.card}>
          <h3>Join an Existing Room</h3>
          <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }} suppressHydrationWarning>
            <input
              type="text"
              placeholder="Enter Room ID (e.g. room123)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              suppressHydrationWarning
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                color: 'white',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!roomId.trim() || isJoining}
              style={{
                background: roomId.trim() ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
                color: roomId.trim() ? 'white' : '#64748b',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                fontWeight: '600',
                cursor: roomId.trim() ? 'pointer' : 'default',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => {
                if (roomId.trim()) e.currentTarget.style.opacity = '0.9';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {isJoining ? "Checking…" : "🚪 Join Room"}
            </button>
            {joinError && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{joinError}</p>
            )}
          </form>
        </div>
      </div>

      <div className={styles.card} style={{ minHeight: '180px' }}>
        <h3>Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p style={{ color: '#94a3b8', marginTop: '1rem' }}>No recent activity to show yet. Start a new stream to see data here!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {recentActivity.map((entry, i) => (
              <div
                key={`${entry.roomCode}-${entry.joinedAt}-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#cbd5e1',
                  fontSize: '0.875rem',
                  borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  paddingBottom: '0.5rem',
                }}
              >
                <span>
                  {entry.isHost ? "Hosted" : "Joined"} room <strong>{entry.roomCode}</strong>
                  {entry.otherParticipantsCount > 0 && ` with ${entry.otherParticipantsCount} other${entry.otherParticipantsCount > 1 ? "s" : ""}`}
                </span>
                <span style={{ color: '#64748b' }}>{entry.durationMinutes} min</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
