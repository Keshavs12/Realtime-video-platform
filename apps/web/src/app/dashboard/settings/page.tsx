"use client";

import React, { useState } from "react";
import {
  User,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  KeyRound,
  ShieldCheck,
  Loader2,
} from "lucide-react";
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
      setProfileStatus({ type: "success", text: "Profile name successfully updated." });
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
      setPasswordStatus({ type: "success", text: "Password changed successfully." });
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
      {/* Profile Settings */}
      <div className={dashboardStyles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <User size={18} style={{ color: "#818cf8" }} />
          <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.1rem" }}>Profile Information</h3>
        </div>
        <form className={styles.form} onSubmit={handleUpdateProfile}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Display Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Registered Email</label>
            <input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed" }}
            />
          </div>
          {profileStatus && (
            <p className={`${styles.message} ${profileStatus.type === "success" ? styles.success : styles.error}`}>
              {profileStatus.text}
            </p>
          )}
          <button type="submit" className={styles.submitBtn} disabled={isSavingProfile}>
            {isSavingProfile ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Security Settings */}
      <div className={dashboardStyles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <ShieldCheck size={18} style={{ color: "#34d399" }} />
          <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.1rem" }}>Security &amp; Password</h3>
        </div>
        <form className={styles.form} onSubmit={handleChangePassword}>
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="newPassword">New Password (8+ characters)</label>
            <input
              id="newPassword"
              type="password"
              placeholder="••••••••"
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
            {isSavingPassword ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Updating…</span>
              </>
            ) : (
              <>
                <KeyRound size={16} />
                <span>Update Password</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
