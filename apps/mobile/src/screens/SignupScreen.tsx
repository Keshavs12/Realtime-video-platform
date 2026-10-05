import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";

interface SignupScreenProps {
  onNavigateToLogin: () => void;
}

export const SignupScreen = ({ onNavigateToLogin }: SignupScreenProps) => {
  const { sendSignupOtp, verifySignupOtp, resendSignupOtp } = useAuth();

  // Step 1: Input details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: OTP verification
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (step === "otp" && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Step 1 Submit: Send OTP
  const handleInitiateSignup = async () => {
    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await sendSignupOtp(name.trim(), email.trim().toLowerCase(), password);
      setStep("otp");
      setCountdown(60);
      setSuccessMessage(`Verification code sent to ${email.trim().toLowerCase()}!`);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to send verification code. Please try again.";
      setErrorMessage(msg);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Submit: Verify OTP
  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await verifySignupOtp(email.trim().toLowerCase(), cleanOtp);
      // AuthContext will automatically update user state, transitioning to main app
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Invalid verification code. Please check and try again.";
      setErrorMessage(msg);
      Alert.alert("Verification Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setErrorMessage(null);
    try {
      await resendSignupOtp(email.trim().toLowerCase());
      setCountdown(60);
      setSuccessMessage("A fresh code has been dispatched to your inbox.");
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to resend code.";
      setErrorMessage(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.brandTitle}>SuperCall</Text>
          <Text style={styles.subtitle}>
            {step === "form"
              ? "Create your account to start meeting with crystal clear video."
              : "Check your inbox for the 6-digit verification code."}
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✅ {successMessage}</Text>
            </View>
          ) : null}

          {step === "form" ? (
            <>
              <Input
                label="Full Name"
                placeholder="John Doe"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <Input
                label="Email Address"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <Input
                label="Password"
                placeholder="At least 6 characters"
                isPassword
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <Button
                title="Create Account & Send Code"
                onPress={handleInitiateSignup}
                loading={loading}
                style={styles.actionBtn}
              />
            </>
          ) : (
            <>
              <View style={styles.otpNotice}>
                <Text style={styles.otpNoticeLabel}>Code sent to:</Text>
                <Text style={styles.otpNoticeEmail}>{email}</Text>
              </View>

              <Input
                label="6-Digit Verification Code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(text) => {
                  setOtp(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <Button
                title="Verify & Complete Signup"
                onPress={handleVerifyOtp}
                loading={loading}
                style={styles.actionBtn}
              />

              <View style={styles.otpActions}>
                <TouchableOpacity
                  disabled={countdown > 0 || resending}
                  onPress={handleResend}
                  style={styles.resendBtn}
                >
                  <Text
                    style={[
                      styles.resendText,
                      countdown > 0 ? styles.resendDisabled : null,
                    ]}
                  >
                    {countdown > 0 ? `Resend code in ${countdown}s` : "Resend Code"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setStep("form");
                    setOtp("");
                    setErrorMessage(null);
                  }}
                  style={styles.changeEmailBtn}
                >
                  <Text style={styles.changeEmailText}>Edit details / Change email</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={onNavigateToLogin} style={styles.loginLink}>
            <Text style={styles.loginLinkText}> Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoIcon: {
    fontSize: 28,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 290,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: "#86efac",
    fontSize: 13,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: 8,
  },
  otpNotice: {
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  otpNoticeLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  otpNoticeEmail: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  otpActions: {
    marginTop: 18,
    alignItems: "center",
  },
  resendBtn: {
    padding: 8,
  },
  resendText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  resendDisabled: {
    color: Colors.textSubtle,
  },
  changeEmailBtn: {
    marginTop: 8,
    padding: 6,
  },
  changeEmailText: {
    color: Colors.textMuted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  loginLink: {
    padding: 4,
  },
  loginLinkText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
});
