import React from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Disc,
  Square,
  PenTool,
  Hand,
  Smile,
  Wifi,
  WifiOff,
  MessageSquare,
  PhoneOff,
  Camera,
  Subtitles,
  Sparkles,
} from "lucide-react";
import styles from "@/styles/room.module.scss";

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

interface RoomControlBarProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  showWhiteboard: boolean;
  isLocalHandRaised: boolean;
  showReactionsPicker: boolean;
  isLowBandwidthMode: boolean;
  isCaptionsEnabled?: boolean;
  isBackgroundBlur?: boolean;
  isSidebarOpen: boolean;
  videoDevices: MediaDeviceOption[];
  audioDevices: MediaDeviceOption[];
  selectedVideoDeviceId: string;
  selectedAudioDeviceId: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleWhiteboard: () => void;
  onToggleRaiseHand: () => void;
  onToggleReactionsPicker: () => void;
  onSendReaction: (emoji: string) => void;
  onToggleLowBandwidthMode: () => void;
  onToggleCaptions?: () => void;
  onToggleBackgroundBlur?: () => void;
  onToggleSidebar: () => void;
  onLeave: () => void;
  onSwitchCamera: (deviceId: string) => void;
  onSwitchMicrophone: (deviceId: string) => void;
}

export function RoomControlBar({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isRecording,
  showWhiteboard,
  isLocalHandRaised,
  showReactionsPicker,
  isLowBandwidthMode,
  isCaptionsEnabled,
  isBackgroundBlur = false,
  isSidebarOpen,
  videoDevices,
  audioDevices,
  selectedVideoDeviceId,
  selectedAudioDeviceId,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onToggleWhiteboard,
  onToggleRaiseHand,
  onToggleReactionsPicker,
  onSendReaction,
  onToggleLowBandwidthMode,
  onToggleCaptions,
  onToggleBackgroundBlur,
  onToggleSidebar,
  onLeave,
  onSwitchCamera,
  onSwitchMicrophone,
}: Readonly<RoomControlBarProps>) {
  return (
    <>
      {showReactionsPicker && (
        <div className={styles.reactionsPickerBar}>
          {["❤️", "👍", "👏", "🎉", "😂", "🚀", "🔥", "💡"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.reactionPickerBtn}
              onClick={() => onSendReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className={styles.bottomDockContainer}>
        <div className={styles.controls}>
          {/* Audio Mute/Unmute */}
          <button
            type="button"
            onClick={onToggleAudio}
            className={`${styles.controlButton} ${isAudioMuted ? styles.active : ""}`}
            title={isAudioMuted ? "Unmute Microphone (M)" : "Mute Microphone (M)"}
          >
            {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Video Toggle */}
          <button
            type="button"
            onClick={onToggleVideo}
            className={`${styles.controlButton} ${isVideoMuted ? styles.active : ""}`}
            title={isVideoMuted ? "Turn Camera On (V)" : "Turn Camera Off (V)"}
          >
            {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Screen Share */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`${styles.controlButton} ${isScreenSharing ? styles.active : ""}`}
            style={isScreenSharing ? { background: "#2563eb", borderColor: "#3b82f6" } : {}}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            <MonitorUp size={20} />
          </button>

          {/* Recording */}
          <button
            type="button"
            onClick={onToggleRecording}
            className={`${styles.controlButton} ${isRecording ? styles.recordingActive : ""}`}
            title={isRecording ? "Stop Recording" : "Record Meeting"}
          >
            {isRecording ? <Square size={18} /> : <Disc size={20} />}
          </button>

          {/* Whiteboard */}
          <button
            type="button"
            onClick={onToggleWhiteboard}
            className={`${styles.controlButton} ${showWhiteboard ? styles.active : ""}`}
            style={showWhiteboard ? { background: "rgba(168, 85, 247, 0.35)", borderColor: "#a855f7" } : {}}
            title={showWhiteboard ? "Close Whiteboard" : "Open Collaborative Whiteboard"}
          >
            <PenTool size={20} />
          </button>

          {/* Raise Hand */}
          <button
            type="button"
            onClick={onToggleRaiseHand}
            className={`${styles.controlButton} ${isLocalHandRaised ? styles.handRaised : ""}`}
            title={isLocalHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <Hand size={20} />
          </button>

          {/* Reactions */}
          <button
            type="button"
            onClick={onToggleReactionsPicker}
            className={`${styles.controlButton} ${showReactionsPicker ? styles.active : ""}`}
            title="Reactions"
          >
            <Smile size={20} />
          </button>

          {/* Low Bandwidth Mode */}
          <button
            type="button"
            onClick={onToggleLowBandwidthMode}
            className={`${styles.controlButton} ${isLowBandwidthMode ? styles.active : ""}`}
            title={isLowBandwidthMode ? "Disable Low Data Mode" : "Enable Low Data Mode"}
          >
            {isLowBandwidthMode ? <WifiOff size={20} /> : <Wifi size={20} />}
          </button>

          {/* AI Live Closed Captions */}
          {onToggleCaptions && (
            <button
              type="button"
              onClick={onToggleCaptions}
              className={`${styles.controlButton} ${isCaptionsEnabled ? styles.active : ""}`}
              style={isCaptionsEnabled ? { background: "rgba(16, 185, 129, 0.35)", borderColor: "#10b981", color: "#34d399" } : {}}
              title={isCaptionsEnabled ? "Turn off Live Captions (CC)" : "Turn on Live Captions (CC)"}
            >
              <Subtitles size={20} />
            </button>
          )}

          {/* Studio Portrait / Background Blur Toggle */}
          {onToggleBackgroundBlur && (
            <button
              type="button"
              onClick={onToggleBackgroundBlur}
              className={`${styles.controlButton} ${isBackgroundBlur ? styles.active : ""}`}
              style={isBackgroundBlur ? { background: "rgba(168, 85, 247, 0.35)", borderColor: "#c084fc", color: "#e879f9" } : {}}
              title={isBackgroundBlur ? "Disable Studio Portrait Effect" : "Enable Studio Portrait Effect"}
            >
              <Sparkles size={20} />
            </button>
          )}

          {/* Toggle Sidebar */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`${styles.controlButton} ${isSidebarOpen ? styles.active : ""}`}
            style={isSidebarOpen ? { background: "rgba(99, 102, 241, 0.35)", borderColor: "#6366f1" } : {}}
            title="Toggle Chat & Participants"
          >
            <MessageSquare size={20} />
          </button>

          {/* Leave Call */}
          <button
            type="button"
            onClick={onLeave}
            className={`${styles.controlButton} ${styles.leave}`}
            title="Leave Meeting"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Quick Device Switchers */}
        <div className={styles.deviceSelectors}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8" }}>
            <Camera size={14} />
            <select
              className={styles.deviceSelect}
              value={selectedVideoDeviceId}
              onChange={(e) => onSwitchCamera(e.target.value)}
              title="Select Camera"
            >
              {videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Camera"}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8" }}>
            <Mic size={14} />
            <select
              className={styles.deviceSelect}
              value={selectedAudioDeviceId}
              onChange={(e) => onSwitchMicrophone(e.target.value)}
              title="Select Microphone"
            >
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Microphone"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
