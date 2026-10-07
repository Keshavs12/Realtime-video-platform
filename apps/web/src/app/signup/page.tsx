"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, Mail, Clock, RotateCw, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";
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
    setError("");
    setSuccess("");

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPassword = formData.password;

    if (!cleanName || cleanName.length < 2) {
      setError("Please enter a valid full name (at least 2 characters).");
      return;
    }

    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!cleanPassword || cleanPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      await sendSignupOtp({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
      });
      setFormData((prev) => ({ ...prev, name: cleanName, email: cleanEmail }));
      setPhase("otp");
      setCountdown(60);
      setSuccess("A 6-digit verification code has been sent to your email!");
    } catch (err: any) {
      console.log(err, "ERR");
      setError(
        err.response?.data?.message ||
        (!err.response
          ? "Unable to reach server. Please ensure the backend server is running."
          : "Failed to send verification code. Please check your details.")
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
        void triggerVerification(newOtp.join(""));
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
      void triggerVerification(newOtp.join(""));
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
      const cleanEmail = formData.email.trim().toLowerCase();
      await resendSignupOtp(cleanEmail);
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
      const cleanEmail = formData.email.trim().toLowerCase();
      const response = await verifySignupOtp(cleanEmail, otpCode);
      const data = response?.data?.data || response?.data;
      const { user, accessToken, refreshToken } = data;

      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }

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
    void triggerVerification(otp.join(""));
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
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending Code…</span>
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <span>Create Account</span>
                    <ArrowRight size={16} />
                  </span>
                )}
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
              <Mail size={14} style={{ color: "#818cf8" }} />
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
                    key={["otp_digit_1", "otp_digit_2", "otp_digit_3", "otp_digit_4", "otp_digit_5", "otp_digit_6"][idx]}
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
                disabled={verifying || otp.includes("")}
              >
                {verifying ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying…</span>
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <span>Verify &amp; Continue</span>
                    <ArrowRight size={16} />
                  </span>
                )}
              </button>

              {/* 60 Seconds Countdown Timer / Resend Action */}
              <div className={styles.timerContainer}>
                {countdown > 0 ? (
                  <>
                    <Clock size={14} style={{ color: "#818cf8" }} />
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
                    <RotateCw size={14} className={resending ? "animate-spin" : ""} />
                    <span>{resending ? "Sending fresh code…" : "Resend OTP Code"}</span>
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
                <ArrowLeft size={15} />
                <span>Back to registration</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}