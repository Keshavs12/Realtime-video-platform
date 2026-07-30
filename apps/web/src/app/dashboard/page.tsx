"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from "next/navigation";
import styles from '../../styles/dashboard.module.scss';
import { getMe } from "@/services/auth.service";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchUser();
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

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    router.push(`/dashboard/room/${roomId.trim()}`);
  };

  const handleCreateRoom = () => {
    // Generate a random 8-character room ID
    const randomRoomId = Math.random().toString(36).substring(2, 10);
    router.push(`/dashboard/room/${randomRoomId}`);
  };

  return (
    <>
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Total Views</h3>
          <div className={styles.value}>24.5K</div>
        </div>
        <div className={styles.card}>
          <h3>Active Streams</h3>
          <div className={styles.value}>3</div>
        </div>
        <div className={styles.card}>
          <h3>Total Revenue</h3>
          <div className={styles.value}>$1,240</div>
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
          <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter Room ID (e.g. room123)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
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
              disabled={!roomId.trim()}
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
              🚪 Join Room
            </button>
          </form>
        </div>
      </div>

      <div className={styles.card} style={{ minHeight: '180px' }}>
        <h3>Recent Activity Placeholder</h3>
        <p style={{ color: '#94a3b8', marginTop: '1rem' }}>No recent activity to show yet. Start a new stream to see data here!</p>
      </div>
    </>
  );
}
