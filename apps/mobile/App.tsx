import React, { useState } from "react";
import { View, ActivityIndicator, StyleSheet, StatusBar } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SignupScreen } from "./src/screens/SignupScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { ScheduleScreen } from "./src/screens/ScheduleScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { RoomScreen } from "./src/screens/RoomScreen";
import { Colors } from "./src/theme/colors";

type ScreenName = "login" | "signup" | "dashboard" | "schedule" | "history" | "settings" | "room";

const MainNavigator = () => {
  const { user, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("dashboard");
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Active in a video room
  if (activeRoomCode && currentScreen === "room") {
    return (
      <RoomScreen
        roomCode={activeRoomCode}
        onLeaveRoom={() => {
          setActiveRoomCode(null);
          setCurrentScreen("dashboard");
        }}
      />
    );
  }

  // Not authenticated
  if (!user) {
    if (currentScreen === "signup") {
      return <SignupScreen onNavigateToLogin={() => setCurrentScreen("login")} />;
    }
    if (currentScreen === "settings") {
      return <SettingsScreen onBack={() => setCurrentScreen("login")} />;
    }
    return (
      <LoginScreen
        onNavigateToSignup={() => setCurrentScreen("signup")}
        onNavigateToSettings={() => setCurrentScreen("settings")}
      />
    );
  }

  // Authenticated Screen Switcher
  switch (currentScreen) {
    case "schedule":
      return (
        <ScheduleScreen
          onBack={() => setCurrentScreen("dashboard")}
          onJoinRoom={(code) => {
            setActiveRoomCode(code);
            setCurrentScreen("room");
          }}
        />
      );

    case "history":
      return (
        <HistoryScreen
          onBack={() => setCurrentScreen("dashboard")}
          onJoinRoom={(code) => {
            setActiveRoomCode(code);
            setCurrentScreen("room");
          }}
        />
      );

    case "settings":
      return <SettingsScreen onBack={() => setCurrentScreen("dashboard")} />;

    case "dashboard":
    default:
      return (
        <DashboardScreen
          onJoinRoom={(code) => {
            setActiveRoomCode(code);
            setCurrentScreen("room");
          }}
          onNavigateToSchedule={() => setCurrentScreen("schedule")}
          onNavigateToHistory={() => setCurrentScreen("history")}
          onNavigateToSettings={() => setCurrentScreen("settings")}
        />
      );
  }
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />
      <AuthProvider>
        <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
          <MainNavigator />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
