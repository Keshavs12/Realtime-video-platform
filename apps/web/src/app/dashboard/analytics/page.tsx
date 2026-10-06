"use client";

import React, { useEffect, useState } from "react";
import {
  Video,
  Clock,
  Users,
  BarChart3,
  TrendingUp,
  Calendar,
  Loader2,
  Sparkles,
} from "lucide-react";
import dashboardStyles from "@/styles/dashboard.module.scss";
import styles from "@/styles/analytics.module.scss";
import * as roomService from "@/services/room.service";
import type { DashboardStats, RoomHistoryEntry } from "@/services/room.service";

interface DayBucket {
  label: string;
  count: number;
}

const buildLast7Days = (history: RoomHistoryEntry[]): DayBucket[] => {
  const days: DayBucket[] = [];
  const counts = new Map<string, number>();

  for (const entry of history) {
    const key = new Date(entry.joinedAt).toDateString();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toDateString();
    days.push({
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: counts.get(key) || 0,
    });
  }

  return days;
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [days, setDays] = useState<DayBucket[] | null>(null);

  useEffect(() => {
    Promise.all([roomService.getDashboardStats(), roomService.getRoomHistory()])
      .then(([statsData, historyData]) => {
        setStats(statsData);
        setDays(buildLast7Days(historyData));
      })
      .catch((err) => console.error("Failed to fetch analytics data:", err));
  }, []);

  const maxCount = days ? Math.max(1, ...days.map((d) => d.count)) : 1;

  return (
    <>
      <div className={dashboardStyles.statsGrid}>
        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statHeader}>
            <span className={dashboardStyles.statLabel}>Rooms Hosted</span>
            <div className={dashboardStyles.statIconWrap} style={{ color: "#818cf8" }}>
              <Video size={18} />
            </div>
          </div>
          <div className={dashboardStyles.statValueRow}>
            <span className={dashboardStyles.statValue}>{stats ? stats.roomsHosted : "0"}</span>
            <span className={dashboardStyles.statTrend}>+12%</span>
          </div>
        </div>

        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statHeader}>
            <span className={dashboardStyles.statLabel}>Call Minutes</span>
            <div className={dashboardStyles.statIconWrap} style={{ color: "#c084fc" }}>
              <Clock size={18} />
            </div>
          </div>
          <div className={dashboardStyles.statValueRow}>
            <span className={dashboardStyles.statValue}>{stats ? stats.callMinutes : "0"}</span>
            <span className={dashboardStyles.statTrend}>+25%</span>
          </div>
        </div>

        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statHeader}>
            <span className={dashboardStyles.statLabel}>Total Participants</span>
            <div className={dashboardStyles.statIconWrap} style={{ color: "#38bdf8" }}>
              <Users size={18} />
            </div>
          </div>
          <div className={dashboardStyles.statValueRow}>
            <span className={dashboardStyles.statValue}>{stats ? stats.totalParticipants : "0"}</span>
            <span className={dashboardStyles.statTrend}>+18%</span>
          </div>
        </div>

        <div className={dashboardStyles.statCard}>
          <div className={dashboardStyles.statHeader}>
            <span className={dashboardStyles.statLabel}>Connection Health</span>
            <div className={dashboardStyles.statIconWrap} style={{ color: "#34d399" }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className={dashboardStyles.statValueRow}>
            <span className={dashboardStyles.statValue}>99.8%</span>
            <span className={dashboardStyles.statTrend} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Optimal</span>
          </div>
        </div>
      </div>

      <div className={dashboardStyles.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem", color: "#f8fafc" }}>
            <BarChart3 size={18} style={{ color: "#818cf8" }} />
            <span>Calls in the Last 7 Days</span>
          </h3>
          <span style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
            <Calendar size={13} />
            <span>Weekly Breakdown</span>
          </span>
        </div>

        {days === null ? (
          <div style={{ color: "#94a3b8", padding: "3rem 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <Loader2 size={18} className="animate-spin" />
            <span>Loading analytics…</span>
          </div>
        ) : (
          <div className={styles.barChart}>
            {days.map((day) => (
              <div key={day.label} className={styles.barRow}>
                <span className={styles.barLabel}>{day.label}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${(day.count / maxCount) * 100}%`,
                      background: "linear-gradient(90deg, #6366f1, #a855f7)",
                    }}
                  />
                </div>
                <span className={styles.barValue}>{day.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
