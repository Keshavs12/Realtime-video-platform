import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <Text style={styles.sectionHeading}>Recent Video Calls ({history.length})</Text>

        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color={Colors.textSubtle} />
            <Text style={styles.emptyTitle}>No call logs yet</Text>
            <Text style={styles.emptySub}>Calls you host or join will be recorded here.</Text>
          </View>
        ) : (
          history.map((entry, idx) => {
            const joinedDate = new Date(entry.joinedAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <View key={`${entry.roomCode}-${idx}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomCode}>Room {entry.roomCode}</Text>
                    <Text style={styles.dateText}>📅 {joinedDate}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
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
                      {entry.otherParticipantsCount} other(s)
                    </Text>
                  </View>
                </View>

                <Button
                  title="Re-open Meeting Room"
                  size="small"
                  variant="outline"
                  onPress={() => onJoinRoom(entry.roomCode)}
                  style={styles.reopenBtn}
                />
              </View>
            );
          })
        )}
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
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 14,
  },
  emptyContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 36,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  roomCode: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  dateText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  badge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  statText: {
    color: Colors.text,
    fontSize: 12,
    marginLeft: 4,
  },
  reopenBtn: {
    marginTop: 12,
  },
});
