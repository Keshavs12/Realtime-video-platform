"use client";

import React, { useState } from "react";
import {
  X,
  QrCode,
  Copy,
  Check,
  Share2,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import styles from "./RoomQrCodeModal.module.scss";

interface RoomQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const RoomQrCodeModal = ({ isOpen, onClose, roomCode }: RoomQrCodeModalProps) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !roomCode) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://supercall.app";
  const roomUrl = `${origin}/dashboard/room/${roomCode.trim().toLowerCase()}`;

  // High-reliability crisp QR code generator URL (200x200)
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=svg&data=${encodeURIComponent(
    roomUrl
  )}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <div className={styles.iconBadge}>
              <QrCode size={18} />
            </div>
            <div>
              <h3>Scan to Join Meeting</h3>
              <p>Instant mobile entry for Android &amp; iOS devices</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close QR Code">
            <X size={18} />
          </button>
        </div>

        {/* QR Code Container */}
        <div className={styles.qrContainer}>
          <div className={styles.qrWhiteBox}>
            <img
              src={qrImageUrl}
              alt={`QR Code for room ${roomCode}`}
              width={180}
              height={180}
              className={styles.qrImage}
            />
          </div>
          <div className={styles.scanInstruction}>
            <Smartphone size={14} />
            <span>Scan with your phone&apos;s camera to join instantly</span>
          </div>
        </div>

        {/* Room Details & Actions */}
        <div className={styles.roomDetailsCard}>
          <div className={styles.codeRow}>
            <span className={styles.codeLabel}>Room Code:</span>
            <span className={styles.codeBadge}>{roomCode}</span>
            <button
              type="button"
              className={styles.btnSmallCopy}
              onClick={handleCopyCode}
              title="Copy Code"
            >
              {copiedCode ? <Check size={13} style={{ color: "#34d399" }} /> : <Copy size={13} />}
            </button>
          </div>

          <button
            type="button"
            className={styles.btnCopyFullLink}
            onClick={handleCopyLink}
          >
            {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copiedLink ? "Meeting Link Copied!" : "Copy Full Invitation Link"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
