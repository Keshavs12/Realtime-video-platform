import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
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
            >
              <Ionicons name="mic-off" size={16} color={Colors.warning} />
            </TouchableOpacity>

            {/* Kick button */}
            <TouchableOpacity
              onPress={() => confirmKick(item)}
              style={[styles.actionIconBtn, styles.actionKickBtn]}
            >
              <Ionicons name="person-remove" size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
              <Text style={styles.title}>Host Meeting Controls</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Quick Actions Bar */}
          <View style={styles.quickBar}>
            {/* Lock Meeting Button */}
            <TouchableOpacity
              onPress={onToggleLock}
              style={[styles.quickCard, isRoomLocked && styles.quickCardLocked]}
            >
              <Ionicons
                name={isRoomLocked ? "lock-closed" : "lock-open"}
                size={22}
                color={isRoomLocked ? Colors.danger : Colors.accent}
              />
              <Text style={styles.quickCardTitle}>
                {isRoomLocked ? "Room Locked" : "Room Unlocked"}
              </Text>
              <Text style={styles.quickCardSub}>
                {isRoomLocked ? "No new users can join" : "Anyone with link can join"}
              </Text>
            </TouchableOpacity>

            {/* Mute All Button */}
            <TouchableOpacity onPress={confirmMuteAll} style={styles.quickCard}>
              <Ionicons name="volume-mute" size={22} color={Colors.warning} />
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
                <Text style={styles.emptyText}>No other participants in room yet.</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: "55%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  quickBar: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  quickCardLocked: {
    borderColor: Colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  quickCardTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  quickCardSub: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  listSection: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  peerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.cardSecondary,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  peerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarMiniText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  peerDetails: {
    flex: 1,
  },
  peerName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  peerSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  peerActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionKickBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
