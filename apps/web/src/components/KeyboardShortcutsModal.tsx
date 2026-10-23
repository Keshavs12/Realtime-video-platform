"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Keyboard,
  Mic,
  Video,
  Monitor,
  Subtitles,
  Search,
  Plus,
  Volume2,
  VolumeX,
} from "lucide-react";
import styles from "./KeyboardShortcutsModal.module.scss";
import { isSoundEnabled, setSoundEnabled, playPopChime } from "@/utils/audioChimes";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal = ({ isOpen, onClose }: KeyboardShortcutsModalProps) => {
  const [soundActive, setSoundActive] = useState(true);

  useEffect(() => {
    setSoundActive(isSoundEnabled());
  }, [isOpen]);

  const toggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
    if (next) playPopChime();
  };

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: "AUDIO & VIDEO",
      items: [
        { key: "M", desc: "Toggle Microphone Mute", icon: Mic },
        { key: "V", desc: "Toggle Camera On / Off", icon: Video },
        { key: "Space", desc: "Push-to-Talk (Hold while speaking)", icon: Mic },
      ],
    },
    {
      title: "COLLABORATION & STAGE",
      items: [
        { key: "D", desc: "Toggle Screen Sharing", icon: Monitor },
        { key: "C", desc: "Toggle Live Closed Captions (CC)", icon: Subtitles },
      ],
    },
    {
      title: "GLOBAL WORKSPACE",
      items: [
        { key: "⌘ K", desc: "Open Quick Search & Command Bar", icon: Search },
        { key: "⌘ N", desc: "Start Instant Meeting", icon: Plus },
        { key: "?", desc: "Toggle this Keyboard Shortcuts Guide", icon: Keyboard },
      ],
    },
  ];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <div className={styles.iconBadge}>
              <Keyboard size={18} />
            </div>
            <div>
              <h3>Keyboard Shortcuts</h3>
              <p>Work faster with pro keybindings across SuperCall</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close shortcuts">
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className={styles.shortcutsBody}>
          {shortcutGroups.map((group) => (
            <div key={group.title} className={styles.groupSection}>
              <div className={styles.groupTitle}>{group.title}</div>
              <div className={styles.itemsList}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className={styles.shortcutRow}>
                      <div className={styles.rowDesc}>
                        <Icon size={14} className={styles.itemIcon} />
                        <span>{item.desc}</span>
                      </div>
                      <kbd className={styles.keyBadge}>{item.key}</kbd>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer with Audio Chimes Toggle */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={`${styles.soundToggleBtn} ${soundActive ? styles.soundOn : styles.soundOff}`}
            onClick={toggleSound}
          >
            {soundActive ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>UI Sound Effects: {soundActive ? "Enabled" : "Muted"}</span>
          </button>

          <span className={styles.pressEscHint}>Press <strong>Esc</strong> to close</span>
        </div>
      </div>
    </div>
  );
};
