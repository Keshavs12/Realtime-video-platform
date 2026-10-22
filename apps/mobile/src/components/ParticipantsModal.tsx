import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  Alert,
  useWindowDimensions,
  Vibration,
} from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { Participant, User } from "../types";

interface ParticipantsModalProps {
  visible: boolean;
  onClose: () => void;
  participants: Participant[];
  currentUser: User | null;
  isHost: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isHandRaised?: boolean;
  pinnedSocketId?: string | null;
  onPinParticipant?: (socketId: string) => void;
  onMuteParticipant?: (socketId: string) => void;
  onKickParticipant?: (socketId: string) => void;
  onMuteAll?: () => void;
}

export const ParticipantsModal = ({
  visible,
  onClose,
  participants,
  currentUser,
  isHost,
  isAudioMuted,
  isVideoMuted,
  isHandRaised,
  pinnedSocketId,
  onPinParticipant,
  onMuteParticipant,
  onKickParticipant,
  onMuteAll,
}: ParticipantsModalProps) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [searchQuery, setSearchQuery] = useState("");

  const totalCount = participants.length + 1; // Remote + Local

  // Filter remote participants based on search query
  const filteredRemote = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    const query = searchQuery.toLowerCase().trim();
    return participants.filter((p) => (p.name || "Participant").toLowerCase().includes(query));
  }, [participants, searchQuery]);

  // Check if local user matches search
  const isLocalUserMatched = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const myName = (currentUser?.name || "You").toLowerCase();
    return myName.includes(searchQuery.toLowerCase().trim());
  }, [currentUser?.name, searchQuery]);

  const handleConfirmMuteAll = () => {
    try { Vibration.vibrate(40); } catch {}
    Alert.alert(
      "Mute All Participants",
      "Are you sure you want to mute everyone in the meeting?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute All",
          style: "destructive",
          onPress: () => {
            try { Vibration.vibrate(30); } catch {}
            onMuteAll?.();
          },
        },
      ]
    );
  };

  const handleConfirmKick = (peer: Participant) => {
    try { Vibration.vibrate(40); } catch {}
    Alert.alert(
      "Remove Participant",
      `Are you sure you want to remove ${peer.name || "this participant"} from the call?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            try { Vibration.vibrate(50); } catch {}
            onKickParticipant?.(peer.socketId);
          },
        },
      ]
    );
  };

  const handlePin = (socketId: string) => {
    try { Vibration.vibrate(35); } catch {}
    onPinParticipant?.(socketId);
  };

  const handleMute = (socketId: string) => {
    try { Vibration.vibrate(30); } catch {}
    onMuteParticipant?.(socketId);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isTablet && styles.modalCardTablet]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="people" size={18} color="#818cf8" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Participants</Text>
                <Text style={styles.headerSubtitle}>{totalCount} in this call</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Host Mute All button */}
              {isHost && participants.length > 0 && onMuteAll && (
                <TouchableOpacity
                  onPress={handleConfirmMuteAll}
                  style={styles.muteAllBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mic-off-outline" size={14} color="#f87171" style={{ marginRight: 4 }} />
                  <Text style={styles.muteAllText}>Mute All</Text>
                </TouchableOpacity>
              )}

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => {
                  try { Vibration.vibrate(20); } catch {}
                  onClose();
                }}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search participants…"
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Participants Scroll List */}
          <FlatList
            data={filteredRemote}
            keyExtractor={(item) => item.socketId}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              isLocalUserMatched ? (
                <View style={[styles.participantRow, styles.localParticipantRow]}>
                  <View style={styles.userInfoCol}>
                    <View style={[styles.avatar, styles.localAvatar]}>
                      <Text style={styles.avatarText}>
                        {(currentUser?.name || "Y")[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.nameBlock}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={styles.participantName}>
                          {currentUser?.name || "You"}
                        </Text>
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                        {isHost && (
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeText}>HOST</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.statusChipsRow}>
                        {isHandRaised && (
                          <View style={styles.handChip}>
                            <Text style={styles.handChipText}>✋ Hand Raised</Text>
                          </View>
                        )}
                        <View style={[styles.mediaChip, isAudioMuted ? styles.mediaChipOff : styles.mediaChipOn]}>
                          <Ionicons
                            name={isAudioMuted ? "mic-off" : "mic"}
                            size={12}
                            color={isAudioMuted ? "#f87171" : "#34d399"}
                          />
                          <Text style={[styles.mediaChipText, isAudioMuted ? styles.mediaChipTextOff : styles.mediaChipTextOn]}>
                            {isAudioMuted ? "Muted" : "Mic On"}
                          </Text>
                        </View>
                        <View style={[styles.mediaChip, isVideoMuted ? styles.mediaChipOff : styles.mediaChipOn]}>
                          <Ionicons
                            name={isVideoMuted ? "videocam-off" : "videocam"}
                            size={12}
                            color={isVideoMuted ? "#94a3b8" : "#34d399"}
                          />
                          <Text style={[styles.mediaChipText, isVideoMuted ? styles.mediaChipTextOff : styles.mediaChipTextOn]}>
                            {isVideoMuted ? "Camera Off" : "Video"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Pin Local Action */}
                  {onPinParticipant && (
                    <TouchableOpacity
                      onPress={() => handlePin("local")}
                      style={[
                        styles.pinActionBtn,
                        pinnedSocketId === "local" && styles.pinActionBtnActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={pinnedSocketId === "local" ? "pin" : "pin-outline"}
                        size={16}
                        color={pinnedSocketId === "local" ? "#818cf8" : Colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isPinned = pinnedSocketId === item.socketId;
              return (
                <View style={styles.participantRow}>
                  <View style={styles.userInfoCol}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(item.name || "U")[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.nameBlock}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={styles.participantName}>
                          {item.name || "Participant"}
                        </Text>
                        {item.isHost && (
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeText}>HOST</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.statusChipsRow}>
                        {item.isHandRaised && (
                          <View style={styles.handChip}>
                            <Text style={styles.handChipText}>✋ Hand Raised</Text>
                          </View>
                        )}
                        <View style={[styles.mediaChip, item.isAudioMuted ? styles.mediaChipOff : styles.mediaChipOn]}>
                          <Ionicons
                            name={item.isAudioMuted ? "mic-off" : "mic"}
                            size={12}
                            color={item.isAudioMuted ? "#f87171" : "#34d399"}
                          />
                          <Text style={[styles.mediaChipText, item.isAudioMuted ? styles.mediaChipTextOff : styles.mediaChipTextOn]}>
                            {item.isAudioMuted ? "Muted" : "Mic On"}
                          </Text>
                        </View>
                        <View style={[styles.mediaChip, item.isVideoMuted ? styles.mediaChipOff : styles.mediaChipOn]}>
                          <Ionicons
                            name={item.isVideoMuted ? "videocam-off" : "videocam"}
                            size={12}
                            color={item.isVideoMuted ? "#94a3b8" : "#34d399"}
                          />
                          <Text style={[styles.mediaChipText, item.isVideoMuted ? styles.mediaChipTextOff : styles.mediaChipTextOn]}>
                            {item.isVideoMuted ? "Camera Off" : "Video"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Remote Participant Action Buttons */}
                  <View style={styles.actionsGroup}>
                    {/* Pin button */}
                    {onPinParticipant && (
                      <TouchableOpacity
                        onPress={() => handlePin(item.socketId)}
                        style={[
                          styles.actionIconBtn,
                          isPinned && styles.actionIconBtnActive,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isPinned ? "pin" : "pin-outline"}
                          size={16}
                          color={isPinned ? "#818cf8" : Colors.textMuted}
                        />
                      </TouchableOpacity>
                    )}

                    {/* Host Mute button */}
                    {isHost && onMuteParticipant && (
                      <TouchableOpacity
                        onPress={() => handleMute(item.socketId)}
                        style={[
                          styles.actionIconBtn,
                          item.isAudioMuted && styles.actionIconBtnMuted,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={item.isAudioMuted ? "mic-off" : "mic-outline"}
                          size={16}
                          color={item.isAudioMuted ? "#f87171" : "#fbbf24"}
                        />
                      </TouchableOpacity>
                    )}

                    {/* Host Kick button */}
                    {isHost && onKickParticipant && (
                      <TouchableOpacity
                        onPress={() => handleConfirmKick(item)}
                        style={[styles.actionIconBtn, styles.actionKickBtn]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person-remove-outline" size={16} color="#f87171" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              searchQuery ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={32} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No participants found</Text>
                  <Text style={styles.emptySubtext}>Try searching with a different name</Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.82)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    maxHeight: "85%",
    minHeight: "55%",
    paddingBottom: 24,
  },
  modalCardTablet: {
    maxWidth: 580,
    alignSelf: "center",
    borderRadius: 24,
    marginBottom: 40,
    minHeight: "65%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  muteAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  muteAllText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  localParticipantRow: {
    backgroundColor: "rgba(99, 102, 241, 0.07)",
    borderRadius: 14,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderBottomWidth: 0,
  },
  userInfoCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    borderWidth: 1.5,
    borderColor: "rgba(99, 102, 241, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  localAvatar: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    borderColor: "rgba(16, 185, 129, 0.5)",
  },
  avatarText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  nameBlock: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  participantName: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  youBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "700",
  },
  hostBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadgeText: {
    color: "#fbbf24",
    fontSize: 10,
    fontWeight: "700",
  },
  statusChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  handChip: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  handChipText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "600",
  },
  mediaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mediaChipOn: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  mediaChipOff: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  mediaChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  mediaChipTextOn: {
    color: "#34d399",
  },
  mediaChipTextOff: {
    color: "#f87171",
  },
  actionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconBtnActive: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.5)",
  },
  actionIconBtnMuted: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  actionKickBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  pinActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinActionBtnActive: {
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.6)",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
});
