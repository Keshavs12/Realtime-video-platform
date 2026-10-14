import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { Participant } from "../types";

interface HostControlsModalProps {
  visible: boolean;
  onClose: () => void;
  isRoomLocked: boolean;
  participants: Participant[];
  onToggleLock: () => void;
  onMuteAll: () => void;
  onMuteParticipant: (socketId: string) => void;
  onKickParticipant: (socketId: string) => void;
}

export const HostControlsModal = ({
  visible,
  onClose,
  isRoomLocked,
  participants,
  onToggleLock,
  onMuteAll,
  onMuteParticipant,
  onKickParticipant,
}: HostControlsModalProps) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const confirmMuteAll = () => {
    Alert.alert("Mute All Participants", "Are you sure you want to mute everyone in the meeting?", [
      { text: "Cancel", style: "cancel" },
      { text: "Mute All", style: "destructive", onPress: onMuteAll },
    ]);
  };

  const confirmKick = (peer: Participant) => {
    Alert.alert(
      "Remove Participant",
      `Are you sure you want to remove ${peer.name || "this participant"} from the call?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onKickParticipant(peer.socketId),
        },
      ]
    );
  };

  const renderParticipantItem = ({ item }: { item: Participant }) => {
    return (
      <View style={styles.peerRow}>
        <View style={styles.peerInfoRow}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{(item.name || "U")[0].toUpperCase()}</Text>
          </View>
          <View style={styles.peerDetails}>
            <Text style={styles.peerName}>
              {item.name || "Participant"} {item.isHost ? "👑 (Host)" : ""}
            </Text>
            <Text style={styles.peerSub}>
              {item.isAudioMuted ? "🔇 Audio Muted" : "🎙️ Mic Active"}
            </Text>
          </View>
        </View>

        {!item.isHost ? (
          <View style={styles.peerActionsRow}>
            {/* Mute button */}
            <TouchableOpacity
              onPress={() => onMuteParticipant(item.socketId)}
              style={styles.actionIconBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="mic-off" size={16} color={Colors.warning} />
            </TouchableOpacity>

            {/* Kick button */}
            <TouchableOpacity
              onPress={() => confirmKick(item)}
              style={[styles.actionIconBtn, styles.actionKickBtn]}
              activeOpacity={0.7}
            >
              <Ionicons name="person-remove" size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType={isTablet ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isTablet && styles.overlayTablet]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.accent} />
              </View>
              <View>
                <Text style={styles.title}>Host Meeting Controls</Text>
                <Text style={styles.subtitle}>Administrative privileges for this room</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Quick Actions Bar */}
          <View style={styles.quickBar}>
            {/* Lock Meeting Button */}
            <TouchableOpacity
              onPress={onToggleLock}
              style={[styles.quickCard, isRoomLocked && styles.quickCardLocked]}
              activeOpacity={0.75}
            >
              <View style={[styles.quickIconCircle, isRoomLocked ? styles.quickIconLocked : styles.quickIconUnlocked]}>
                <Ionicons
                  name={isRoomLocked ? "lock-closed" : "lock-open"}
                  size={20}
                  color={isRoomLocked ? Colors.danger : Colors.accent}
                />
              </View>
              <Text style={styles.quickCardTitle}>
                {isRoomLocked ? "Room Locked" : "Room Unlocked"}
              </Text>
              <Text style={styles.quickCardSub}>
                {isRoomLocked ? "No new users can join" : "Anyone with link can join"}
              </Text>
            </TouchableOpacity>

            {/* Mute All Button */}
            <TouchableOpacity onPress={confirmMuteAll} style={styles.quickCard} activeOpacity={0.75}>
              <View style={[styles.quickIconCircle, { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.3)" }]}>
                <Ionicons name="volume-mute" size={20} color={Colors.warning} />
              </View>
              <Text style={styles.quickCardTitle}>Mute Everyone</Text>
              <Text style={styles.quickCardSub}>Silence all attendees</Text>
            </TouchableOpacity>
          </View>

          {/* Participant Management List */}
          <View style={styles.listSection}>
            <Text style={styles.sectionHeader}>
              Manage Participants ({participants.length})
            </Text>

            {participants.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyText}>No other participants in room yet</Text>
              </View>
            ) : (
              <FlatList
                data={participants}
                keyExtractor={(item) => item.socketId}
                renderItem={renderParticipantItem}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  overlayTablet: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    minHeight: "55%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 16,
  },
  containerTablet: {
    width: "100%",
    maxWidth: 580,
    height: 640,
    borderRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(18, 25, 45, 0.85)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickBar: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  quickCardLocked: {
    borderColor: "rgba(239, 68, 68, 0.4)",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  quickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickIconUnlocked: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  quickIconLocked: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  quickCardTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  quickCardSub: {
    color: "#94a3b8",
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
    fontWeight: "500",
  },
  listSection: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  peerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  peerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  avatarMini: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  avatarMiniText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  peerDetails: {
    flex: 1,
  },
  peerName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  peerSub: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  peerActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionKickBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIconBg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "500",
  },
});
