"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../../styles/signup.module.scss";
import { sendSignupOtp, resendSignupOtp, verifySignupOtp } from "../../services/auth.service";
import { useAuth } from "../../context/AuthContext";

export default function SignupPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  // Phase 1: 'form' | Phase 2: 'otp'
  const [phase, setPhase] = useState<"form" | "otp">("form");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(60);

  // 60-second countdown timer for Resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "otp" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase, countdown]);

  // Auto-focus first OTP input when entering Phase 2
  useEffect(() => {
    if (phase === "otp") {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [phase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  // -------------------------------------------------------------
  // Step 1: Submit Registration Form & Send OTP
  // -------------------------------------------------------------
  const handleInitiateSignup = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await sendSignupOtp(formData);
      setPhase("otp");
      setCountdown(60);
      setSuccess("A 6-digit verification code has been sent to your email!");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to send verification code. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Step 2: Handle 6-Digit OTP Inputs (Single, Paste, Backspace)
  // -------------------------------------------------------------
  const handleOtpChange = (index: number, value: string) => {
    // 1. Handle Paste Event (if user pastes entire 6-digit code into any box)
    const cleanNumbers = value.replace(/\D/g, "");
    if (cleanNumbers.length > 1) {
      const digits = cleanNumbers.slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);

      const nextFocus = Math.min(digits.length, 5);
      inputRefs.current[nextFocus]?.focus();

      if (digits.length === 6) {
        triggerVerification(newOtp.join(""));
      }
      return;
    }

    // 2. Handle Single Digit Change
    const digit = cleanNumbers.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance focus to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-trigger verification when 6th digit is entered
    if (newOtp.every((d) => d !== "")) {
      triggerVerification(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // -------------------------------------------------------------
  // Step 3: Resend OTP
  // -------------------------------------------------------------
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError("");
    setSuccess("");

    try {
      await resendSignupOtp(formData.email);
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      setSuccess("A new 6-digit verification code has been sent!");
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to resend code. Please try again."
      );
    } finally {
      setResending(false);
    }
  };

  // -------------------------------------------------------------
  // Step 4: Verify OTP & Auto-Redirect to Dashboard
  // -------------------------------------------------------------
  const triggerVerification = async (otpCode: string) => {
    if (verifying || otpCode.length !== 6) return;
    setVerifying(true);
    setError("");
    setSuccess("");

    try {
      const response = await verifySignupOtp(formData.email, otpCode);
      const { user, accessToken } = response.data.data;

      // Auto login user into global AuthContext
      authLogin(user, accessToken);

      setSuccess("Account verified! Redirecting to dashboard...");

      // Smooth direct redirect to the main app
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Invalid or expired verification code. Please try again."
      );
      setVerifying(false);
    }
  };

  const handleManualVerifySubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    triggerVerification(otp.join(""));
  };

  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        {/* ========================================================= */}
        {/* PHASE 1: Sign Up Form                                      */}
        {/* ========================================================= */}
        {phase === "form" && (
          <>
            <div className={styles.header}>
              <h1>Create an Account</h1>
              <p>
                Join the next-generation platform to elevate your digital
                experience.
              </p>
            </div>

            {error && (
              <div
                className={styles.error}
                style={{
                  color: "#ef4444",
                  marginBottom: "1rem",
                  textAlign: "center",
                  fontSize: "0.9rem",
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className={styles.success}
                style={{
                  color: "#10b981",
                  marginBottom: "1rem",
                  textAlign: "center",
                  fontSize: "0.9rem",
                }}
              >
                {success}
              </div>
            )}

            <form
              className={styles.form}
              onSubmit={handleInitiateSignup}
              suppressHydrationWarning
            >
              <div className={styles.formGroup}>
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  suppressHydrationWarning
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your email"
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
                  minLength={8}
                  suppressHydrationWarning
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? "Sending Code..." : "Create Account →"}
              </button>
            </form>

            <div className={styles.footer}>
              Already have an account? <Link href="/login">Sign in</Link>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* PHASE 2: Smooth 6-Digit OTP Verification Screen            */}
        {/* ========================================================= */}
        {phase === "otp" && (
          <div className={styles.otpPhase}>
            <div className={styles.header}>
              <h1>Enter 6-Digit Code</h1>
              <p>We’ve sent a one-time verification code to:</p>
            </div>

            <div className={styles.emailBadge}>
              <span>📧</span>
              <strong>{formData.email}</strong>
              <button
                type="button"
                onClick={() => {
                  setPhase("form");
                  setError("");
                  setSuccess("");
                }}
              >
                Edit
              </button>
            </div>

            {error && (
              <div
                className={styles.error}
                style={{
                  color: "#ef4444",
                  marginBottom: "1rem",
                  textAlign: "center",
                  fontSize: "0.9rem",
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className={styles.success}
                style={{
                  color: "#10b981",
                  marginBottom: "1rem",
                  textAlign: "center",
                  fontSize: "0.9rem",
                }}
              >
                {success}
              </div>
            )}

            <form onSubmit={handleManualVerifySubmit}>
              {/* 6 Individual Sleek Digit Inputs */}
              <div className={styles.otpGrid}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className={`${styles.otpDigit} ${digit ? styles.filled : ""}`}
                    disabled={verifying}
                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                  />
                ))}
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={verifying || otp.some((d) => d === "")}
              >
                {verifying ? "Verifying..." : "Verify & Continue →"}
              </button>

              {/* 60 Seconds Countdown Timer / Resend Action */}
              <div className={styles.timerContainer}>
                {countdown > 0 ? (
                  <>
                    <span className={styles.clockIcon}>⏳</span>
                    <span>Resend OTP in </span>
                    <span className={styles.countdownText}>
                      0:{countdown.toString().padStart(2, "0")}
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.resendBtn}
                    onClick={handleResendOtp}
                    disabled={resending}
                  >
                    {resending ? "Sending fresh code..." : "🔄 Resend OTP Code"}
                  </button>
                )}
              </div>

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setPhase("form");
                  setError("");
                  setSuccess("");
                }}
              >
                ← Back to registration
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}