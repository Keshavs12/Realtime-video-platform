"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dashboardStyles from "@/styles/dashboard.module.scss";
import styles from "@/styles/schedule.module.scss";
import {
  createScheduledMeeting,
  getScheduledMeetings,
  deleteScheduledMeeting,
  sendMeetingReminders,
  ScheduledMeetingItem,
} from "@/services/schedule.service";

export default function SchedulePage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<ScheduledMeetingItem[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteeInput, setInviteeInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // Load scheduled meetings
  const loadMeetings = async () => {
    try {
      const data = await getScheduledMeetings();
      setMeetings(data);
    } catch (err) {
      console.error("Failed to fetch scheduled meetings:", err);
      setMeetings([]);
    }
  };

  useEffect(() => {
    loadMeetings();

    // Default datetime-local to 1 hour from now
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localIso);
  }, []);

  // Invitee management
  const handleAddInvitee = () => {
    const trimmed = inviteeInput.trim().toLowerCase();
    if (!trimmed) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!invitees.includes(trimmed)) {
      setInvitees([...invitees, trimmed]);
    }
    setInviteeInput("");
  };

  const handleInviteeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddInvitee();
    }
  };

  const handleRemoveInvitee = (emailToRemove: string) => {
    setInvitees(invitees.filter((e) => e !== emailToRemove));
  };

  // Submit Schedule Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await createScheduledMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        invitees,
      });

      setFeedback({
        type: "success",
        text: `🎉 Meeting scheduled! ${
          res.data.emailsSent > 0
            ? `Email invitations sent to ${res.data.emailsSent} recipient(s).`
            : "Room created and ready."
        }`,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setInvitees([]);
      setShowModal(false);
      loadMeetings();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to schedule meeting. Please try again.";
      setFeedback({ type: "error", text: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Meeting
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled meeting?")) {
      return;
    }

    try {
      await deleteScheduledMeeting(id);
      setMeetings((prev) => (prev ? prev.filter((m) => m.id !== id) : []));
      setFeedback({ type: "success", text: "Scheduled meeting cancelled." });
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      alert("Failed to cancel meeting.");
    }
  };

  // Send Reminders
  const handleSendReminder = async (id: string) => {
    setRemindingId(id);
    try {
      const res = await sendMeetingReminders(id);
      setFeedback({
        type: "success",
        text: `🔔 Email reminders dispatched to ${res.data.sent} participant(s).`,
      });
    } catch (err) {
      console.error("Failed to send reminders:", err);
      alert("Failed to send reminders.");
    } finally {
      setRemindingId(null);
    }
  };

  // Copy Meeting URL
  const handleCopyLink = (m: ScheduledMeetingItem) => {
    const fullUrl = `${window.location.origin}/dashboard/room/${m.roomCode}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={dashboardStyles.card}>
      <div className={styles.container}>
        {/* Header Bar */}
        <div className={styles.topBar}>
          <div className={styles.titleBox}>
            <h2>Scheduled Meetings &amp; Invites</h2>
            <p>Plan upcoming video calls, send email invitations via Nodemailer, and manage schedules.</p>
          </div>
          <button
            type="button"
            className={styles.scheduleNewBtn}
            onClick={() => setShowModal(true)}
          >
            <span>📅</span>
            <span>Schedule New Meeting</span>
          </button>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div className={`${styles.statusMessage} ${styles[feedback.type]}`}>
            {feedback.text}
          </div>
        )}

        {/* Meetings List */}
        {meetings === null ? (
          <p style={{ color: "#94a3b8", padding: "2rem 0", textAlign: "center" }}>
            Loading scheduled meetings…
          </p>
        ) : meetings.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <h3>No upcoming meetings scheduled</h3>
            <p>
              Click <strong>&quot;Schedule New Meeting&quot;</strong> above to select a date, time, and invite
              participants with direct email invitations!
            </p>
          </div>
        ) : (
          <div className={styles.meetingsGrid}>
            {meetings.map((m) => {
              const dateObj = new Date(m.scheduledAt);
              const monthStr = dateObj.toLocaleString("en-US", { month: "short" });
              const dayStr = dateObj.getDate();
              const timeStr = dateObj.toLocaleString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div key={m.id} className={styles.meetingCard}>
                  <div className={styles.cardLeft}>
                    {/* Date Block */}
                    <div className={styles.dateBlock}>
                      <span className={styles.dateMonth}>{monthStr}</span>
                      <span className={styles.dateDay}>{dayStr}</span>
                    </div>

                    <div className={styles.cardInfo}>
                      <div className={styles.cardTitleRow}>
                        <h4 className={styles.cardTitle}>{m.title}</h4>
                        {m.isHost ? (
                          <span className={styles.hostBadge}>👑 Hosted by You</span>
                        ) : (
                          <span className={styles.guestBadge}>
                            👤 Hosted by {m.host?.name || "Host"}
                          </span>
                        )}
                      </div>

                      <div className={styles.cardMetaRow}>
                        <span>⏰ {timeStr} ({m.durationMinutes} min)</span>
                        <span>🔑 Room: {m.roomCode}</span>
                      </div>

                      {m.description && <p className={styles.cardDesc}>{m.description}</p>}

                      {m.inviteeList.length > 0 && (
                        <div className={styles.inviteesSummary}>
                          <span>✉️</span>
                          <span>
                            {m.inviteeList.length} invitee{m.inviteeList.length > 1 ? "s" : ""}:{" "}
                            {m.inviteeList.slice(0, 3).join(", ")}
                            {m.inviteeList.length > 3 ? ` +${m.inviteeList.length - 3} more` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.startBtn}
                      onClick={() => router.push(`/dashboard/room/${m.roomCode}`)}
                    >
                      <span>🚀</span>
                      <span>{m.isHost ? "Start Meeting" : "Join Meeting"}</span>
                    </button>

                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => handleCopyLink(m)}
                      title="Copy meeting invitation link"
                    >
                      {copiedId === m.id ? "✓ Copied" : "📋 Link"}
                    </button>

                    {m.isHost && m.inviteeList.length > 0 && (
                      <button
                        type="button"
                        className={styles.reminderBtn}
                        onClick={() => handleSendReminder(m.id)}
                        disabled={remindingId === m.id}
                        title="Send email reminders to invitees"
                      >
                        {remindingId === m.id ? "Sending…" : "🔔 Remind"}
                      </button>
                    )}

                    {m.isHost && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(m.id)}
                        title="Cancel this scheduled meeting"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Schedule Modal */}
        {showModal && (
          <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Schedule a Video Meeting</h3>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setShowModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="meeting-title">Meeting Title *</label>
                  <input
                    id="meeting-title"
                    type="text"
                    required
                    placeholder="e.g. Weekly Team Standup"
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="meeting-desc">Description (Optional)</label>
                  <textarea
                    id="meeting-desc"
                    placeholder="Agenda, notes, or discussion points…"
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label htmlFor="meeting-datetime">Date &amp; Time *</label>
                    <input
                      id="meeting-datetime"
                      type="datetime-local"
                      required
                      className={styles.input}
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="meeting-duration">Duration</label>
                    <select
                      id="meeting-duration"
                      className={styles.select}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes (1 hr)</option>
                      <option value={90}>90 minutes (1.5 hr)</option>
                    </select>
                  </div>
                </div>

                {/* Invitee Email Input */}
                <div className={styles.field}>
                  <label htmlFor="invitee-email">Invite by Email (Optional)</label>
                  <div className={styles.inviteeInputRow}>
                    <input
                      id="invitee-email"
                      type="email"
                      placeholder="colleague@example.com"
                      className={styles.input}
                      style={{ flex: 1 }}
                      value={inviteeInput}
                      onChange={(e) => setInviteeInput(e.target.value)}
                      onKeyDown={handleInviteeKeyDown}
                    />
                    <button
                      type="button"
                      className={styles.addInviteeBtn}
                      onClick={handleAddInvitee}
                    >
                      + Add
                    </button>
                  </div>

                  {invitees.length > 0 && (
                    <div className={styles.inviteeChips}>
                      {invitees.map((email) => (
                        <span key={email} className={styles.inviteeChip}>
                          <span>{email}</span>
                          <button
                            type="button"
                            className={styles.chipRemoveBtn}
                            onClick={() => handleRemoveInvitee(email)}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !scheduledAt}
                  className={styles.submitBtn}
                >
                  {isSubmitting
                    ? "Scheduling & Sending Invites…"
                    : `✉️ Schedule & Send Invites ${
                        invitees.length > 0 ? `(${invitees.length})` : ""
                      }`}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
