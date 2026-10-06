import React, { useState } from "react";
import {
  Users,
  MessageSquare,
  Shield,
  X,
  Send,
  MicOff,
  UserX,
  Lock,
  Unlock,
  VolumeX,
  Hand,
  Crown,
  BarChart2,
  FileText,
  Copy,
  Check,
  Download,
  Plus,
  Trash2,
  Vote,
  Sparkles,
  UserCheck,
  DoorOpen,
  Clock,
} from "lucide-react";
import styles from "@/styles/room.module.scss";
import type { WaitingGuest } from "@/hooks/useRoom";

interface PresenceUser {
  socketId: string;
  userId: string;
  name?: string;
  isHost?: boolean;
}

interface Peer {
  socketId: string;
  userId?: string;
  name?: string;
  isHost?: boolean;
}

interface ChatMessage {
  userId?: string;
  name?: string;
  message: string;
  at: number;
  isLocal?: boolean;
}

interface HandRaisedUser {
  socketId: string;
  userId: string;
  name: string;
}

export type SidebarTabType = "people" | "chat" | "polls" | "notes" | "host";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollItem {
  id: string;
  question: string;
  options: PollOption[];
  creatorName: string;
  userVotedOptionId?: string;
}

interface RoomSidebarProps {
  sidebarTab: SidebarTabType;
  onSelectTab: (tab: SidebarTabType) => void;
  onClose: () => void;
  localDisplayName: string;
  isHost: boolean;
  isLocalHandRaised: boolean;
  presenceList: PresenceUser[];
  peers: Peer[];
  raisedHands: HandRaisedUser[];
  onHostMutePeer: (socketId: string) => void;
  onHostKickPeer: (socketId: string) => void;
  isRoomLocked: boolean;
  onHostToggleLock: () => void;
  onHostMuteAll: () => void;
  messages: ChatMessage[];
  chatMessagesRef: React.RefObject<HTMLDivElement | null>;
  onChatScroll: () => void;
  chatInput: string;
  onChatInputChange: (val: string) => void;
  onSendMessage: (e: React.SyntheticEvent) => void;
  unreadCount: number;
  roomId?: string;
  // Real-time Polls props
  polls?: PollItem[];
  onCreatePoll?: (question: string, options: string[]) => void;
  onVotePoll?: (pollId: string, optionId: string) => void;
  // Real-time Shared Notes props
  sharedNotes?: string;
  notesUpdatedBy?: string | null;
  onUpdateSharedNotes?: (notes: string) => void;
  // Waiting Room props
  isWaitingRoomEnabled?: boolean;
  waitingGuestsQueue?: WaitingGuest[];
  onToggleWaitingRoom?: () => void;
  onHostAdmitGuest?: (targetSocketId: string) => void;
  onHostDenyGuest?: (targetSocketId: string) => void;
}

export function RoomSidebar({
  sidebarTab,
  onSelectTab,
  onClose,
  localDisplayName,
  isHost,
  isLocalHandRaised,
  presenceList,
  peers,
  raisedHands,
  onHostMutePeer,
  onHostKickPeer,
  isRoomLocked,
  onHostToggleLock,
  onHostMuteAll,
  messages,
  chatMessagesRef,
  onChatScroll,
  chatInput,
  onChatInputChange,
  onSendMessage,
  unreadCount,
  roomId = "room",
  polls: pollsProp,
  onCreatePoll,
  onVotePoll,
  sharedNotes: sharedNotesProp,
  notesUpdatedBy,
  onUpdateSharedNotes,
  isWaitingRoomEnabled = false,
  waitingGuestsQueue = [],
  onToggleWaitingRoom,
  onHostAdmitGuest,
  onHostDenyGuest,
}: Readonly<RoomSidebarProps>) {
  // Live Polls state: fallback to local if real-time not provided
  const [localPolls, setLocalPolls] = useState<PollItem[]>([
    {
      id: "poll-default",
      question: "Are we ready to proceed with the release?",
      creatorName: "Host",
      options: [
        { id: "opt-1", text: "Yes, ready to deploy", votes: 3 },
        { id: "opt-2", text: "Needs 1 more review", votes: 1 },
        { id: "opt-3", text: "Hold until tomorrow", votes: 0 },
      ],
    },
  ]);
  const activePolls = pollsProp && pollsProp.length > 0 ? pollsProp : localPolls;
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>(["", ""]);

  // Meeting Notes state
  const [localNotes, setLocalNotes] = useState<string>(
    `# Meeting Notes — ${roomId}\n\n- **Agenda:** Platform Walkthrough & Feature Review\n- **Key Discussion:**\n  1. HD WebRTC video pipeline\n  2. Live collaborative whiteboard & screen sharing\n  3. Client-side HD recording\n\n- **Next Steps:**\n  - Finalize release notes\n  - Share meeting link with team`
  );
  const activeNotes = sharedNotesProp !== undefined && sharedNotesProp !== "" ? sharedNotesProp : localNotes;
  const [notesCopied, setNotesCopied] = useState(false);

  const handleVote = (pollId: string, optionId: string) => {
    if (onVotePoll) {
      onVotePoll(pollId, optionId);
    }
    setLocalPolls((prev) =>
      prev.map((poll) => {
        if (poll.id !== pollId) return poll;
        if (poll.userVotedOptionId === optionId) return poll;

        const updatedOptions = poll.options.map((opt) => {
          if (opt.id === optionId) {
            return { ...opt, votes: opt.votes + 1 };
          }
          if (opt.id === poll.userVotedOptionId) {
            return { ...opt, votes: Math.max(0, opt.votes - 1) };
          }
          return opt;
        });

        return {
          ...poll,
          options: updatedOptions,
          userVotedOptionId: optionId,
        };
      })
    );
  };

  const handleCreatePoll = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const validOptions = newOptions.map((o) => o.trim()).filter(Boolean);
    if (!newQuestion.trim() || validOptions.length < 2) return;

    if (onCreatePoll) {
      onCreatePoll(newQuestion.trim(), validOptions);
    } else {
      const newPoll: PollItem = {
        id: `poll-${Date.now()}`,
        question: newQuestion.trim(),
        creatorName: localDisplayName,
        options: validOptions.map((text, idx) => ({
          id: `opt-${idx + 1}`,
          text,
          votes: 0,
        })),
      };
      setLocalPolls((prev) => [newPoll, ...prev]);
    }

    setNewQuestion("");
    setNewOptions(["", ""]);
    setIsCreatingPoll(false);
  };

  const handleCopyNotes = () => {
    void navigator.clipboard.writeText(activeNotes);
    setNotesCopied(true);
    setTimeout(() => setNotesCopied(false), 2000);
  };

  const handleDownloadNotes = () => {
    const blob = new Blob([activeNotes], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Meeting-Notes-${roomId}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Sidebar Tab Switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "0.75rem",
          gap: "0.25rem",
          overflowX: "auto",
        }}
      >
        <div style={{ display: "flex", gap: "0.25rem", overflowX: "auto" }}>
          {/* People Tab */}
          <button
            type="button"
            onClick={() => onSelectTab("people")}
            style={{
              background: sidebarTab === "people" ? "rgba(99, 102, 241, 0.25)" : "transparent",
              color: sidebarTab === "people" ? "#818cf8" : "#94a3b8",
              border: sidebarTab === "people" ? "1px solid rgba(99, 102, 241, 0.45)" : "1px solid transparent",
              padding: "5px 9px",
              borderRadius: "8px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              whiteSpace: "nowrap",
            }}
          >
            <Users size={13} />
            <span>People ({presenceList.length + 1})</span>
          </button>

          {/* Chat Tab */}
          <button
            type="button"
            onClick={() => onSelectTab("chat")}
            style={{
              background: sidebarTab === "chat" ? "rgba(99, 102, 241, 0.25)" : "transparent",
              color: sidebarTab === "chat" ? "#818cf8" : "#94a3b8",
              border: sidebarTab === "chat" ? "1px solid rgba(99, 102, 241, 0.45)" : "1px solid transparent",
              padding: "5px 9px",
              borderRadius: "8px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              whiteSpace: "nowrap",
            }}
          >
            <MessageSquare size={13} />
            <span>Chat</span>
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
          </button>

          {/* Polls Tab */}
          <button
            type="button"
            onClick={() => onSelectTab("polls")}
            style={{
              background: sidebarTab === "polls" ? "rgba(16, 185, 129, 0.2)" : "transparent",
              color: sidebarTab === "polls" ? "#34d399" : "#94a3b8",
              border: sidebarTab === "polls" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
              padding: "5px 9px",
              borderRadius: "8px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              whiteSpace: "nowrap",
            }}
          >
            <BarChart2 size={13} />
            <span>Polls</span>
          </button>

          {/* Notes Tab */}
          <button
            type="button"
            onClick={() => onSelectTab("notes")}
            style={{
              background: sidebarTab === "notes" ? "rgba(168, 85, 247, 0.2)" : "transparent",
              color: sidebarTab === "notes" ? "#c084fc" : "#94a3b8",
              border: sidebarTab === "notes" ? "1px solid rgba(168, 85, 247, 0.4)" : "1px solid transparent",
              padding: "5px 9px",
              borderRadius: "8px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              whiteSpace: "nowrap",
            }}
          >
            <FileText size={13} />
            <span>Notes</span>
          </button>

          {/* Host Tab */}
          {isHost && (
            <button
              type="button"
              onClick={() => onSelectTab("host")}
              style={{
                background: sidebarTab === "host" ? "rgba(245, 158, 11, 0.2)" : "transparent",
                color: sidebarTab === "host" ? "#fbbf24" : "#94a3b8",
                border: sidebarTab === "host" ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid transparent",
                padding: "5px 9px",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                whiteSpace: "nowrap",
              }}
            >
              <Crown size={13} style={{ color: "#fbbf24" }} />
              <span>Host</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          title="Close Sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* People Tab Content */}
      {sidebarTab === "people" && (
        <ul className={styles.userList} style={{ maxHeight: "none", flex: 1, listStyle: "none", padding: 0, margin: 0 }}>
          <li className={styles.userItem}>
            <div className={styles.userAvatar}>
              {(localDisplayName || "U")[0].toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.name}>{localDisplayName} (You)</span>
              <span className={styles.status} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                <span>Active</span>
              </span>
            </div>
            <div className={styles.userActions}>
              {isHost && (
                <span className={styles.hostBadgeSmall}>
                  <Crown size={10} style={{ color: "#fbbf24" }} />
                  <span>Host</span>
                </span>
              )}
              {isLocalHandRaised && (
                <span className={styles.handBadgeSmall} title="Hand Raised">
                  <Hand size={12} />
                </span>
              )}
            </div>
          </li>

          {presenceList.map((presenceUser) => {
            const matchedPeer = peers.find(
              (p) => p.socketId === presenceUser.socketId || (presenceUser.userId && p.userId === presenceUser.userId)
            );
            const displayName =
              presenceUser.name ||
              matchedPeer?.name ||
              (presenceUser.userId ? `Peer (${presenceUser.userId.slice(0, 4)})` : "Participant");
            const isPeerHost = Boolean(presenceUser.isHost || matchedPeer?.isHost);
            const isHandRaised = raisedHands.some((h) => h.socketId === presenceUser.socketId);

            return (
              <li key={presenceUser.socketId} className={styles.userItem}>
                <div className={styles.userAvatar}>
                  {(displayName || "P")[0].toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.name}>{displayName}</span>
                  <span className={styles.status} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                    <span>Active</span>
                  </span>
                </div>
                <div className={styles.userActions}>
                  {isPeerHost && (
                    <span className={styles.hostBadgeSmall}>
                      <Crown size={10} style={{ color: "#fbbf24" }} />
                      <span>Host</span>
                    </span>
                  )}
                  {isHandRaised && (
                    <span className={styles.handBadgeSmall} title="Hand Raised">
                      <Hand size={12} />
                    </span>
                  )}
                  {isHost && (
                    <div className={styles.hostPeerButtons}>
                      <button
                        type="button"
                        onClick={() => onHostMutePeer(presenceUser.socketId)}
                        className={styles.hostMuteBtn}
                        title={`Mute ${displayName}`}
                      >
                        <MicOff size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${displayName} from the meeting?`)) {
                            onHostKickPeer(presenceUser.socketId);
                          }
                        }}
                        className={styles.hostKickBtn}
                        title={`Remove ${displayName} from meeting`}
                      >
                        <UserX size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Chat Tab Content */}
      {sidebarTab === "chat" && (
        <div className={styles.chatSection} style={{ borderTop: "none", paddingTop: 0 }}>
          <div
            className={styles.chatMessages}
            ref={chatMessagesRef}
            onScroll={onChatScroll}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#64748b", fontSize: "0.85rem", margin: "auto 0" }}>
                No messages yet. Send a message to everyone in the room!
              </div>
            )}
            {messages.map((msg, i) => {
              const authorName =
                msg.name ||
                presenceList.find((p) => msg.userId && p.userId === msg.userId)?.name ||
                peers.find((p) => msg.userId && p.userId === msg.userId)?.name ||
                "Participant";

              return (
                <div
                  key={`${msg.at}-${i}`}
                  className={`${styles.chatMessage} ${msg.isLocal ? styles.own : ""}`}
                >
                  {!msg.isLocal && (
                    <div className={styles.chatMessageAuthor}>{authorName}</div>
                  )}
                  {msg.message}
                </div>
              );
            })}
          </div>
          <form className={styles.chatInputRow} onSubmit={onSendMessage}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Send message to everyone…"
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
            />
            <button type="submit" className={styles.chatSendButton} disabled={!chatInput.trim()}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      {/* Polls Tab Content */}
      {sidebarTab === "polls" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
              In-Meeting Polls
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingPoll((prev) => !prev)}
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#34d399",
                borderRadius: "8px",
                padding: "4px 10px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Plus size={13} />
              <span>{isCreatingPoll ? "Cancel" : "Create Poll"}</span>
            </button>
          </div>

          {/* New Poll Creator Form */}
          {isCreatingPoll && (
            <form
              onSubmit={handleCreatePoll}
              style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "14px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <input
                type="text"
                placeholder="Ask a question…"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                required
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  color: "white",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />

              {newOptions.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...newOptions];
                    next[i] = e.target.value;
                    setNewOptions(next);
                  }}
                  required
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "10px",
                    padding: "6px 12px",
                    color: "white",
                    fontSize: "0.8rem",
                    outline: "none",
                  }}
                />
              ))}

              <button
                type="button"
                onClick={() => setNewOptions([...newOptions, ""])}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#818cf8",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  padding: 0,
                }}
              >
                + Add Option
              </button>

              <button
                type="submit"
                style={{
                  background: "#10b981",
                  border: "none",
                  color: "white",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  marginTop: "0.25rem",
                }}
              >
                Launch Poll
              </button>
            </form>
          )}

          {/* Active Polls List */}
          {activePolls.map((poll) => {
            const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

            return (
              <div
                key={poll.id}
                style={{
                  background: "rgba(15, 23, 42, 0.65)",
                  border: "1px solid rgba(255, 255, 255, 0.09)",
                  borderRadius: "16px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.9rem", color: "#f8fafc", fontWeight: 700, lineHeight: 1.3 }}>
                    {poll.question}
                  </h4>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {poll.options.map((opt) => {
                    const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.userVotedOptionId === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleVote(poll.id, opt.id)}
                        style={{
                          background: isSelected ? "rgba(99, 102, 241, 0.18)" : "rgba(255, 255, 255, 0.03)",
                          border: isSelected ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "10px",
                          padding: "8px 12px",
                          color: "white",
                          textAlign: "left",
                          cursor: "pointer",
                          position: "relative",
                          overflow: "hidden",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {/* Progress Bar Fill */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: `${percentage}%`,
                            background: isSelected ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.05)",
                            zIndex: 0,
                            transition: "width 0.3s ease",
                          }}
                        />

                        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                          <span>{opt.text}</span>
                          <span style={{ fontWeight: 700, color: isSelected ? "#818cf8" : "#94a3b8", fontSize: "0.75rem" }}>
                            {percentage}% ({opt.votes})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes Tab Content */}
      {sidebarTab === "notes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
              Live Meeting Notes
            </span>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={handleCopyNotes}
                title="Copy Notes Markdown"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#cbd5e1",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {notesCopied ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
                <span>{notesCopied ? "Copied" : "Copy"}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadNotes}
                title="Download as .md file"
                style={{
                  background: "rgba(99, 102, 241, 0.15)",
                  border: "1px solid rgba(99, 102, 241, 0.35)",
                  color: "#818cf8",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Download size={12} />
                <span>Export</span>
              </button>
            </div>
          </div>

          {notesUpdatedBy && (
            <div style={{ fontSize: "0.74rem", color: "#818cf8", marginBottom: "6px" }}>
              Last updated by: <strong>{notesUpdatedBy}</strong>
            </div>
          )}
          <textarea
            value={activeNotes}
            onChange={(e) => {
              const next = e.target.value;
              setLocalNotes(next);
              onUpdateSharedNotes?.(next);
            }}
            placeholder="Type meeting decisions, agenda notes, and action items…"
            style={{
              flex: 1,
              width: "100%",
              background: "rgba(15, 23, 42, 0.75)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "14px",
              padding: "12px",
              color: "#f8fafc",
              fontSize: "0.85rem",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.6,
              resize: "none",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Host Controls Tab Content */}
      {sidebarTab === "host" && isHost && (
        <div className={styles.hostControlsPanel} style={{ margin: 0 }}>
          <div className={styles.hostHeader}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Shield size={16} style={{ color: "#fbbf24" }} />
              <span>Host Governance</span>
            </span>
            <span className={styles.hostBadge}>
              {isRoomLocked ? "Locked" : "Open Room"}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
            Control room entry access, lock security, and manage participant audio permissions.
          </p>
          <div className={styles.hostActionsRow}>
            <button
              type="button"
              onClick={onHostToggleLock}
              className={`${styles.hostActionButton} ${isRoomLocked ? styles.locked : ""}`}
              title={isRoomLocked ? "Unlock Meeting for New Participants" : "Lock Meeting to Current Participants"}
            >
              {isRoomLocked ? (
                <>
                  <Unlock size={14} />
                  <span>Unlock Room</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Lock Room</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onHostMuteAll}
              className={styles.hostActionButton}
              title="Mute all other participants' microphones"
            >
              <VolumeX size={14} />
              <span>Mute All</span>
            </button>
          </div>

          {/* Waiting Room Section */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
                <DoorOpen size={15} style={{ color: "#38bdf8" }} />
                <span>Waiting Room</span>
              </span>
              <button
                type="button"
                onClick={onToggleWaitingRoom}
                style={{
                  background: isWaitingRoomEnabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.06)",
                  border: isWaitingRoomEnabled ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
                  color: isWaitingRoomEnabled ? "#34d399" : "#94a3b8",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {isWaitingRoomEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.4 }}>
              Require guests to knock and get host approval before entering.
            </p>

            {/* Knocking Guests List */}
            {waitingGuestsQueue && waitingGuestsQueue.length > 0 && (
              <div style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#fbbf24", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Clock size={12} />
                  <span>Knocking Guests ({waitingGuestsQueue.length})</span>
                </span>
                {waitingGuestsQueue.map((guest) => (
                  <div
                    key={guest.socketId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      background: "rgba(251, 191, 36, 0.08)",
                      border: "1px solid rgba(251, 191, 36, 0.25)",
                      borderRadius: "10px",
                    }}
                  >
                    <span style={{ fontSize: "0.82rem", color: "#f1f5f9", fontWeight: 500 }}>
                      {guest.name || "Guest"}
                    </span>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button
                        type="button"
                        onClick={() => onHostAdmitGuest?.(guest.socketId)}
                        style={{
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Admit
                      </button>
                      <button
                        type="button"
                        onClick={() => onHostDenyGuest?.(guest.socketId)}
                        style={{
                          background: "rgba(239, 68, 68, 0.2)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
