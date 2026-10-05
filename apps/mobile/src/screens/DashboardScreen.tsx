import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from "react-native";
import { Colors } from "../theme/colors";
import { StatCard } from "../components/StatCard";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { roomService } from "../services/room.service";
import { scheduleService } from "../services/schedule.service";
import { DashboardStats, ScheduledMeetingItem } from "../types";
import { Ionicons } from "@expo/vector-icons";

interface DashboardScreenProps {
  onJoinRoom: (roomCode: string) => void;
  onNavigateToSchedule: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
}

export const DashboardScreen = ({
  onJoinRoom,
  onNavigateToSchedule,
  onNavigateToHistory,
  onNavigateToSettings,
}: DashboardScreenProps) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    roomsHosted: 0,
    callMinutes: 0,
    activeNow: 0,
    totalParticipants: 0,
  });
  const [upcomingMeetings, setUpcomingMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [isCreatingInstant, setIsCreatingInstant] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [statsData, scheduleData] = await Promise.all([
        roomService.getDashboardStats().catch(() => ({
          roomsHosted: 0,
          callMinutes: 0,
          activeNow: 0,
          totalParticipants: 0,
        })),
        scheduleService.getScheduledMeetings().catch(() => []),
      ]);
      setStats(statsData);
      setUpcomingMeetings(scheduleData.slice(0, 3));
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleStartInstantMeeting = async () => {
    setIsCreatingInstant(true);
    try {
      const room = await roomService.createRoom();
      if (room?.code) {
        onJoinRoom(room.code);
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to create meeting room.";
      Alert.alert("Error", msg);
    } finally {
      setIsCreatingInstant(false);
    }
  };

  const handleJoinByCode = async () => {
    const clean = roomCodeInput.trim();
    if (!clean) {
      Alert.alert("Missing Room Code", "Please enter a valid room code or link.");
      return;
    }
    // Extract room code if user pasted a full URL
    const match = clean.match(/room\/([a-zA-Z0-9_-]+)/);
    const code = match ? match[1] : clean;

    try {
      await roomService.checkRoomExists(code);
      onJoinRoom(code);
    } catch {
      // Still allow joining as guest or let signaling handle room-not-found
      onJoinRoom(code);
    }
  };

  const userInitials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandIcon}>⚡</Text>
          <Text style={styles.brandTitle}>SuperCall</Text>
        </View>

        <TouchableOpacity onPress={onNavigateToSettings} style={styles.userBadge}>
          <Text style={styles.userInitials}>{userInitials}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeGreet}>Welcome,</Text>
          <Text style={styles.welcomeName}>{user?.name || "SuperCall User"}</Text>
          <Text style={styles.welcomeSubtitle}>Ready for high-quality audio and video meetings?</Text>
        </View>

        {/* Quick Action Cards */}
        <View style={styles.actionSection}>
          {/* Start Instant Meeting */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleStartInstantMeeting}
            style={styles.instantCallCard}
          >
            <View style={styles.instantIconWrapper}>
              <Ionicons name="videocam" size={28} color="#ffffff" />
            </View>
            <View style={styles.instantTextCol}>
              <Text style={styles.instantTitle}>
                {isCreatingInstant ? "Launching Room…" : "Start Instant Call"}
              </Text>
              <Text style={styles.instantSub}>Create room &amp; start meeting immediately</Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>

          {/* Join Room by Code */}
          <View style={styles.joinCodeCard}>
            <Text style={styles.joinCodeTitle}>Join with a Code</Text>
            <View style={styles.joinInputRow}>
              <TextInput
                style={styles.joinInput}
                placeholder="Enter room code or link"
                placeholderTextColor={Colors.textSubtle}
                value={roomCodeInput}
                onChangeText={setRoomCodeInput}
                autoCapitalize="none"
              />
              <Button
                title="Join"
                size="small"
                onPress={handleJoinByCode}
                style={styles.joinBtn}
              />
            </View>
          </View>
        </View>

        {/* Meeting Overview Stats */}
        <Text style={styles.sectionHeading}>Activity Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label="Rooms Hosted"
            value={stats.roomsHosted}
            icon="🎥"
            trend="+Active"
          />
          <StatCard
            label="Call Minutes"
            value={stats.callMinutes}
            icon="⏱️"
            trend="HD Audio"
          />
        </View>

        {/* Upcoming Scheduled Meetings */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Upcoming Meetings</Text>
          <TouchableOpacity onPress={onNavigateToSchedule}>
            <Text style={styles.viewAllText}>View All ({upcomingMeetings.length})</Text>
          </TouchableOpacity>
        </View>

        {upcomingMeetings.length === 0 ? (
          <View style={styles.emptyScheduleBox}>
            <Text style={styles.emptyScheduleIcon}>📅</Text>
            <Text style={styles.emptyScheduleText}>No upcoming meetings scheduled</Text>
            <Button
              title="Schedule a Meeting"
              variant="outline"
              size="small"
              onPress={onNavigateToSchedule}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : (
          upcomingMeetings.map((item) => {
            const dateStr = new Date(item.scheduledAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <View key={item.id} style={styles.meetingCard}>
                <View style={styles.meetingHeader}>
                  <Text style={styles.meetingTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{item.durationMinutes}m</Text>
                  </View>
                </View>
                <Text style={styles.meetingDate}>⏰ {dateStr}</Text>
                {item.inviteeList?.length > 0 ? (
                  <Text style={styles.meetingInvitees}>
                    👥 {item.inviteeList.length} invitee(s)
                  </Text>
                ) : null}
                <View style={styles.meetingActions}>
                  <Button
                    title="Join Room"
                    size="small"
                    onPress={() => onJoinRoom(item.roomCode)}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="View Details"
                    variant="outline"
                    size="small"
                    onPress={onNavigateToSchedule}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItemActive}>
          <Ionicons name="home" size={22} color={Colors.primary} />
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onNavigateToSchedule} style={styles.navItem}>
          <Ionicons name="calendar-outline" size={22} color={Colors.textMuted} />
          <Text style={styles.navText}>Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onNavigateToHistory} style={styles.navItem}>
          <Ionicons name="time-outline" size={22} color={Colors.textMuted} />
          <Text style={styles.navText}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onNavigateToSettings} style={styles.navItem}>
          <Ionicons name="person-outline" size={22} color={Colors.textMuted} />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navBar: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandIcon: {
    fontSize: 22,
    marginRight: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  userBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  userInitials: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  welcomeBanner: {
    marginBottom: 20,
  },
  welcomeGreet: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  welcomeName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: Colors.textSubtle,
    marginTop: 4,
  },
  actionSection: {
    marginBottom: 24,
  },
  instantCallCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  instantIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  instantTextCol: {
    flex: 1,
  },
  instantTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#ffffff",
  },
  instantSub: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  joinCodeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinCodeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  joinInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinInput: {
    flex: 1,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    marginRight: 10,
  },
  joinBtn: {
    paddingHorizontal: 18,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 12,
  },
  viewAllText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    marginBottom: 14,
  },
  emptyScheduleBox: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyScheduleIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyScheduleText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  meetingCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  meetingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    flex: 1,
    marginRight: 8,
  },
  durationBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  durationText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  meetingDate: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  meetingInvitees: {
    color: Colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
  },
  meetingActions: {
    flexDirection: "row",
    marginTop: 14,
  },
  bottomNav: {
    height: 64,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  navItemActive: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  navText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
    fontWeight: "500",
  },
  navTextActive: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 3,
    fontWeight: "700",
  },
});
