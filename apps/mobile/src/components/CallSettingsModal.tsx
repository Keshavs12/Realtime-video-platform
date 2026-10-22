import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  useWindowDimensions,
  Vibration,
} from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface CallSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  dataSaverMode: boolean;
  onToggleDataSaver: (value: boolean) => void;
  mirrorVideo: boolean;
  onToggleMirrorVideo: (value: boolean) => void;
  noiseSuppression: boolean;
  onToggleNoiseSuppression: (value: boolean) => void;
  roomCode: string;
  participantCount: number;
}

export const CallSettingsModal = ({
  visible,
  onClose,
  dataSaverMode,
  onToggleDataSaver,
  mirrorVideo,
  onToggleMirrorVideo,
  noiseSuppression,
  onToggleNoiseSuppression,
  roomCode,
  participantCount,
}: CallSettingsModalProps) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const handleToggle = (fn: (v: boolean) => void, cur: boolean) => {
    try { Vibration.vibrate(30); } catch {}
    fn(!cur);
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
                <Ionicons name="options" size={18} color="#818cf8" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Call Settings</Text>
                <Text style={styles.headerSubtitle}>Audio, video &amp; data preferences</Text>
              </View>
            </View>

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

          {/* Settings Rows */}
          <View style={styles.contentBody}>
            {/* Low Data / Bandwidth Saver Mode */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Ionicons name="cellular-outline" size={18} color="#34d399" style={{ marginRight: 8 }} />
                  <Text style={styles.settingLabel}>Data Saver Mode</Text>
                </View>
                <Text style={styles.settingDescription}>
                  Caps video bitrate &amp; optimizes bandwidth to save up to 75% cellular data on 3G/4G.
                </Text>
              </View>
              <Switch
                value={dataSaverMode}
                onValueChange={() => handleToggle(onToggleDataSaver, dataSaverMode)}
                trackColor={{ false: "#334155", true: "#4f46e5" }}
                thumbColor={dataSaverMode ? "#818cf8" : "#94a3b8"}
              />
            </View>

            {/* Mirror Local Video */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Ionicons name="scan-outline" size={18} color="#818cf8" style={{ marginRight: 8 }} />
                  <Text style={styles.settingLabel}>Mirror Front Camera</Text>
                </View>
                <Text style={styles.settingDescription}>
                  Displays your local front camera preview mirrored like a natural selfie.
                </Text>
              </View>
              <Switch
                value={mirrorVideo}
                onValueChange={() => handleToggle(onToggleMirrorVideo, mirrorVideo)}
                trackColor={{ false: "#334155", true: "#4f46e5" }}
                thumbColor={mirrorVideo ? "#818cf8" : "#94a3b8"}
              />
            </View>

            {/* Studio Noise Suppression */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingLabelRow}>
                  <Ionicons name="volume-medium-outline" size={18} color="#fbbf24" style={{ marginRight: 8 }} />
                  <Text style={styles.settingLabel}>Studio Noise Suppression</Text>
                </View>
                <Text style={styles.settingDescription}>
                  Filters background keyboard clicks, fans, and room echo using WebRTC voice filters.
                </Text>
              </View>
              <Switch
                value={noiseSuppression}
                onValueChange={() => handleToggle(onToggleNoiseSuppression, noiseSuppression)}
                trackColor={{ false: "#334155", true: "#4f46e5" }}
                thumbColor={noiseSuppression ? "#818cf8" : "#94a3b8"}
              />
            </View>

            {/* Diagnostics Card */}
            <View style={styles.diagnosticsCard}>
              <Text style={styles.diagnosticsTitle}>CALL DIAGNOSTICS</Text>
              <View style={styles.diagnosticsGrid}>
                <View style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Room Code</Text>
                  <Text style={styles.diagValue}>{roomCode}</Text>
                </View>
                <View style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Participants</Text>
                  <Text style={styles.diagValue}>{participantCount} connected</Text>
                </View>
                <View style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Audio Engine</Text>
                  <Text style={styles.diagValue}>Opus (48kHz FEC)</Text>
                </View>
                <View style={styles.diagItem}>
                  <Text style={styles.diagLabel}>Video Engine</Text>
                  <Text style={styles.diagValue}>VP8 / H.264 HD</Text>
                </View>
              </View>
            </View>
          </View>
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
    paddingBottom: 28,
  },
  modalCardTablet: {
    maxWidth: 580,
    alignSelf: "center",
    borderRadius: 24,
    marginBottom: 40,
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  contentBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  settingLabel: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  settingDescription: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  diagnosticsCard: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  diagnosticsTitle: {
    color: "#818cf8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  diagnosticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  diagItem: {
    width: "47%",
  },
  diagLabel: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  diagValue: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
});
