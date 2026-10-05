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

    // Auto-add typed email even if user forgot to press "+ Add" (parity with web)
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Banner with Schedule button */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>Scheduled Video Meetings</Text>
            <Text style={styles.bannerSub}>
              Plan upcoming meetings and invite team members with automated email notifications.
            </Text>
          </View>
          <Button
            title="+ Schedule Meeting"
            size="small"
            onPress={() => setShowModal(true)}
            style={{ marginTop: 12 }}
          />
        </View>

        <Text style={styles.sectionHeading}>Upcoming Video Calls ({meetings.length})</Text>

        {meetings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={Colors.textSubtle} />
            <Text style={styles.emptyTitle}>No scheduled meetings</Text>
            <Text style={styles.emptySub}>Tap "+ Schedule Meeting" above to invite participants.</Text>
          </View>
        ) : (
          meetings.map((item) => {
            const dateStr = new Date(item.scheduledAt).toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const isHost = item.isHost;

            return (
              <View key={item.id} style={styles.meetingCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
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
                      >
                        <Ionicons name="notifications-outline" size={18} color={Colors.accent} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDelete(item.id)}
                        style={[styles.iconActionBtn, styles.deleteActionBtn]}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Schedule Meeting Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule a Video Meeting</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Input
                label="Meeting Title *"
                placeholder="e.g. Weekly Team Standup"
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
                  placeholder="colleague@example.com"
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
                      <TouchableOpacity onPress={() => handleRemoveInvitee(e)} style={styles.chipRemove}>
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
  bannerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  bannerTextCol: {
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  bannerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
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
    textAlign: "center",
  },
  meetingCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  hostName: {
    fontSize: 12,
    color: Colors.textSubtle,
    marginTop: 2,
  },
  durationPill: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  durationPillText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  meetingDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    marginVertical: 8,
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
    marginLeft: 6,
  },
  detailCodeText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginLeft: 6,
  },
  inviteeListRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  inviteesCount: {
    color: Colors.textSubtle,
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  deleteActionBtn: {
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "85%",
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.cardSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  durationSelector: {
    flexDirection: "row",
    marginBottom: 16,
  },
  durationOption: {
    flex: 1,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  durationOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    marginBottom: 8,
  },
  inviteeInput: {
    flex: 1,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
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
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    color: Colors.accent,
    fontSize: 12,
    marginRight: 4,
  },
  chipRemove: {
    padding: 2,
  },
});
