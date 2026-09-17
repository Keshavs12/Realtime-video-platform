"use client";

import React, { useEffect, useState } from "react";
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
      <div className={dashboardStyles.grid}>
        <div className={dashboardStyles.card}>
          <h3>Rooms Hosted</h3>
          <div className={dashboardStyles.value}>{stats ? stats.roomsHosted : "—"}</div>
        </div>
        <div className={dashboardStyles.card}>
          <h3>Call Minutes</h3>
          <div className={dashboardStyles.value}>{stats ? stats.callMinutes : "—"}</div>
        </div>
        <div className={dashboardStyles.card}>
          <h3>Total Participants</h3>
          <div className={dashboardStyles.value}>{stats ? stats.totalParticipants : "—"}</div>
        </div>
      </div>

      <div className={dashboardStyles.card}>
        <h3>Calls in the Last 7 Days</h3>
        {days === null ? (
          <p style={{ color: "#94a3b8", marginTop: "1rem" }}>Loading…</p>
        ) : (
          <div className={styles.barChart}>
            {days.map((day) => (
              <div key={day.label} className={styles.barRow}>
                <span className={styles.barLabel}>{day.label}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(day.count / maxCount) * 100}%` }}
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
