import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* User Card */}
        {user ? (
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.name || "U")[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        ) : null}

        {/* Edit Profile */}
        {user ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Profile Details</Text>
            <Input
              label="Display Name"
              value={name}
              onChangeText={setName}
            />
            <Button
              title="Save Name"
              size="small"
              onPress={handleSaveProfile}
              loading={isUpdatingName}
            />
          </View>
        ) : null}

        {/* Change Password */}
        {user ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Security &amp; Password</Text>
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

        {/* Backend Server Configuration (Very helpful for dev vs prod) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Backend Connection</Text>
          <Text style={styles.sectionSub}>
            Configure the API and Socket server endpoint for testing over LAN or cloud.
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
            title="Sign Out"
            variant="danger"
            onPress={handleLogout}
            style={styles.logoutBtn}
            icon={<Ionicons name="log-out-outline" size={18} color="#ffffff" />}
          />
        ) : null}

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>SuperCall Mobile • Version 1.0.0</Text>
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
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 14,
    lineHeight: 16,
  },
  serverActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoutBtn: {
    marginTop: 8,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 28,
  },
  versionText: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
});
