import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, StatusBar, Linking } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SignupScreen } from "./src/screens/SignupScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { ScheduleScreen } from "./src/screens/ScheduleScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { RoomScreen } from "./src/screens/RoomScreen";
import { Colors } from "./src/theme/colors";
import { extractRoomCodeFromUrl } from "./src/services/linking.service";

type ScreenName = "login" | "signup" | "dashboard" | "schedule" | "history" | "settings" | "lobby" | "room";

const MainNavigator = () => {
  const { user, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("dashboard");
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const [initialMuteConfig, setInitialMuteConfig] = useState<{ isAudioMuted: boolean; isVideoMuted: boolean }>({
    isAudioMuted: false,
    isVideoMuted: false,
  });

  // Handle incoming deep links (cold start and runtime)
  useEffect(() => {
    const processUrl = (incomingUrl: string | null) => {
      const code = extractRoomCodeFromUrl(incomingUrl);
      if (code) {
        if (user) {
          setActiveRoomCode(code);
          setCurrentScreen("lobby");
        } else {
          setPendingRoomCode(code);
        }
      }
    };

    // Cold start (app opened by tapping a link when app was closed)
    Linking.getInitialURL().then(processUrl);

    // Runtime listener (app in foreground or background)
    const sub = Linking.addEventListener("url", (event) => {
      processUrl(event.url);
    });

    return () => {
      sub.remove();
    };
  }, [user]);

  // When user completes login/signup and there is a pending room from deep link
  useEffect(() => {
    if (user && pendingRoomCode) {
      setActiveRoomCode(pendingRoomCode);
      setCurrentScreen("lobby");
      setPendingRoomCode(null);
    }
  }, [user, pendingRoomCode]);

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
        initialAudioMuted={initialMuteConfig.isAudioMuted}
        initialVideoMuted={initialMuteConfig.isVideoMuted}
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
      return (
        <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
          <SignupScreen onNavigateToLogin={() => setCurrentScreen("login")} />
        </SafeAreaView>
      );
    }
    if (currentScreen === "settings") {
      return (
        <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
          <SettingsScreen onBack={() => setCurrentScreen("login")} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
        <LoginScreen
          onNavigateToSignup={() => setCurrentScreen("signup")}
          onNavigateToSettings={() => setCurrentScreen("settings")}
        />
      </SafeAreaView>
    );
  }

  // Authenticated Screen Switcher
  switch (currentScreen) {
    case "lobby":
      if (!activeRoomCode) {
        return (
          <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
            <DashboardScreen
              onJoinRoom={(code) => {
                setActiveRoomCode(code);
                setCurrentScreen("lobby");
              }}
              onNavigateToSchedule={() => setCurrentScreen("schedule")}
              onNavigateToHistory={() => setCurrentScreen("history")}
              onNavigateToSettings={() => setCurrentScreen("settings")}
            />
          </SafeAreaView>
        );
      }
      return (
        <LobbyScreen
          roomCode={activeRoomCode}
          onJoin={({ isAudioMuted, isVideoMuted }) => {
            setInitialMuteConfig({ isAudioMuted, isVideoMuted });
            setCurrentScreen("room");
          }}
          onCancel={() => {
            setActiveRoomCode(null);
            setCurrentScreen("dashboard");
          }}
        />
      );

    case "schedule":
      return (
        <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
          <ScheduleScreen
            onBack={() => setCurrentScreen("dashboard")}
            onJoinRoom={(code) => {
              setActiveRoomCode(code);
              setCurrentScreen("lobby");
            }}
          />
        </SafeAreaView>
      );

    case "history":
      return (
        <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
          <HistoryScreen
            onBack={() => setCurrentScreen("dashboard")}
            onJoinRoom={(code) => {
              setActiveRoomCode(code);
              setCurrentScreen("lobby");
            }}
          />
        </SafeAreaView>
      );

    case "settings":
      return (
        <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
          <SettingsScreen onBack={() => setCurrentScreen("dashboard")} />
        </SafeAreaView>
      );

    case "dashboard":
    default:
      return (
        <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
          <DashboardScreen
            onJoinRoom={(code) => {
              setActiveRoomCode(code);
              setCurrentScreen("lobby");
            }}
            onNavigateToSchedule={() => setCurrentScreen("schedule")}
            onNavigateToHistory={() => setCurrentScreen("history")}
            onNavigateToSettings={() => setCurrentScreen("settings")}
          />
        </SafeAreaView>
      );
  }
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#070b13" />
      <AuthProvider>
        <View style={styles.root}>
          <MainNavigator />
        </View>
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
