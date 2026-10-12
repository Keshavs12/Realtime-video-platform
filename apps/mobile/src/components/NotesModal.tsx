import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface NotesModalProps {
  visible: boolean;
  onClose: () => void;
  notes: string;
  updatedBy: string | null;
  onUpdateNotes: (newNotes: string) => void;
}

export const NotesModal = ({
  visible,
  onClose,
  notes,
  updatedBy,
  onUpdateNotes,
}: NotesModalProps) => {
  const [localText, setLocalText] = useState(notes);
  const [isSyncing, setIsSyncing] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes into localText when not actively editing
  useEffect(() => {
    if (!isSyncing) {
      setLocalText(notes);
    }
  }, [notes, isSyncing]);

  const handleChangeText = (text: string) => {
    setLocalText(text);
    setIsSyncing(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onUpdateNotes(text);
      setIsSyncing(false);
    }, 600);
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
            <View style={styles.titleCol}>
              <View style={styles.titleRow}>
                <Ionicons name="document-text" size={20} color={Colors.primary} />
                <Text style={styles.title}>Collaborative Meeting Notes</Text>
              </View>
              {updatedBy ? (
                <Text style={styles.subtitle}>Last updated by {updatedBy}</Text>
              ) : (
                <Text style={styles.subtitle}>Real-time synchronized with all attendees</Text>
              )}
            </View>
            <View style={styles.headerRight}>
              <View style={styles.syncBadge}>
                <View
                  style={[
                    styles.syncDot,
                    { backgroundColor: isSyncing ? Colors.warning : Colors.accent },
                  ]}
                />
                <Text style={styles.syncText}>{isSyncing ? "Syncing..." : "Saved"}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes Area */}
          <View style={styles.editorWrapper}>
            <TextInput
              style={styles.textInput}
              multiline
              textAlignVertical="top"
              placeholder="Take collaborative meeting notes, action items, or agenda points here..."
              placeholderTextColor={Colors.textSubtle}
              value={localText}
              onChangeText={handleChangeText}
            />
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.charCount}>{localText.length} characters</Text>
            <Text style={styles.hintText}>Changes auto-save instantly</Text>
          </View>
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
    height: "75%",
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
  titleCol: {
    flex: 1,
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
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    marginLeft: 28,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  syncText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  editorWrapper: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: Colors.cardSecondary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  charCount: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  hintText: {
    color: Colors.textSubtle,
    fontSize: 11,
  },
});
