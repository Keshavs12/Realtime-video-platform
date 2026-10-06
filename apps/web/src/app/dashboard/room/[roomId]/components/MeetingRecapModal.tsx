"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  Copy,
  Check,
  X,
  Clock,
  Users,
  MessageSquare,
  BarChart2,
  Subtitles,
  Sparkles,
  Loader2,
  CheckSquare,
  ListOrdered,
} from "lucide-react";
import styles from "@/styles/room.module.scss";
import { ChatMessage, PresenceUser, Peer } from "@/hooks/useRoom";
import { CaptionEntry } from "@/hooks/useSpeechCaptions";
import { summarizeMeeting, MeetingSummaryData } from "@/services/room.service";

interface MeetingRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  durationSeconds: number;
  formatDuration: (sec: number) => string;
  presenceList: PresenceUser[];
  peers: Peer[];
  messages: ChatMessage[];
  transcriptHistory: CaptionEntry[];
}

export function MeetingRecapModal({
  isOpen,
  onClose,
  roomId,
  durationSeconds,
  formatDuration,
  presenceList,
  peers,
  messages,
  transcriptHistory,
}: Readonly<MeetingRecapModalProps>) {
  const [activeTab, setActiveTab] = useState<"ai" | "transcript" | "chat" | "attendees">("ai");
  const [copied, setCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState<MeetingSummaryData | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const totalAttendees = Math.max(1, presenceList.length + 1);

  const handleGenerateAi = async () => {
    setIsGeneratingAi(true);
    try {
      const data = await summarizeMeeting({
        roomId,
        transcriptHistory,
        messages,
        durationSeconds,
      });
      setAiSummary(data);
      setActiveTab("ai");
    } catch (err) {
      console.error("Failed to generate AI summary:", err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  if (!isOpen) return null;

  const generateMarkdownReport = (): string => {
    const lines: string[] = [
      `# SuperCall Meeting Intelligence & Recap`,
      `**Meeting ID:** ${roomId}`,
      `**Date:** ${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      `**Duration:** ${formatDuration(durationSeconds)} (${durationSeconds}s)`,
      `**Total Attendees:** ${totalAttendees}`,
      ``,
    ];

    if (aiSummary) {
      lines.push(
        `---`,
        `## 🤖 Executive AI Summary`,
        aiSummary.executiveSummary,
        ``,
        `### ✅ Key Decisions`,
        ...aiSummary.keyDecisions.map((d) => `- ${d}`),
        ``,
        `### 📌 Action Items`,
        ...aiSummary.actionItems.map((a) => `- [ ] **${a.assignee}:** ${a.task}`),
        ``
      );
    }

    lines.push(
      `---`,
      `## 👥 Attendees`,
    );

    presenceList.forEach((p) => {
      lines.push(`- ${p.name || "Participant"} ${p.isHost ? "(Host)" : ""}`);
    });

    lines.push(``, `---`, `## 🎙️ Spoken Speech-to-Text Transcript`);
    if (transcriptHistory.length === 0) {
      lines.push(`_No spoken captions were captured during this meeting._`);
    } else {
      transcriptHistory.forEach((t) => {
        const time = new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        lines.push(`- **[${time}] ${t.speaker}:** ${t.text}`);
      });
    }

    lines.push(``, `---`, `## 💬 In-Call Chat Messages`);
    if (messages.length === 0) {
      lines.push(`_No chat messages were sent during this session._`);
    } else {
      messages.forEach((m) => {
        const time = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        lines.push(`- **[${time}] ${m.name || "Participant"}:** ${m.message}`);
      });
    }

    lines.push(``, `---`, `_Generated automatically by SuperCall Realtime Video Platform._`);
    return lines.join("\n");
  };

  const handleCopy = () => {
    const md = generateMarkdownReport();
    void navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = generateMarkdownReport();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SuperCall-Recap-${roomId}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          maxHeight: "85vh",
          background: "rgba(11, 16, 27, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(99, 102, 241, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #6366f1, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "white" }}>
                Meeting Intelligence &amp; Recap
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.78rem", color: "#94a3b8", marginTop: "2px" }}>
                <span>Room: <strong style={{ color: "#f1f5f9" }}>{roomId}</strong></span>
                <span>•</span>
                <span>Duration: <strong style={{ color: "#f1f5f9" }}>{formatDuration(durationSeconds)}</strong></span>
                <span>•</span>
                <span>Attendees: <strong style={{ color: "#f1f5f9" }}>{totalAttendees}</strong></span>
              </div>
            </div>
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
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.75rem 1.75rem",
            background: "rgba(255, 255, 255, 0.02)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            overflowX: "auto",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            style={{
              background: activeTab === "ai" ? "linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))" : "transparent",
              border: activeTab === "ai" ? "1px solid rgba(168, 85, 247, 0.5)" : "1px solid transparent",
              color: activeTab === "ai" ? "#c084fc" : "#94a3b8",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              whiteSpace: "nowrap",
            }}
          >
            <Sparkles size={14} style={{ color: "#c084fc" }} />
            <span>AI Executive Summary {aiSummary ? "✓" : ""}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            style={{
              background: activeTab === "transcript" ? "rgba(99, 102, 241, 0.2)" : "transparent",
              border: activeTab === "transcript" ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
              color: activeTab === "transcript" ? "#818cf8" : "#94a3b8",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <Subtitles size={14} />
            <span>Spoken Captions ({transcriptHistory.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            style={{
              background: activeTab === "chat" ? "rgba(99, 102, 241, 0.2)" : "transparent",
              border: activeTab === "chat" ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
              color: activeTab === "chat" ? "#818cf8" : "#94a3b8",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <MessageSquare size={14} />
            <span>Chat Log ({messages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("attendees")}
            style={{
              background: activeTab === "attendees" ? "rgba(99, 102, 241, 0.2)" : "transparent",
              border: activeTab === "attendees" ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
              color: activeTab === "attendees" ? "#818cf8" : "#94a3b8",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <Users size={14} />
            <span>Participants ({totalAttendees})</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1, maxHeight: "420px" }}>
          {activeTab === "ai" && (
            <div>
              {!aiSummary && !isGeneratingAi && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2.5rem 1.5rem",
                    background: "rgba(99, 102, 241, 0.04)",
                    border: "1px dashed rgba(99, 102, 241, 0.3)",
                    borderRadius: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #6366f1, #a855f7)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 1rem",
                      color: "white",
                    }}
                  >
                    <Sparkles size={24} />
                  </div>
                  <h4 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", color: "#f8fafc", fontWeight: 700 }}>
                    AI Meeting Summarization &amp; Action Extraction
                  </h4>
                  <p style={{ margin: "0 0 1.25rem", color: "#94a3b8", fontSize: "0.85rem", maxWidth: "440px", marginInline: "auto", lineHeight: 1.5 }}>
                    Generate a high-level executive briefing, bulleted key decisions, and assigned action items automatically from speech transcripts and chat history.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    style={{
                      background: "linear-gradient(135deg, #6366f1, #a855f7)",
                      border: "none",
                      color: "white",
                      padding: "9px 20px",
                      borderRadius: "12px",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      boxShadow: "0 4px 15px rgba(168, 85, 247, 0.35)",
                    }}
                  >
                    <Sparkles size={16} />
                    <span>Generate AI Summary (Gemini)</span>
                  </button>
                </div>
              )}

              {isGeneratingAi && (
                <div style={{ textAlign: "center", padding: "3.5rem 1.5rem", color: "#a5b4fc" }}>
                  <Loader2 size={36} className={styles.pulseGlow} style={{ margin: "0 auto 1rem", animation: "spin 1.2s linear infinite" }} />
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#f8fafc" }}>
                    Analyzing meeting transcript &amp; extracting action items…
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                    Synthesizing discussion topics and decisions via Gemini Intelligence
                  </p>
                </div>
              )}

              {aiSummary && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {/* Executive TL;DR */}
                  <div
                    style={{
                      background: "rgba(99, 102, 241, 0.08)",
                      border: "1px solid rgba(99, 102, 241, 0.25)",
                      borderRadius: "14px",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#a5b4fc", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <Sparkles size={15} />
                        <span>Executive Summary</span>
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "6px" }}>
                        {aiSummary.generatedBy === "gemini" ? "Powered by Gemini" : "Synthesized AI"}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: "#f1f5f9", fontSize: "0.88rem", lineHeight: 1.6 }}>
                      {aiSummary.executiveSummary}
                    </p>
                  </div>

                  {/* Key Decisions */}
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      borderRadius: "14px",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
                      <ListOrdered size={15} />
                      <span>Key Decisions Made ({aiSummary.keyDecisions.length})</span>
                    </span>
                    <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {aiSummary.keyDecisions.map((dec, i) => (
                        <li key={i} style={{ color: "#e2e8f0", fontSize: "0.85rem", lineHeight: 1.5 }}>
                          {dec}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Items */}
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      borderRadius: "14px",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fbbf24", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
                      <CheckSquare size={15} />
                      <span>Action Items &amp; Owners ({aiSummary.actionItems.length})</span>
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {aiSummary.actionItems.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "rgba(255, 255, 255, 0.02)",
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <span style={{ fontSize: "0.84rem", color: "#f1f5f9" }}>{item.task}</span>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              background: "rgba(251, 191, 36, 0.15)",
                              color: "#fbbf24",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              marginLeft: "0.5rem",
                            }}
                          >
                            {item.assignee}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "transcript" && (
            <div>
              {transcriptHistory.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "2.5rem 0" }}>
                  <Subtitles size={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>
                    No live speech was transcribed yet. Turn on Live Captions (CC) in the controls bar during a call to capture speech automatically!
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {transcriptHistory.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        padding: "10px 14px",
                        borderRadius: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.75rem" }}>
                        <strong style={{ color: "#818cf8" }}>{item.speaker}</strong>
                        <span style={{ color: "#64748b" }}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.875rem", lineHeight: 1.5 }}>
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div>
              {messages.length === 0 ? (
                <p style={{ color: "#64748b", textAlign: "center", padding: "2rem 0", margin: 0, fontSize: "0.875rem" }}>
                  No messages sent during this session.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {messages.map((msg, i) => (
                    <div
                      key={`${msg.at}-${i}`}
                      style={{
                        padding: "8px 12px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: "10px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#818cf8", marginBottom: "2px" }}>
                        <span>{msg.name || "Participant"}</span>
                        <span style={{ color: "#64748b" }}>
                          {new Date(msg.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span style={{ color: "#e2e8f0" }}>{msg.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "attendees" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "12px",
                }}
              >
                <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.875rem" }}>You (Current User)</span>
                <span style={{ fontSize: "0.75rem", color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "6px" }}>
                  Active
                </span>
              </div>
              {presenceList.map((p) => (
                <div
                  key={p.socketId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "12px",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.875rem" }}>
                    {p.name || "Participant"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: p.isHost ? "#fbbf24" : "#818cf8" }}>
                    {p.isHost ? "Host" : "Participant"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "1rem 1.75rem",
            background: "rgba(15, 23, 42, 0.6)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "white",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                transition: "all 0.2s ease",
              }}
            >
              {copied ? <Check size={14} style={{ color: "#34d399" }} /> : <Copy size={14} />}
              <span>{copied ? "Report Copied" : "Copy Markdown"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                color: "white",
                padding: "8px 16px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                boxShadow: "0 4px 15px rgba(99, 102, 241, 0.35)",
              }}
            >
              <Download size={14} />
              <span>Download Full Recap (.md)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
