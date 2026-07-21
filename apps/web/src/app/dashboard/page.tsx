"use client";

import React, { useEffect, useState } from 'react';
import styles from '../../styles/dashboard.module.scss';
import { getMe } from "@/services/auth.service";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return ;
    const response = await getMe(token);
    setUser(response);
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

      <div className={styles.card} style={{ minHeight: '300px' }}>
        <h3>Recent Activity Placeholder</h3>
        <p style={{ color: '#94a3b8', marginTop: '1rem' }}>No recent activity to show yet. Start a new stream to see data here!</p>
      </div>
    </>
  );
}
