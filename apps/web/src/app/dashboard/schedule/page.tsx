"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarPlus,
  Clock,
  Key,
  Users,
  Mail,
  Send,
  Copy,
  Check,
  Trash2,
  Crown,
  User,
  X,
  Bell,
  Video,
  Loader2,
  Sparkles,
  Download,
} from "lucide-react";
import dashboardStyles from "@/styles/dashboard.module.scss";
import styles from "@/styles/schedule.module.scss";
import {
  createScheduledMeeting,
  getScheduledMeetings,
  deleteScheduledMeeting,
  sendMeetingReminders,
  ScheduledMeetingItem,
} from "@/services/schedule.service";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

export default function SchedulePage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<ScheduledMeetingItem[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
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
    getScheduledMeetings()
      .then(setMeetings)
      .catch((err) => {
        console.error("Failed to fetch scheduled meetings:", err);
        setMeetings([]);
      });
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  // Invitee management
  const handleAddInvitee = () => {
    const trimmed = inviteeInput.trim().toLowerCase();
    if (!trimmed) return;

    if (!EMAIL_REGEX.test(trimmed)) {
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
  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) return;

    const finalInvitees = [...invitees];
    const pendingEmail = inviteeInput.trim().toLowerCase();
    if (pendingEmail && EMAIL_REGEX.test(pendingEmail)) {
      if (!finalInvitees.includes(pendingEmail)) {
        finalInvitees.push(pendingEmail);
      }
      setInviteeInput("");
      setInvitees(finalInvitees);
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await createScheduledMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        invitees: finalInvitees,
      });

      setFeedback({
        type: "success",
        text: `Meeting scheduled successfully! ${
          res.data.emailsSent > 0
            ? `Email invitations dispatched to ${res.data.emailsSent} recipient(s).`
            : "Meeting room is ready."
        }`,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setInvitees([]);
      setShowModal(false);
      void loadMeetings();
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
        text: `Email reminders sent to ${res.data.sent} participant(s).`,
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
    void navigator.clipboard.writeText(fullUrl);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddToGoogleCalendar = (m: ScheduledMeetingItem) => {
    const startDate = new Date(m.scheduledAt);
    const endDate = new Date(startDate.getTime() + m.durationMinutes * 60000);
    const formatGCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const meetingUrl = `${window.location.origin}/dashboard/room/${m.roomCode}`;
    const text = m.title;
    const details = `${m.description || "SuperCall Video Meeting"}\n\nJoin Meeting: ${meetingUrl}`;
    const dates = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      text
    )}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(meetingUrl)}`;

    window.open(url, "_blank");
  };

  const handleDownloadIcs = (m: ScheduledMeetingItem) => {
    const startDate = new Date(m.scheduledAt);
    const endDate = new Date(startDate.getTime() + m.durationMinutes * 60000);
    const formatIcsDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const meetingUrl = `${window.location.origin}/dashboard/room/${m.roomCode}`;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SuperCall//Realtime Video Platform//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${m.id}@supercall.io`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${m.title}`,
      `DESCRIPTION:${(m.description || "SuperCall Meeting").replace(/\n/g, "\\n")} Join call: ${meetingUrl}`,
      `LOCATION:${meetingUrl}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.title.replace(/[^a-zA-Z0-9]/g, "-")}-invite.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };


  const renderMeetingsContent = () => {
    if (meetings === null) {
      return (
        <div style={{ color: "#94a3b8", padding: "3rem 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
          <Loader2 size={18} className="animate-spin" />
          <span>Loading scheduled meetings…</span>
        </div>
      );
    }
    if (meetings.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Calendar size={36} style={{ color: "#818cf8" }} />
          </div>
          <h3>No upcoming meetings scheduled</h3>
          <p>
            Click <strong>&quot;Schedule New Meeting&quot;</strong> above to set a date, time, and dispatch
            automated email invitations with room access links!
          </p>
        </div>
      );
    }
    return (
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
                      <span className={styles.hostBadge}>
                        <Crown size={12} style={{ color: "#fbbf24" }} />
                        <span>Hosted by You</span>
                      </span>
                    ) : (
                      <span className={styles.guestBadge}>
                        <User size={12} />
                        <span>Hosted by {m.host?.name || "Host"}</span>
                      </span>
                    )}
                  </div>

                  <div className={styles.cardMetaRow}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} />
                      <span>{timeStr} ({m.durationMinutes} min)</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Key size={12} />
                      <span>Room: {m.roomCode}</span>
                    </span>
                  </div>

                  {m.description && <p className={styles.cardDesc}>{m.description}</p>}

                  {m.inviteeList.length > 0 && (
                    <div className={styles.inviteesSummary}>
                      <Mail size={13} style={{ color: "#818cf8" }} />
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
                  <Video size={14} />
                  <span>{m.isHost ? "Start Call" : "Join Call"}</span>
                </button>

                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => handleCopyLink(m)}
                  title="Copy meeting invitation link"
                >
                  {copiedId === m.id ? (
                    <>
                      <Check size={14} style={{ color: "#34d399" }} />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => handleAddToGoogleCalendar(m)}
                  title="Add to Google Calendar"
                >
                  <Calendar size={13} style={{ color: "#4285F4" }} />
                  <span>Google Cal</span>
                </button>

                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => handleDownloadIcs(m)}
                  title="Download .ics Calendar Invite"
                >
                  <Download size={13} />
                  <span>.ics</span>
                </button>

                {m.isHost && m.inviteeList.length > 0 && (
                  <button
                    type="button"
                    className={styles.reminderBtn}
                    onClick={() => handleSendReminder(m.id)}
                    disabled={remindingId === m.id}
                    title="Send email reminders to invitees"
                  >
                    <Bell size={13} />
                    <span>{remindingId === m.id ? "Sending…" : "Remind"}</span>
                  </button>
                )}

                {m.isHost && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(m.id)}
                    title="Cancel this scheduled meeting"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={dashboardStyles.card}>
      <div className={styles.container}>
        {/* Header Bar */}
        <div className={styles.topBar}>
          <div className={styles.titleBox}>
            <h2>Scheduled Meetings &amp; Invites</h2>
            <p>Plan upcoming video calls, dispatch automated email invitations, and manage your team agenda.</p>
          </div>
          <button
            type="button"
            className={styles.scheduleNewBtn}
            onClick={() => setShowModal(true)}
          >
            <CalendarPlus size={16} />
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
        {renderMeetingsContent()}

        {/* Schedule Modal */}
        {showModal && (
          <div className={styles.modalOverlay}>
            <button
              type="button"
              className={styles.modalBackdrop}
              onClick={() => setShowModal(false)}
              aria-label="Close schedule modal"
              tabIndex={-1}
            />
            <dialog
              open
              aria-modal="true"
              aria-labelledby="schedule-modal-title"
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Calendar size={18} style={{ color: "#818cf8" }} />
                  <h3 id="schedule-modal-title">Schedule a Video Meeting</h3>
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setShowModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="meeting-title">Meeting Title *</label>
                  <input
                    id="meeting-title"
                    type="text"
                    required
                    placeholder="e.g. Weekly Product & Architecture Sync"
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="meeting-desc">Description (Optional)</label>
                  <textarea
                    id="meeting-desc"
                    placeholder="Meeting agenda, discussion points, or preparation links…"
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
                            <X size={12} />
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
                  {(() => {
                    if (isSubmitting) return "Scheduling & Sending Invites…";
                    if (invitees.length > 0) return `Schedule & Send Invites (${invitees.length})`;
                    return "Schedule & Create Room";
                  })()}
                </button>
              </form>
            </dialog>
          </div>
        )}
      </div>
    </div>
  );
}
