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
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

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
      setUpcomingMeetings(scheduleData.slice(0, 4));
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
    const match = clean.match(/room\/([a-zA-Z0-9_-]+)/);
    const code = match ? match[1] : clean;

    try {
      await roomService.checkRoomExists(code);
      onJoinRoom(code);
    } catch {
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
      {/* Ambient background glows */}
      <View pointerEvents="none" style={styles.ambientGlowTop} />
      <View pointerEvents="none" style={styles.ambientGlowBottom} />

      {/* Top Navbar */}
      <View style={styles.navBar}>
        <View style={[styles.navInner, isTablet && styles.navInnerWide]}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconCircle}>
              <Ionicons name="flash" size={17} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.brandTitle}>SuperCall</Text>
              <Text style={styles.brandSubtitle}>ENTERPRISE WORKSPACE</Text>
            </View>
          </View>

          <View style={styles.navRightRow}>
            <View style={styles.hdStatusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.hdStatusText}>HD Ready</Text>
            </View>

            <TouchableOpacity
              onPress={onNavigateToSettings}
              activeOpacity={0.75}
              style={styles.userBadge}
            >
              <Text style={styles.userInitials}>{userInitials}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentWide,
        ]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={[styles.mainLayout, isTablet && styles.mainLayoutWide]}>
          {/* Welcome Banner */}
          <View style={styles.welcomeBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeGreet}>Welcome back,</Text>
              <Text style={styles.welcomeName}>{user?.name || "SuperCall User"}</Text>
              <Text style={styles.welcomeSubtitle}>
                Instant encrypted video rooms, scheduled calls, and interactive whiteboard collaboration.
              </Text>
            </View>
          </View>

          {/* Quick Action Cards (Responsive 2-column on tablet/desktop) */}
          <View style={[styles.actionSection, isTablet && styles.actionSectionTablet]}>
            {/* Start Instant Meeting */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleStartInstantMeeting}
              style={[styles.instantCallCard, isTablet && styles.actionCardHalf]}
            >
              <View style={styles.instantIconWrapper}>
                <Ionicons name="videocam" size={26} color="#ffffff" />
              </View>
              <View style={styles.instantTextCol}>
                <Text style={styles.instantTitle}>
                  {isCreatingInstant ? "Launching Room…" : "Start Instant Call"}
                </Text>
                <Text style={styles.instantSub}>Create room &amp; invite team members instantly</Text>
              </View>
              <View style={styles.arrowCircle}>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </View>
            </TouchableOpacity>

            {/* Join Room by Code */}
            <View style={[styles.joinCodeCard, isTablet && styles.actionCardHalf]}>
              <View style={styles.joinCodeHeader}>
                <Ionicons name="key-outline" size={16} color={Colors.accent} style={{ marginRight: 6 }} />
                <Text style={styles.joinCodeTitle}>Join Meeting via Code</Text>
              </View>
              <View style={styles.joinInputRow}>
                <TextInput
                  style={styles.joinInput}
                  placeholder="Enter 6-char code or link"
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

          {/* Meeting Overview Stats (4 cards, responsive layout) */}
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionHeading}>Activity &amp; Usage Overview</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveIndicatorDot} />
              <Text style={styles.liveIndicatorText}>Live Metrics</Text>
            </View>
          </View>

          <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
            <View style={[styles.statCol, isTablet && styles.statColTablet]}>
              <StatCard
                label="Rooms Hosted"
                value={stats.roomsHosted}
                icon="🎥"
                trend="+Active"
              />
            </View>
            <View style={[styles.statCol, isTablet && styles.statColTablet]}>
              <StatCard
                label="Call Minutes"
                value={stats.callMinutes}
                icon="⏱️"
                trend="HD Audio"
              />
            </View>
            <View style={[styles.statCol, isTablet && styles.statColTablet]}>
              <StatCard
                label="Active Rooms"
                value={stats.activeNow}
                icon="⚡"
                trend="Realtime"
              />
            </View>
            <View style={[styles.statCol, isTablet && styles.statColTablet]}>
              <StatCard
                label="Participants"
                value={stats.totalParticipants}
                icon="👥"
                trend="Global"
              />
            </View>
          </View>

          {/* Upcoming Scheduled Meetings */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Upcoming Video Meetings</Text>
            <TouchableOpacity onPress={onNavigateToSchedule} activeOpacity={0.7} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All ({upcomingMeetings.length})</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          {upcomingMeetings.length === 0 ? (
            <View style={styles.emptyScheduleBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="calendar-outline" size={28} color={Colors.accent} />
              </View>
              <Text style={styles.emptyScheduleTitle}>No upcoming meetings scheduled</Text>
              <Text style={styles.emptyScheduleText}>
                Plan your sessions ahead and dispatch automated email invitations to guests.
              </Text>
              <Button
                title="+ Schedule a Meeting"
                variant="outline"
                size="small"
                onPress={onNavigateToSchedule}
                style={{ marginTop: 14 }}
              />
            </View>
          ) : (
            <View style={[styles.meetingsContainer, isTablet && styles.meetingsContainerTablet]}>
              {upcomingMeetings.map((item) => {
                const dateStr = new Date(item.scheduledAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <View
                    key={item.id}
                    style={[styles.meetingCard, isTablet && styles.meetingCardHalf]}
                  >
                    <View style={styles.meetingHeader}>
                      <Text style={styles.meetingTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{item.durationMinutes}m</Text>
                      </View>
                    </View>

                    <View style={styles.meetingDetailRow}>
                      <Ionicons name="time-outline" size={14} color={Colors.accent} />
                      <Text style={styles.meetingDate}>{dateStr}</Text>
                    </View>

                    {item.inviteeList?.length > 0 ? (
                      <View style={styles.meetingDetailRow}>
                        <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
                        <Text style={styles.meetingInvitees}>
                          {item.inviteeList.length} invitee(s)
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.meetingActions}>
                      <Button
                        title="🚀 Join Room"
                        size="small"
                        onPress={() => onJoinRoom(item.roomCode)}
                        style={{ flex: 1, marginRight: 8 }}
                      />
                      <Button
                        title="Details"
                        variant="secondary"
                        size="small"
                        onPress={onNavigateToSchedule}
                        style={{ paddingHorizontal: 16 }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Frosted Glass Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <View style={[styles.bottomNavInner, isTablet && styles.bottomNavInnerWide]}>
          <TouchableOpacity activeOpacity={0.7} style={styles.navItemActive}>
            <View style={styles.navActivePill}>
              <Ionicons name="home" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.navTextActive}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onNavigateToSchedule} activeOpacity={0.7} style={styles.navItem}>
            <Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.navText}>Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onNavigateToHistory} activeOpacity={0.7} style={styles.navItem}>
            <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.navText}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onNavigateToSettings} activeOpacity={0.7} style={styles.navItem}>
            <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.navText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    position: "relative",
  },
  ambientGlowTop: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(99, 102, 241, 0.10)",
  },
  ambientGlowBottom: {
    position: "absolute",
    bottom: -60,
    left: -40,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  navBar: {
    height: 64,
    backgroundColor: "rgba(10, 15, 29, 0.88)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
  },
  navInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    width: "100%",
  },
  navInnerWide: {
    maxWidth: 1080,
    alignSelf: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  navRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hdStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.28)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 5,
  },
  hdStatusText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: "700",
  },
  userBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  userInitials: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  scrollContentWide: {
    paddingHorizontal: 28,
  },
  mainLayout: {
    width: "100%",
  },
  mainLayoutWide: {
    maxWidth: 1080,
    alignSelf: "center",
  },
  welcomeBanner: {
    marginBottom: 20,
    paddingVertical: 4,
  },
  welcomeGreet: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  welcomeName: {
    fontSize: 26,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  actionSection: {
    marginBottom: 24,
  },
  actionSectionTablet: {
    flexDirection: "row",
    gap: 16,
  },
  actionCardHalf: {
    flex: 1,
    marginBottom: 0,
  },
  instantCallCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  instantIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
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
    letterSpacing: -0.3,
  },
  instantSub: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.82)",
    marginTop: 3,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  joinCodeCard: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  joinCodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  joinCodeTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  joinInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinInput: {
    flex: 1,
    backgroundColor: "rgba(11, 17, 32, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.text,
    fontSize: 14,
    marginRight: 10,
  },
  joinBtn: {
    paddingHorizontal: 18,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginRight: 5,
  },
  liveIndicatorText: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 20,
  },
  statsGridTablet: {
    flexDirection: "row",
    flexWrap: "nowrap",
  },
  statCol: {
    width: "50%",
  },
  statColTablet: {
    width: "25%",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyScheduleBox: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyScheduleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  emptyScheduleText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 18,
  },
  meetingsContainer: {
    width: "100%",
  },
  meetingsContainerTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  meetingCard: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  meetingCardHalf: {
    width: "48.5%",
    marginBottom: 0,
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
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.30)",
  },
  durationText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  meetingDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  meetingDate: {
    color: Colors.textMuted,
    fontSize: 13,
    marginLeft: 6,
    fontWeight: "500",
  },
  meetingInvitees: {
    color: Colors.textSubtle,
    fontSize: 12,
    marginLeft: 6,
  },
  meetingActions: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    backgroundColor: "rgba(10, 15, 29, 0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.10)",
    justifyContent: "center",
  },
  bottomNavInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
  },
  bottomNavInnerWide: {
    maxWidth: 640,
    alignSelf: "center",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  navItemActive: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  navActivePill: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  navText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
    fontWeight: "600",
  },
  navTextActive: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 3,
    fontWeight: "800",
  },
});

