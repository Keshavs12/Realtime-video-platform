import React from "react";
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
  onToggleSidebar,
  onLeave,
  onSwitchCamera,
  onSwitchMicrophone,
}: Readonly<RoomControlBarProps>) {
  return (
    <>
      {showReactionsPicker && (
        <div className={styles.reactionsPickerBar}>
          {["❤️", "👍", "👏", "🎉", "😂", "🚀"].map((emoji) => (
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
          <button
            type="button"
            onClick={onToggleAudio}
            className={`${styles.controlButton} ${isAudioMuted ? styles.active : ""}`}
            title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isAudioMuted ? "🔇" : "🎤"}
          </button>
          <button
            type="button"
            onClick={onToggleVideo}
            className={`${styles.controlButton} ${isVideoMuted ? styles.active : ""}`}
            title={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoMuted ? "🚫" : "📹"}
          </button>
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`${styles.controlButton} ${isScreenSharing ? styles.active : ""}`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            🖥️
          </button>
          <button
            type="button"
            onClick={onToggleRecording}
            className={`${styles.controlButton} ${isRecording ? styles.recordingActive : ""}`}
            title={isRecording ? "Stop Recording" : "Record Meeting"}
          >
            {isRecording ? "⏹️" : "⏺️"}
          </button>
          <button
            type="button"
            onClick={onToggleWhiteboard}
            className={`${styles.controlButton} ${showWhiteboard ? styles.active : ""}`}
            title={showWhiteboard ? "Close Whiteboard" : "Open Collaborative Whiteboard"}
          >
            🎨
          </button>
          <button
            type="button"
            onClick={onToggleRaiseHand}
            className={`${styles.controlButton} ${isLocalHandRaised ? styles.handRaised : ""}`}
            title={isLocalHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            ✋
          </button>
          <button
            type="button"
            onClick={onToggleReactionsPicker}
            className={`${styles.controlButton} ${showReactionsPicker ? styles.active : ""}`}
            title="Reactions"
          >
            😊
          </button>
          <button
            type="button"
            onClick={onToggleLowBandwidthMode}
            className={`${styles.controlButton} ${isLowBandwidthMode ? styles.active : ""}`}
            title={isLowBandwidthMode ? "Disable Low Data Mode" : "Enable Low Data Mode"}
          >
            📶
          </button>
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`${styles.controlButton} ${isSidebarOpen ? styles.active : ""}`}
            style={isSidebarOpen ? { background: "rgba(59, 130, 246, 0.4)", borderColor: "#3b82f6" } : {}}
            title="Toggle Chat & Participants"
          >
            💬
          </button>
          <button
            type="button"
            onClick={onLeave}
            className={`${styles.controlButton} ${styles.leave}`}
            title="Leave Call"
          >
            📞
          </button>
        </div>

        <div className={styles.deviceSelectors}>
          <select
            className={styles.deviceSelect}
            value={selectedVideoDeviceId}
            onChange={(e) => onSwitchCamera(e.target.value)}
            title="Select Camera"
          >
            {videoDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>

          <select
            className={styles.deviceSelect}
            value={selectedAudioDeviceId}
            onChange={(e) => onSwitchMicrophone(e.target.value)}
            title="Select Microphone"
          >
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
