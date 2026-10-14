import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../theme/colors";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import { DEFAULT_API_URL } from "../config/api";
import { Ionicons } from "@expo/vector-icons";

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const { user, logout, updateName, serverUrl, changeServerUrl } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Profile Edit
  const [name, setName] = useState(user?.name || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Server URL
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl || DEFAULT_API_URL);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }
    setIsUpdatingName(true);
    try {
      await updateName(name.trim());
      Alert.alert("Success", "Profile name updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update profile name.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please enter current and new password.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return;
    }
    setIsChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert("Success", "Password updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message || err?.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveServerUrl = async () => {
    const clean = customServerUrl.trim();
    if (!clean) return;
    await changeServerUrl(clean);
    Alert.alert("Server Config Updated", `Backend target set to:\n${clean}`);
  };

  const handleResetServerUrl = async () => {
    await changeServerUrl(DEFAULT_API_URL);
    setCustomServerUrl(DEFAULT_API_URL);
    Alert.alert("Reset", "Server URL reset to production Render deployment.");
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of SuperCall?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title="Settings &amp; Profile" showBack onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentWide,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.mainLayout, isTablet && styles.mainLayoutWide]}>
          {/* User Card */}
          {user ? (
            <View style={styles.userCard}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(user.name || "U")[0]?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
          ) : null}

          {/* Edit Profile */}
          {user ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Profile Details</Text>
              </View>
              <Input
                label="Display Name"
                value={name}
                onChangeText={setName}
              />
              <Button
                title="Save Profile Name"
                size="small"
                onPress={handleSaveProfile}
                loading={isUpdatingName}
              />
            </View>
          ) : null}

          {/* Change Password */}
          {user ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={Colors.accent} />
                </View>
                <Text style={styles.sectionTitle}>Security &amp; Password</Text>
              </View>
              <Input
                label="Current Password"
                placeholder="••••••••"
                isPassword
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <Input
                label="New Password"
                placeholder="••••••••"
                isPassword
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Button
                title="Update Password"
                size="small"
                variant="outline"
                onPress={handleChangePassword}
                loading={isChangingPassword}
              />
            </View>
          ) : null}

          {/* Backend Server Configuration */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconCircle}>
                <Ionicons name="server-outline" size={20} color={Colors.success} />
              </View>
              <Text style={styles.sectionTitle}>Backend Connection</Text>
            </View>
            <Text style={styles.sectionSub}>
              Configure the API and Socket server endpoint for testing over LAN or cloud infrastructure.
            </Text>

            <Input
              label="API Base URL"
              value={customServerUrl}
              onChangeText={setCustomServerUrl}
              autoCapitalize="none"
            />

            <View style={styles.serverActions}>
              <Button
                title="Apply Server URL"
                size="small"
                onPress={handleSaveServerUrl}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Reset Default"
                size="small"
                variant="secondary"
                onPress={handleResetServerUrl}
              />
            </View>
          </View>

          {/* Logout */}
          {user ? (
            <Button
              title="Sign Out of Workspace"
              variant="danger"
              onPress={handleLogout}
              style={styles.logoutBtn}
              icon={<Ionicons name="log-out-outline" size={18} color="#ffffff" />}
            />
          ) : null}

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>SuperCall Enterprise • Version 1.0.0 (Build 57)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentWide: {
    paddingHorizontal: 28,
  },
  mainLayout: {
    width: "100%",
  },
  mainLayoutWide: {
    maxWidth: 680,
    alignSelf: "center",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  verifiedText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  serverActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoutBtn: {
    marginTop: 10,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 28,
  },
  versionText: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: "500",
  },
});

