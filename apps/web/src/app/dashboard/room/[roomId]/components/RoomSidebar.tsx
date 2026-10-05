import React from "react";
import styles from "@/styles/room.module.scss";

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

interface RoomSidebarProps {
  sidebarTab: "people" | "chat" | "host";
  onSelectTab: (tab: "people" | "chat" | "host") => void;
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
}: Readonly<RoomSidebarProps>) {
  return (
    <aside className={styles.sidebar}>
      {/* Sidebar Tab Switcher */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        paddingBottom: "0.75rem",
      }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => onSelectTab("people")}
            style={{
              background: sidebarTab === "people" ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: sidebarTab === "people" ? "#60a5fa" : "#94a3b8",
              border: sidebarTab === "people" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
              padding: "4px 10px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            👥 People ({presenceList.length + 1})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("chat")}
            style={{
              background: sidebarTab === "chat" ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: sidebarTab === "chat" ? "#60a5fa" : "#94a3b8",
              border: sidebarTab === "chat" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
              padding: "4px 10px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            💬 Chat {unreadCount > 0 ? `(${unreadCount})` : ""}
          </button>
          {isHost && (
            <button
              type="button"
              onClick={() => onSelectTab("host")}
              style={{
                background: sidebarTab === "host" ? "rgba(234, 179, 8, 0.2)" : "transparent",
                color: sidebarTab === "host" ? "#facc15" : "#94a3b8",
                border: sidebarTab === "host" ? "1px solid rgba(234, 179, 8, 0.4)" : "1px solid transparent",
                padding: "4px 10px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              👑 Host
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
            fontSize: "1.1rem",
            cursor: "pointer",
            padding: "2px 6px",
          }}
          title="Close Sidebar"
        >
          ✕
        </button>
      </div>

      {/* People Tab Content */}
      {sidebarTab === "people" && (
        <ul className={styles.userList} style={{ maxHeight: "none", flex: 1 }}>
          <li className={styles.userItem}>
            <div className={styles.userAvatar}>
              {(localDisplayName || "U")[0].toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.name}>{localDisplayName} (You)</span>
              <span className={styles.status}>🟢 Active</span>
            </div>
            <div className={styles.userActions}>
              {isHost && <span className={styles.hostBadgeSmall}>👑 Host</span>}
              {isLocalHandRaised && <span className={styles.handBadgeSmall} title="Hand Raised">✋</span>}
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
                  <span className={styles.status}>🟢 Active</span>
                </div>
                <div className={styles.userActions}>
                  {isPeerHost && <span className={styles.hostBadgeSmall}>👑 Host</span>}
                  {isHandRaised && <span className={styles.handBadgeSmall} title="Hand Raised">✋</span>}
                  {isHost && (
                    <div className={styles.hostPeerButtons}>
                      <button
                        type="button"
                        onClick={() => onHostMutePeer(presenceUser.socketId)}
                        className={styles.hostMuteBtn}
                        title={`Mute ${displayName}`}
                      >
                        🔇
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
                        ❌
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Host Controls Tab Content */}
      {sidebarTab === "host" && isHost && (
        <div className={styles.hostControlsPanel} style={{ margin: 0 }}>
          <div className={styles.hostHeader}>
            <span>👑 Host Governance</span>
            <span className={styles.hostBadge}>{isRoomLocked ? "🔒 Locked" : "🔓 Open"}</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
            Manage meeting security and participant permissions in real-time.
          </p>
          <div className={styles.hostActionsRow}>
            <button
              type="button"
              onClick={onHostToggleLock}
              className={`${styles.hostActionButton} ${isRoomLocked ? styles.locked : ""}`}
              title={isRoomLocked ? "Unlock Meeting for New Participants" : "Lock Meeting to Current Participants"}
            >
              {isRoomLocked ? "🔓 Unlock Room" : "🔒 Lock Room"}
            </button>
            <button
              type="button"
              onClick={onHostMuteAll}
              className={styles.hostActionButton}
              title="Mute all other participants' microphones"
            >
              🔇 Mute All
            </button>
          </div>
        </div>
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
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.82rem", margin: "auto 0" }}>
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
              placeholder="Type a message…"
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
            />
            <button type="submit" className={styles.chatSendButton} disabled={!chatInput.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
