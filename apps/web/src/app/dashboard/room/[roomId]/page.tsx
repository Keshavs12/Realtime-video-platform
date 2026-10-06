"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useRoom } from "@/hooks/useRoom";
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder";
import { useSpeechCaptions } from "@/hooks/useSpeechCaptions";
import { formatDuration } from "@/lib/videoStorage";
import { GreenRoomLobby } from "@/components/GreenRoomLobby";
import { WhiteboardModal } from "@/components/WhiteboardModal";
import styles from "@/styles/room.module.scss";

import {
  RoomNotFoundScreen,
  RoomFullScreen,
  RoomLockedScreen,
  KickedFromRoomScreen,
  WaitingForHostScreen,
} from "./components/RoomStatusScreens";
import { RoomHeader } from "./components/RoomHeader";
import { RoomVideoStage } from "./components/RoomVideoStage";
import { RoomControlBar } from "./components/RoomControlBar";
import { RoomSidebar, SidebarTabType } from "./components/RoomSidebar";
import { RecordingCompletionModal } from "./components/RecordingCompletionModal";
import { MeetingRecapModal } from "./components/MeetingRecapModal";

export default function RoomPage({ params }: Readonly<{ params: Promise<{ roomId: string }> }>) {
  const { roomId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [guestName, setGuestName] = useState("");
  const isGuest = !user;
  const localDisplayName = user?.name || guestName?.trim() || "You";

  const {
    socket,
    localStream,
    peers,
    presenceList,
    toggleAudio,
    toggleVideo,
    isAudioMuted,
    isVideoMuted,
    videoDevices,
    audioDevices,
    selectedVideoDeviceId,
    selectedAudioDeviceId,
    switchCamera,
    switchMicrophone,
    roomNotFound,
    roomFull,
    messages,
    sendMessage,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    speakingMap,
    networkQuality,
    isLowBandwidthMode,
    toggleLowBandwidthMode,
    // Collaboration features
    isHost,
    isRoomLocked,
    roomLockedError,
    kickedFromRoom,
    hostNotification,
    raisedHands,
    isLocalHandRaised,
    toggleRaiseHand,
    reactions,
    sendReaction,
    screenSharingPeers,
    hostToggleLock,
    hostMutePeer,
    hostMuteAll,
    hostKickPeer,
    // Real-Time Polls & Notes
    polls,
    createPoll,
    votePoll,
    sharedNotes,
    notesUpdatedBy,
    updateSharedNotes,
    // Waiting Room Controls
    isWaitingForAdmission,
    isWaitingRoomEnabled,
    waitingGuestsQueue,
    waitingRoomPendingMessage,
    toggleWaitingRoom,
    hostAdmitGuest,
    hostDenyGuest,
  } = useRoom(roomId, user, guestName);

  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);
  const isChatAtBottomRef = useRef(true);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  // In-Call Meeting Recording & Studio hook
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordVideoUrl, setRecordVideoUrl] = useState<string | null>(null);

  // Pre-Join "Green Room" Lobby state
  const [hasJoinedLobby, setHasJoinedLobby] = useState(false);

  // Real-Time Collaborative Whiteboard state
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Active call duration timer
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  useEffect(() => {
    if (!hasJoinedLobby) return;
    const interval = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [hasJoinedLobby]);

  // AI Closed Captions Hook
  const { isCaptionsEnabled, toggleCaptions, currentCaption, transcriptHistory } = useSpeechCaptions(
    localDisplayName,
    isAudioMuted
  );
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [isBackgroundBlur, setIsBackgroundBlur] = useState(false);

  // Collapsible sidebar & tabs
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabType>("chat");
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyMeetingLink = () => {
    if (typeof navigator !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleToggleSidebarTab = (tab: SidebarTabType) => {
    if (isSidebarOpen && sidebarTab === tab) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
      setSidebarTab(tab);
      if (tab === "chat") {
        setUnreadCount(0);
      }
    }
  };

  const {
    isRecording,
    isPaused,
    recordingSeconds,
    lastSavedRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
  } = useMeetingRecorder({
    roomCode: roomId,
    localStream,
    onRecordingComplete: () => {
      setShowRecordModal(true);
    },
  });

  useEffect(() => {
    let isMounted = true;
    if (lastSavedRecording?.blob) {
      const url = URL.createObjectURL(lastSavedRecording.blob);
      void Promise.resolve().then(() => {
        if (isMounted) {
          setRecordVideoUrl(url);
        }
      });
      return () => {
        isMounted = false;
        URL.revokeObjectURL(url);
      };
    } else {
      void Promise.resolve().then(() => {
        if (isMounted) {
          setRecordVideoUrl(null);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [lastSavedRecording]);

  const handleLeave = () => {
    if (isGuest) {
      router.push("/login");
    } else {
      router.push("/dashboard");
    }
  };

  const handleSendMessage = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput("");
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare().catch((err) => console.error("Failed to start screen share:", err));
    }
  };

  const isSpotlightValid = spotlightId === "local" || peers.some((p) => p.socketId === spotlightId);
  const activeSpotlightId = isSpotlightValid ? spotlightId : null;

  const handleChatScroll = () => {
    if (!chatMessagesRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    isChatAtBottomRef.current = atBottom;
    if (atBottom) {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages.at(-1);

    if (isChatAtBottomRef.current || lastMsg?.isLocal) {
      chatMessagesRef.current?.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: "smooth" });
      setUnreadCount(0);
    } else {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages]);

  useEffect(() => {
    if (roomNotFound) {
      router.replace("/dashboard");
    }
  }, [roomNotFound, router]);

  useEffect(() => {
    if (!roomFull) return;
    const timer = setTimeout(() => {
      router.replace("/dashboard");
    }, 3000);
    return () => clearTimeout(timer);
  }, [roomFull, router]);

  useEffect(() => {
    if (!showRecordModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowRecordModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showRecordModal]);

  if (roomNotFound) {
    return <RoomNotFoundScreen />;
  }

  if (roomFull) {
    return <RoomFullScreen />;
  }

  if (roomLockedError) {
    return <RoomLockedScreen onReturn={() => router.replace("/dashboard")} />;
  }

  if (kickedFromRoom) {
    return <KickedFromRoomScreen onReturn={() => router.replace("/dashboard")} />;
  }

  if (isWaitingForAdmission) {
    return (
      <WaitingForHostScreen
        message={waitingRoomPendingMessage}
        onCancel={handleLeave}
      />
    );
  }

  if (!hasJoinedLobby) {
    return (
      <GreenRoomLobby
        roomId={roomId}
        userName={localDisplayName}
        isGuest={isGuest}
        guestName={guestName}
        onGuestNameChange={setGuestName}
        localStream={localStream}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        videoDevices={videoDevices}
        audioDevices={audioDevices}
        selectedVideoDeviceId={selectedVideoDeviceId}
        selectedAudioDeviceId={selectedAudioDeviceId}
        switchCamera={switchCamera}
        switchMicrophone={switchMicrophone}
        participantCount={presenceList.length}
        onJoinMeeting={() => {
          setHasJoinedLobby(true);
          const finalName = guestName?.trim() || user?.name || "Guest";
          if (socket) {
            socket.emit("update-name", { name: finalName });
            socket.emit("join-room", { roomId, name: finalName });
          }
        }}
        onCancel={() => (isGuest ? router.push("/login") : router.push("/dashboard"))}
      />
    );
  }

  return (
    <div className={styles.roomContainer}>
      <RoomHeader
        roomId={roomId}
        copiedLink={copiedLink}
        onCopyMeetingLink={handleCopyMeetingLink}
        callDurationSeconds={callDurationSeconds}
        formatDuration={formatDuration}
        isRecording={isRecording}
        isPaused={isPaused}
        recordingSeconds={recordingSeconds}
        onResumeRecording={resumeRecording}
        onPauseRecording={pauseRecording}
        onStopRecording={stopRecording}
        isSidebarOpen={isSidebarOpen}
        sidebarTab={sidebarTab}
        onToggleSidebarTab={handleToggleSidebarTab}
        participantCount={presenceList.length + 1}
        unreadCount={unreadCount}
        isHost={isHost}
        onOpenRecap={() => setShowRecapModal(true)}
      />

      <RoomVideoStage
        localStream={localStream}
        localDisplayName={localDisplayName}
        isHost={isHost}
        isLocalHandRaised={isLocalHandRaised}
        isScreenSharing={isScreenSharing}
        isVideoMuted={isVideoMuted}
        isAudioMuted={isAudioMuted}
        speakingMap={speakingMap}
        peers={peers}
        presenceList={presenceList}
        networkQuality={networkQuality}
        raisedHands={raisedHands}
        screenSharingPeers={screenSharingPeers}
        activeSpotlightId={activeSpotlightId}
        onSetSpotlightId={setSpotlightId}
        hostNotification={hostNotification}
        isLowBandwidthMode={isLowBandwidthMode}
        reactions={reactions}
        onCopyMeetingLink={handleCopyMeetingLink}
        copiedLink={copiedLink}
        currentCaption={currentCaption}
        isCaptionsEnabled={isCaptionsEnabled}
        isBackgroundBlur={isBackgroundBlur}
      />

      <RoomControlBar
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
        showWhiteboard={showWhiteboard}
        isLocalHandRaised={isLocalHandRaised}
        showReactionsPicker={showReactionsPicker}
        isLowBandwidthMode={isLowBandwidthMode}
        isCaptionsEnabled={isCaptionsEnabled}
        onToggleCaptions={toggleCaptions}
        isBackgroundBlur={isBackgroundBlur}
        onToggleBackgroundBlur={() => setIsBackgroundBlur((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
        videoDevices={videoDevices}
        audioDevices={audioDevices}
        selectedVideoDeviceId={selectedVideoDeviceId}
        selectedAudioDeviceId={selectedAudioDeviceId}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={isRecording ? stopRecording : startRecording}
        onToggleWhiteboard={() => setShowWhiteboard((prev) => !prev)}
        onToggleRaiseHand={toggleRaiseHand}
        onToggleReactionsPicker={() => setShowReactionsPicker((prev) => !prev)}
        onSendReaction={(emoji) => {
          sendReaction(emoji);
          setShowReactionsPicker(false);
        }}
        onToggleLowBandwidthMode={toggleLowBandwidthMode}
        onToggleSidebar={() => {
          setIsSidebarOpen((prev) => !prev);
          setUnreadCount(0);
        }}
        onLeave={handleLeave}
        onSwitchCamera={switchCamera}
        onSwitchMicrophone={switchMicrophone}
      />

      {isSidebarOpen && (
        <RoomSidebar
          sidebarTab={sidebarTab}
          onSelectTab={(tab) => {
            setSidebarTab(tab);
            if (tab === "chat") setUnreadCount(0);
          }}
          onClose={() => setIsSidebarOpen(false)}
          localDisplayName={localDisplayName}
          isHost={isHost}
          isLocalHandRaised={isLocalHandRaised}
          presenceList={presenceList}
          peers={peers}
          raisedHands={raisedHands}
          onHostMutePeer={hostMutePeer}
          onHostKickPeer={hostKickPeer}
          isRoomLocked={isRoomLocked}
          onHostToggleLock={hostToggleLock}
          onHostMuteAll={hostMuteAll}
          messages={messages}
          chatMessagesRef={chatMessagesRef}
          onChatScroll={handleChatScroll}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSendMessage={handleSendMessage}
          unreadCount={unreadCount}
          roomId={roomId}
          polls={polls}
          onCreatePoll={createPoll}
          onVotePoll={votePoll}
          sharedNotes={sharedNotes}
          notesUpdatedBy={notesUpdatedBy}
          onUpdateSharedNotes={updateSharedNotes}
          isWaitingRoomEnabled={isWaitingRoomEnabled}
          waitingGuestsQueue={waitingGuestsQueue}
          onToggleWaitingRoom={toggleWaitingRoom}
          onHostAdmitGuest={hostAdmitGuest}
          onHostDenyGuest={hostDenyGuest}
        />
      )}

      <RecordingCompletionModal
        isOpen={showRecordModal}
        recording={lastSavedRecording}
        videoUrl={recordVideoUrl}
        onClose={() => setShowRecordModal(false)}
        onDownload={downloadRecording}
        onViewStudio={() => {
          setShowRecordModal(false);
          router.push("/dashboard/videos");
        }}
        formatDuration={formatDuration}
      />

      <WhiteboardModal
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
        socket={socket}
        roomId={roomId}
      />

      <MeetingRecapModal
        isOpen={showRecapModal}
        onClose={() => setShowRecapModal(false)}
        roomId={roomId}
        durationSeconds={callDurationSeconds}
        formatDuration={formatDuration}
        presenceList={presenceList}
        peers={peers}
        messages={messages}
        transcriptHistory={transcriptHistory}
      />
    </div>
  );
}
