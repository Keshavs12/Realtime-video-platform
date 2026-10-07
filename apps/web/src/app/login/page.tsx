"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, Mail, Lock, ArrowRight, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import styles from "../../styles/login.module.scss";
import { login } from "../../services/auth.service";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login: loginUser } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await login(formData);
      const { user, accessToken } = response.data.data;
      loginUser(user, accessToken);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        {/* Brand Header */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)",
            }}
          >
            <Radio size={24} />
          </div>
        </div>

        <div className={styles.header}>
          <h1>Welcome Back</h1>
          <p>Sign in to access your video workspaces and meetings.</p>
        </div>

        {error && (
          <div
            className={styles.error}
            style={{
              color: "#f87171",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              marginBottom: "1.25rem",
              textAlign: "center",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} suppressHydrationWarning>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={handleChange}
              required
              suppressHydrationWarning
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              suppressHydrationWarning
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <Loader2 size={18} className="animate-spin" />
                <span>Signing in…</span>
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <span>Sign In</span>
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          Don&apos;t have an account? <Link href="/signup">Create one free</Link>
        </div>
      </div>
    </div>
  );
}
