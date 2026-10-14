import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../theme/colors";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { scheduleService } from "../services/schedule.service";
import { ScheduledMeetingItem } from "../types";
import { Ionicons } from "@expo/vector-icons";

interface ScheduleScreenProps {
  onBack: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const ScheduleScreen = ({ onBack, onJoinRoom }: ScheduleScreenProps) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [meetings, setMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal form states
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  const [inviteeInput, setInviteeInput] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const data = await scheduleService.getScheduledMeetings();
      setMeetings(data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadMeetings();
    setIsRefreshing(false);
  };

  const handleAddInvitee = () => {
    const clean = inviteeInput.trim().toLowerCase();
    if (!clean) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!invitees.includes(clean)) {
      setInvitees([...invitees, clean]);
    }
    setInviteeInput("");
  };

  const handleRemoveInvitee = (email: string) => {
    setInvitees(invitees.filter((e) => e !== email));
  };

  const handleSubmitSchedule = async () => {
    if (!title.trim()) {
      Alert.alert("Required", "Meeting title is required.");
      return;
    }

    let finalInvitees = [...invitees];
    const pendingEmail = inviteeInput.trim().toLowerCase();
    if (pendingEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingEmail)) {
      if (!finalInvitees.includes(pendingEmail)) {
        finalInvitees.push(pendingEmail);
      }
      setInviteeInput("");
    }

    setIsSubmitting(true);
    try {
      const res = await scheduleService.createScheduledMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        invitees: finalInvitees,
      });

      Alert.alert(
        "Meeting Scheduled! 🎉",
        res.emailsSent > 0
          ? `Meeting scheduled and invitations sent to ${res.emailsSent} recipient(s).`
          : "Meeting room created and added to your schedule."
      );

      // Reset
      setTitle("");
      setDescription("");
      setInvitees([]);
      setInviteeInput("");
      setShowModal(false);
      loadMeetings();
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to schedule meeting.";
      Alert.alert("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Cancel Meeting", "Are you sure you want to cancel this scheduled meeting?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await scheduleService.deleteScheduledMeeting(id);
            setMeetings((prev) => prev.filter((m) => m.id !== id));
          } catch {
            Alert.alert("Error", "Failed to cancel meeting.");
          }
        },
      },
    ]);
  };

  const handleSendReminder = async (id: string) => {
    setRemindingId(id);
    try {
      const res = await scheduleService.sendMeetingReminders(id);
      Alert.alert("Reminders Dispatched", `Email reminders delivered to ${res.sent} participant(s).`);
    } catch {
      Alert.alert("Error", "Failed to dispatch email reminders.");
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Schedule &amp; Invites"
        showBack
        onBack={onBack}
        rightAction={{
          icon: "add-circle",
          onPress: () => setShowModal(true),
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentWide,
        ]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={[styles.mainLayout, isTablet && styles.mainLayoutWide]}>
          {/* Banner with Schedule button */}
          <View style={styles.bannerCard}>
            <View style={styles.bannerLeftRow}>
              <View style={styles.bannerIconCircle}>
                <Ionicons name="calendar" size={24} color="#ffffff" />
              </View>
              <View style={styles.bannerTextCol}>
                <Text style={styles.bannerTitle}>Scheduled Video Meetings</Text>
                <Text style={styles.bannerSub}>
                  Coordinate upcoming executive calls and notify team members with automated email invitations.
                </Text>
              </View>
            </View>
            <Button
              title="+ Schedule Meeting"
              size="small"
              onPress={() => setShowModal(true)}
              style={styles.bannerBtn}
            />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Upcoming Video Calls ({meetings.length})</Text>
            <View style={styles.calendarPill}>
              <Ionicons name="time-outline" size={13} color={Colors.accent} style={{ marginRight: 4 }} />
              <Text style={styles.calendarPillText}>Auto Sync</Text>
            </View>
          </View>

          {meetings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="calendar-outline" size={32} color={Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No scheduled meetings</Text>
              <Text style={styles.emptySub}>Tap "+ Schedule Meeting" above to invite participants.</Text>
            </View>
          ) : (
            <View style={[styles.meetingsGrid, isTablet && styles.meetingsGridTablet]}>
              {meetings.map((item) => {
                const dateStr = new Date(item.scheduledAt).toLocaleString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const isHost = item.isHost;

                return (
                  <View
                    key={item.id}
                    style={[styles.meetingCard, isTablet && styles.meetingCardHalf]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.meetingTitle}>{item.title}</Text>
                        <Text style={styles.hostName}>
                          Hosted by {item.host?.name || "Host"} {isHost ? "(You)" : ""}
                        </Text>
                      </View>
                      <View style={styles.durationPill}>
                        <Text style={styles.durationPillText}>{item.durationMinutes}m</Text>
                      </View>
                    </View>

                    {item.description ? (
                      <Text style={styles.meetingDescription}>{item.description}</Text>
                    ) : null}

                    <View style={styles.detailRow}>
                      <Ionicons name="time" size={15} color={Colors.accent} />
                      <Text style={styles.detailText}>{dateStr}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Ionicons name="key" size={15} color={Colors.textMuted} />
                      <Text style={styles.detailCodeText}>Room: {item.roomCode}</Text>
                    </View>

                    {item.inviteeList?.length > 0 ? (
                      <View style={styles.inviteeListRow}>
                        <Ionicons name="mail" size={15} color={Colors.textMuted} />
                        <Text style={styles.inviteesCount}>
                          {item.inviteeList.length} invitee(s): {item.inviteeList.join(", ")}
                        </Text>
                      </View>
                    ) : null}

                    {/* Card Action Buttons */}
                    <View style={styles.cardActions}>
                      <Button
                        title="🚀 Join Call"
                        size="small"
                        onPress={() => onJoinRoom(item.roomCode)}
                        style={{ flex: 1, marginRight: 8 }}
                      />

                      {isHost ? (
                        <>
                          <TouchableOpacity
                            onPress={() => handleSendReminder(item.id)}
                            disabled={remindingId === item.id}
                            style={styles.iconActionBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="notifications-outline" size={18} color={Colors.accent} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                            style={[styles.iconActionBtn, styles.deleteActionBtn]}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Schedule Meeting Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.modalOverlay, isTablet && styles.modalOverlayTablet]}
        >
          <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="calendar" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Schedule Video Meeting</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} activeOpacity={0.7} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Input
                label="Meeting Title *"
                placeholder="e.g. Weekly Executive Review"
                value={title}
                onChangeText={setTitle}
              />

              <Input
                label="Description (Optional)"
                placeholder="Agenda, discussion topics…"
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />

              <Input
                label="Date &amp; Time (YYYY-MM-DDTHH:MM) *"
                placeholder="2026-10-01T18:30"
                value={scheduledAt}
                onChangeText={setScheduledAt}
              />

              {/* Duration picker buttons */}
              <Text style={styles.label}>Duration</Text>
              <View style={styles.durationSelector}>
                {[15, 30, 45, 60].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setDurationMinutes(mins)}
                    activeOpacity={0.75}
                    style={[
                      styles.durationOption,
                      durationMinutes === mins ? styles.durationOptionActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationOptionText,
                        durationMinutes === mins ? styles.durationOptionTextActive : null,
                      ]}
                    >
                      {mins}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Invitee Email Input */}
              <Text style={styles.label}>Invite by Email (Dispatches Invitations)</Text>
              <View style={styles.inviteeInputRow}>
                <TextInput
                  style={styles.inviteeInput}
                  placeholder="colleague@company.com"
                  placeholderTextColor={Colors.textSubtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={inviteeInput}
                  onChangeText={setInviteeInput}
                  onSubmitEditing={handleAddInvitee}
                />
                <Button
                  title="+ Add"
                  size="small"
                  variant="secondary"
                  onPress={handleAddInvitee}
                  style={styles.addBtn}
                />
              </View>

              {/* Invitee Chips */}
              {invitees.length > 0 ? (
                <View style={styles.chipsContainer}>
                  {invitees.map((e) => (
                    <View key={e} style={styles.chip}>
                      <Text style={styles.chipText}>{e}</Text>
                      <TouchableOpacity onPress={() => handleRemoveInvitee(e)} activeOpacity={0.7} style={styles.chipRemove}>
                        <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}

              <Button
                title={
                  isSubmitting
                    ? "Scheduling & Sending Invites…"
                    : `✉️ Schedule & Send Invites ${invitees.length > 0 ? `(${invitees.length})` : ""}`
                }
                onPress={handleSubmitSchedule}
                loading={isSubmitting}
                style={{ marginTop: 24 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  bannerCard: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  bannerLeftRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  bannerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  bannerBtn: {
    marginTop: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  calendarPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  calendarPillText: {
    color: Colors.accent,
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
    maxWidth: 320,
  },
  meetingsGrid: {
    width: "100%",
  },
  meetingsGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  meetingCard: {
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    marginBottom: 14,
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  hostName: {
    fontSize: 12,
    color: Colors.textSubtle,
    marginTop: 3,
    fontWeight: "500",
  },
  durationPill: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.30)",
  },
  durationPillText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  meetingDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    marginVertical: 10,
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  detailText: {
    color: Colors.text,
    fontSize: 13,
    marginLeft: 7,
    fontWeight: "500",
  },
  detailCodeText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginLeft: 7,
  },
  inviteeListRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  inviteesCount: {
    color: Colors.textSubtle,
    fontSize: 12,
    marginLeft: 7,
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  deleteActionBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderColor: "rgba(239, 68, 68, 0.30)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalOverlayTablet: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    height: "85%",
    backgroundColor: "rgba(18, 25, 45, 0.95)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
  },
  modalContentTablet: {
    height: "auto",
    maxHeight: "85%",
    width: "100%",
    maxWidth: 580,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(10, 15, 29, 0.8)",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    padding: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  durationSelector: {
    flexDirection: "row",
    marginBottom: 18,
  },
  durationOption: {
    flex: 1,
    paddingVertical: 11,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: "rgba(11, 17, 32, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    alignItems: "center",
  },
  durationOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  durationOptionText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  durationOptionTextActive: {
    color: "#ffffff",
  },
  inviteeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  inviteeInput: {
    flex: 1,
    backgroundColor: "rgba(11, 17, 32, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    marginRight: 10,
  },
  addBtn: {
    paddingHorizontal: 16,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.30)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  chipRemove: {
    padding: 2,
  },
});

