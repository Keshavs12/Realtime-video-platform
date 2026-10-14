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
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

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
            <View style={styles.titleCol}>
              <View style={styles.titleRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="document-text" size={18} color={Colors.accent} />
                </View>
                <View>
                  <Text style={styles.title}>Collaborative Notes</Text>
                  {updatedBy ? (
                    <Text style={styles.subtitle}>Last updated by {updatedBy}</Text>
                  ) : (
                    <Text style={styles.subtitle}>Real-time synchronized across all devices</Text>
                  )}
                </View>
              </View>
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
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#94a3b8" />
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
              placeholderTextColor="#64748b"
              value={localText}
              onChangeText={handleChangeText}
            />
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <View style={styles.footerBadge}>
              <Ionicons name="cloud-done-outline" size={13} color={Colors.accent} style={{ marginRight: 4 }} />
              <Text style={styles.charCount}>{localText.length} characters</Text>
            </View>
            <Text style={styles.hintText}>Auto-saves on keystroke</Text>
          </View>
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
    height: "75%",
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
    maxWidth: 620,
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
  titleCol: {
    flex: 1,
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 25, 45, 0.75)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  syncText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "600",
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
  editorWrapper: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 22,
    backgroundColor: "rgba(11, 17, 32, 0.75)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(18, 25, 45, 0.9)",
  },
  footerBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  charCount: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  hintText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "500",
  },
});
