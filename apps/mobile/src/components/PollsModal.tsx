import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { PollItem } from "../types";

interface PollsModalProps {
  visible: boolean;
  onClose: () => void;
  polls: PollItem[];
  currentUserId: string;
  onCreatePoll: (question: string, options: string[]) => void;
  onVotePoll: (pollId: string, optionId: string) => void;
}

export const PollsModal = ({
  visible,
  onClose,
  polls,
  currentUserId,
  onCreatePoll,
  onVotePoll,
}: PollsModalProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, idx) => idx !== index));
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const next = [...options];
    next[index] = text;
    setOptions(next);
  };

  const handleCreateSubmit = () => {
    const cleanQuestion = question.trim();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanQuestion || cleanOptions.length < 2) {
      return;
    }

    onCreatePoll(cleanQuestion, cleanOptions);
    setQuestion("");
    setOptions(["", ""]);
    setIsCreating(false);
  };

  const renderPollItem = ({ item }: { item: PollItem }) => {
    const totalVotes = item.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
    const userVote = item.voters?.[currentUserId];

    return (
      <View style={styles.pollCard}>
        <View style={styles.pollHeader}>
          <Text style={styles.pollQuestion}>{item.question}</Text>
          <Text style={styles.pollMeta}>
            By {item.creatorName || "Participant"} • {totalVotes} vote{totalVotes === 1 ? "" : "s"}
          </Text>
        </View>

        <View style={styles.optionsList}>
          {item.options.map((option) => {
            const votes = option.votes || 0;
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isVoted = userVote === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => onVotePoll(item.id, option.id)}
                activeOpacity={0.8}
                style={[styles.optionBtn, isVoted && styles.optionBtnSelected]}
              >
                {/* Progress bar background */}
                <View
                  style={[
                    styles.progressBar,
                    { width: `${percentage}%` },
                    isVoted && styles.progressBarSelected,
                  ]}
                />

                <View style={styles.optionContentRow}>
                  <View style={styles.optionTextRow}>
                    <View style={[styles.radioCircle, isVoted && styles.radioCircleSelected]}>
                      {isVoted ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={[styles.optionText, isVoted && styles.optionTextSelected]}>
                      {option.text}
                    </Text>
                  </View>
                  <Text style={[styles.optionPercentage, isVoted && styles.optionPercentageSelected]}>
                    {percentage}% ({votes})
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType={isTablet ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.overlay, isTablet && styles.overlayTablet]}
      >
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
                <Ionicons name="bar-chart" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>
                  {isCreating ? "Create a Poll" : "Meeting Polls"}
                </Text>
                <Text style={styles.subtitle}>
                  {isCreating ? "Collect votes from attendees" : `${polls.length} active poll${polls.length === 1 ? "" : "s"}`}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          {isCreating ? (
            <ScrollView contentContainerStyle={styles.createContent}>
              <Text style={styles.label}>Question</Text>
              <TextInput
                style={styles.input}
                placeholder="What would you like to ask the room?"
                placeholderTextColor="#64748b"
                value={question}
                onChangeText={setQuestion}
              />

              <Text style={styles.label}>Options</Text>
              {options.map((opt, idx) => (
                <View key={idx} style={styles.optionInputRow}>
                  <TextInput
                    style={[styles.input, styles.optionInputFlex]}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor="#64748b"
                    value={opt}
                    onChangeText={(val) => handleOptionChange(val, idx)}
                  />
                  {options.length > 2 ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveOption(idx)}
                      style={styles.removeOptionBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              {options.length < 6 ? (
                <TouchableOpacity
                  onPress={handleAddOption}
                  style={styles.addOptionBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.addOptionText}>Add Another Option</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.formActionRow}>
                <TouchableOpacity
                  onPress={() => setIsCreating(false)}
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateSubmit}
                  style={styles.submitBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitBtnText}>Launch Poll</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.listWrapper}>
              {polls.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBg}>
                    <Ionicons name="stats-chart-outline" size={36} color={Colors.primary} />
                  </View>
                  <Text style={styles.emptyText}>No polls active yet</Text>
                  <Text style={styles.emptySubtext}>
                    Create a poll to gather feedback or make group decisions instantly.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={polls}
                  keyExtractor={(item) => item.id}
                  renderItem={renderPollItem}
                  contentContainerStyle={styles.listContent}
                />
              )}

              {/* Bottom Create Button Bar */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  onPress={() => setIsCreating(true)}
                  style={styles.createPollBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color="#ffffff" />
                  <Text style={styles.createPollBtnText}>Create New Poll</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
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
  listWrapper: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  pollCard: {
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    marginBottom: 14,
  },
  pollHeader: {
    marginBottom: 12,
  },
  pollQuestion: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  pollMeta: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  optionsList: {
    gap: 8,
  },
  optionBtn: {
    position: "relative",
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionBtnSelected: {
    borderColor: "rgba(99, 102, 241, 0.6)",
  },
  progressBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderRadius: 11,
  },
  progressBarSelected: {
    backgroundColor: "rgba(99, 102, 241, 0.35)",
  },
  optionContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionTextRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#64748b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  optionText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  optionTextSelected: {
    color: "#ffffff",
    fontWeight: "700",
  },
  optionPercentage: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  optionPercentageSelected: {
    color: "#ffffff",
  },
  bottomBar: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(18, 25, 45, 0.9)",
  },
  createPollBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  createPollBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    minHeight: 220,
  },
  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtext: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  createContent: {
    padding: 18,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "rgba(11, 17, 32, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#ffffff",
    fontSize: 14,
    marginBottom: 12,
  },
  optionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  optionInputFlex: {
    flex: 1,
    marginBottom: 0,
    marginRight: 8,
  },
  removeOptionBtn: {
    padding: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 16,
  },
  addOptionText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  formActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
