import React, { useState } from "react";
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

interface LoginScreenProps {
  onNavigateToSignup: () => void;
  onNavigateToSettings: () => void;
}

export const LoginScreen = ({ onNavigateToSignup, onNavigateToSettings }: LoginScreenProps) => {
  const { login } = useAuth();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isWide = width >= 768;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to sign in. Please verify your credentials.";
      setErrorMessage(msg);
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
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
          {/* Top bar with server settings icon */}
          <View style={styles.topBar}>
            <View style={styles.enterprisePill}>
              <View style={styles.liveDot} />
              <Text style={styles.enterprisePillText}>Enterprise HD</Text>
            </View>
            <TouchableOpacity
              onPress={onNavigateToSettings}
              activeOpacity={0.7}
              style={styles.settingsBtn}
            >
              <Ionicons name="settings-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.settingsText}>Server</Text>
            </TouchableOpacity>
          </View>

          {/* Logo & Headline */}
          <View style={styles.header}>
            <View style={styles.logoOuterRing}>
              <View style={styles.logoBadge}>
                <Ionicons name="flash" size={30} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.brandTitle}>SuperCall</Text>
            <Text style={styles.subtitle}>
              Secure, carrier-grade video conferencing and real-time collaboration.
            </Text>
          </View>

          {/* Frosted Glass Form Card */}
          <View style={styles.card}>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#fca5a5" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Input
              label="Email Address"
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
              label="Password"
              placeholder="••••••••"
              isPassword
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />

            <Button
              title="Sign In to Workspace"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
            />
          </View>

          {/* Footer switch to Signup */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an enterprise account?</Text>
            <TouchableOpacity onPress={onNavigateToSignup} activeOpacity={0.7} style={styles.signupLink}>
              <Text style={styles.signupLinkText}> Create one</Text>
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
    top: -80,
    alignSelf: "center",
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  ambientAuraBottom: {
    position: "absolute",
    bottom: -100,
    right: -50,
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
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  enterprisePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  enterprisePillText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  settingsText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
    lineHeight: 19,
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
  loginBtn: {
    marginTop: 10,
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
  signupLink: {
    padding: 4,
  },
  signupLinkText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});

