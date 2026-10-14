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
  useWindowDimensions,
} from "react-native";
import { Colors } from "../theme/colors";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

interface SignupScreenProps {
  onNavigateToLogin: () => void;
}

export const SignupScreen = ({ onNavigateToLogin }: SignupScreenProps) => {
  const { sendSignupOtp, verifySignupOtp, resendSignupOtp } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

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
    if (loading) return;

    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
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
    if (loading) return;

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
      console.log(err, 'err');
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
      {/* Ambient background glow orbs */}
      <View pointerEvents="none" style={styles.ambientAuraTop} />
      <View pointerEvents="none" style={styles.ambientAuraBottom} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && styles.scrollContentWide,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.responsiveWrapper, isWide && styles.responsiveWrapperWide]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoOuterRing}>
              <View style={styles.logoBadge}>
                <Ionicons name="flash" size={28} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.brandTitle}>SuperCall</Text>
            <Text style={styles.subtitle}>
              {step === "form"
                ? "Create your enterprise workspace account to host crystal-clear video meetings."
                : "Check your inbox for the 6-digit security verification code."}
            </Text>

            {/* Step Indicators */}
            <View style={styles.stepsRow}>
              <View style={[styles.stepPill, step === "form" ? styles.stepPillActive : styles.stepPillCompleted]}>
                <Ionicons
                  name={step === "otp" ? "checkmark-circle" : "person"}
                  size={14}
                  color={step === "form" ? "#ffffff" : Colors.success}
                />
                <Text style={[styles.stepPillText, step === "form" ? styles.stepPillTextActive : null]}>
                  1. Details
                </Text>
              </View>

              <View style={styles.stepConnector} />

              <View style={[styles.stepPill, step === "otp" ? styles.stepPillActive : null]}>
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={step === "otp" ? "#ffffff" : Colors.textSubtle}
                />
                <Text style={[styles.stepPillText, step === "otp" ? styles.stepPillTextActive : null]}>
                  2. Verification
                </Text>
              </View>
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#fca5a5" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#86efac" style={{ marginRight: 6 }} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {step === "form" ? (
              <>
                <Input
                  label="Full Name"
                  placeholder="e.g. Johnathan Doe"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                />

                <Input
                  label="Work Email Address"
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                />

                <Input
                  label="Password (min 8 chars)"
                  placeholder="Create a strong password"
                  isPassword
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                />

                <Button
                  title="Create Account &amp; Send OTP"
                  onPress={handleInitiateSignup}
                  loading={loading}
                  style={styles.actionBtn}
                />
              </>
            ) : (
              <>
                <View style={styles.otpNotice}>
                  <Text style={styles.otpNoticeLabel}>Verification code dispatched to:</Text>
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
                  title="Verify &amp; Enter Workspace"
                  onPress={handleVerifyOtp}
                  loading={loading}
                  style={styles.actionBtn}
                />

                <View style={styles.otpActions}>
                  <TouchableOpacity
                    disabled={countdown > 0 || resending}
                    onPress={handleResend}
                    style={styles.resendBtn}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.resendText,
                        countdown > 0 ? styles.resendDisabled : null,
                      ]}
                    >
                      {countdown > 0 ? `Resend security code in ${countdown}s` : "Resend Code"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setStep("form");
                      setOtp("");
                      setErrorMessage(null);
                    }}
                    style={styles.changeEmailBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.changeEmailText}>← Edit details / Change email</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.7} style={styles.loginLink}>
              <Text style={styles.loginLinkText}> Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    position: "relative",
  },
  ambientAuraTop: {
    position: "absolute",
    top: -70,
    alignSelf: "center",
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  ambientAuraBottom: {
    position: "absolute",
    bottom: -90,
    left: -40,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  scrollContentWide: {
    alignItems: "center",
  },
  responsiveWrapper: {
    width: "100%",
  },
  responsiveWrapperWide: {
    maxWidth: 460,
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 300,
    lineHeight: 19,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  stepPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepPillCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  stepPillText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 5,
  },
  stepPillTextActive: {
    color: "#ffffff",
  },
  stepConnector: {
    width: 20,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 8,
  },
  card: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontWeight: "500",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: "#86efac",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontWeight: "500",
  },
  actionBtn: {
    marginTop: 10,
  },
  otpNotice: {
    backgroundColor: "rgba(11, 17, 32, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  otpNoticeLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  otpNoticeEmail: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
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
    fontSize: 13,
    fontWeight: "700",
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
    fontWeight: "500",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 26,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  loginLink: {
    padding: 4,
  },
  loginLinkText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});

