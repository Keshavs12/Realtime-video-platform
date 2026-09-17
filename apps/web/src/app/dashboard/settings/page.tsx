"use client";

import React, { useState } from "react";
import dashboardStyles from "@/styles/dashboard.module.scss";
import styles from "@/styles/settings.module.scss";
import { useAuth } from "@/context/AuthContext";
import * as authService from "@/services/auth.service";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [profileStatus, setProfileStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim() || isSavingProfile) return;

    setProfileStatus(null);
    setIsSavingProfile(true);
    try {
      const response = await authService.updateProfile(name.trim());
      if (user) updateUser({ ...user, name: response.data.name });
      setProfileStatus({ type: "success", text: "Profile updated." });
    } catch (err: any) {
      setProfileStatus({ type: "error", text: err.response?.data?.message || "Failed to update profile." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || isSavingPassword) return;

    setPasswordStatus(null);
    setIsSavingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordStatus({ type: "success", text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setPasswordStatus({ type: "error", text: err.response?.data?.message || "Failed to change password." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className={dashboardStyles.grid}>
      <div className={dashboardStyles.card}>
        <h3>Profile</h3>
        <form className={styles.form} onSubmit={handleUpdateProfile}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {profileStatus && (
            <p className={`${styles.message} ${profileStatus.type === "success" ? styles.success : styles.error}`}>
              {profileStatus.text}
            </p>
          )}
          <button type="submit" className={styles.submitBtn} disabled={isSavingProfile}>
            {isSavingProfile ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>

      <div className={dashboardStyles.card}>
        <h3>Change Password</h3>
        <form className={styles.form} onSubmit={handleChangePassword}>
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {passwordStatus && (
            <p className={`${styles.message} ${passwordStatus.type === "success" ? styles.success : styles.error}`}>
              {passwordStatus.text}
            </p>
          )}
          <button type="submit" className={styles.submitBtn} disabled={isSavingPassword}>
            {isSavingPassword ? "Saving…" : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
