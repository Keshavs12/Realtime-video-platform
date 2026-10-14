import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../theme/colors";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { roomService } from "../services/room.service";
import { RoomHistoryEntry } from "../types";
import { Ionicons } from "@expo/vector-icons";

interface HistoryScreenProps {
  onBack: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const HistoryScreen = ({ onBack, onJoinRoom }: HistoryScreenProps) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [history, setHistory] = useState<RoomHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await roomService.getRoomHistory();
      setHistory(data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Header title="Call History" showBack onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentWide,
        ]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={[styles.mainLayout, isTablet && styles.mainLayoutWide]}>
          <View style={styles.headingRow}>
            <Text style={styles.sectionHeading}>Recent Video Calls ({history.length})</Text>
            <View style={styles.logPill}>
              <View style={styles.logDot} />
              <Text style={styles.logPillText}>Cloud History</Text>
            </View>
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="time-outline" size={32} color={Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No call logs yet</Text>
              <Text style={styles.emptySub}>Calls you host or join will automatically be recorded here.</Text>
            </View>
          ) : (
            <View style={[styles.historyGrid, isTablet && styles.historyGridTablet]}>
              {history.map((entry, idx) => {
                const joinedDate = new Date(entry.joinedAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <View
                    key={`${entry.roomCode}-${idx}`}
                    style={[styles.card, isTablet && styles.cardHalf]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={styles.roomCodeRow}>
                          <Ionicons name="videocam" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                          <Text style={styles.roomCode}>Room {entry.roomCode}</Text>
                        </View>
                        <Text style={styles.dateText}>📅 {joinedDate}</Text>
                      </View>
                      <View style={[styles.badge, entry.isHost ? styles.badgeHost : styles.badgeJoined]}>
                        <Text style={[styles.badgeText, entry.isHost ? styles.badgeHostText : null]}>
                          {entry.isHost ? "👑 Hosted" : "Joined"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statPill}>
                        <Ionicons name="hourglass-outline" size={14} color={Colors.accent} />
                        <Text style={styles.statText}>{entry.durationMinutes || 1} min(s)</Text>
                      </View>

                      <View style={styles.statPill}>
                        <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
                        <Text style={styles.statText}>
                          {entry.otherParticipantsCount} participant(s)
                        </Text>
                      </View>
                    </View>

                    <Button
                      title="🚀 Re-open Meeting Room"
                      size="small"
                      variant="outline"
                      onPress={() => onJoinRoom(entry.roomCode)}
                      style={styles.reopenBtn}
                    />
                  </View>
                );
              })}
            </View>
          )}
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
    maxWidth: 1080,
    alignSelf: "center",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  logPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  logDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginRight: 5,
  },
  logPillText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyContainer: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  historyGrid: {
    width: "100%",
  },
  historyGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  card: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHalf: {
    width: "48.5%",
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  roomCodeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roomCode: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  dateText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 5,
    fontWeight: "500",
  },
  badge: {
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeHost: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.30)",
  },
  badgeJoined: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  badgeText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  badgeHostText: {
    color: Colors.success,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 14,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 17, 32, 0.70)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginRight: 8,
  },
  statText: {
    color: Colors.text,
    fontSize: 12,
    marginLeft: 5,
    fontWeight: "500",
  },
  reopenBtn: {
    marginTop: 14,
  },
});

