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
                  <Text style={styles.optionPercentage}>
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="bar-chart" size={20} color={Colors.primary} />
              <Text style={styles.title}>
                {isCreating ? "Create a Poll" : `Meeting Polls (${polls.length})`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          {isCreating ? (
            <ScrollView contentContainerStyle={styles.createContent}>
              <Text style={styles.label}>Question</Text>
              <TextInput
                style={styles.input}
                placeholder="What would you like to ask?"
                placeholderTextColor={Colors.textSubtle}
                value={question}
                onChangeText={setQuestion}
              />

              <Text style={styles.label}>Options</Text>
              {options.map((opt, idx) => (
                <View key={idx} style={styles.optionInputRow}>
                  <TextInput
                    style={[styles.input, styles.optionInputFlex]}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={Colors.textSubtle}
                    value={opt}
                    onChangeText={(txt) => handleOptionChange(txt, idx)}
                  />
                  {options.length > 2 ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveOption(idx)}
                      style={styles.removeOptionBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              {options.length < 6 ? (
                <TouchableOpacity onPress={handleAddOption} style={styles.addOptionBtn}>
                  <Ionicons name="add" size={18} color={Colors.primary} />
                  <Text style={styles.addOptionText}>Add Another Option</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.formActionRow}>
                <TouchableOpacity
                  onPress={() => setIsCreating(false)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateSubmit}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitBtnText}>Launch Poll</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.listWrapper}>
              {polls.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="pie-chart-outline" size={48} color={Colors.textSubtle} />
                  <Text style={styles.emptyText}>No active polls yet</Text>
                  <Text style={styles.emptySubtext}>
                    Create a poll to gather quick feedback from attendees.
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

              {/* Bottom Action */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  onPress={() => setIsCreating(true)}
                  style={styles.createPollBtn}
                >
                  <Ionicons name="add-circle" size={20} color="#ffffff" />
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
  listWrapper: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  pollCard: {
    backgroundColor: Colors.cardSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
  },
  pollHeader: {
    marginBottom: 12,
  },
  pollQuestion: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  pollMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  optionsList: {
    gap: 8,
  },
  optionBtn: {
    position: "relative",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionBtnSelected: {
    borderColor: Colors.primary,
  },
  progressBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderRadius: 9,
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
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
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
    color: Colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  optionTextSelected: {
    color: "#ffffff",
  },
  optionPercentage: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomBar: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  createPollBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  createPollBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    minHeight: 220,
  },
  emptyText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  createContent: {
    padding: 16,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    padding: 8,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 16,
  },
  addOptionText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  formActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelBtnText: {
    color: Colors.textMuted,
    fontWeight: "600",
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
