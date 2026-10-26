"use client";

import React from "react";
import { Video } from "lucide-react";
import styles from "./AppLoadingSpinner.module.scss";

interface AppLoadingSpinnerProps {
  message?: string;
  subMessage?: string;
}

export const AppLoadingSpinner = ({
  message = "SuperCall",
  subMessage = "Loading secure workspace…",
}: AppLoadingSpinnerProps) => {
  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.spinnerCard}>
        {/* Dual Orbital High-Precision Gradient Rings */}
        <div className={styles.orbitalWrapper}>
          <div className={styles.outerRing} />
          <div className={styles.innerRing} />
          <div className={styles.coreEmblem}>
            <Video size={20} />
          </div>
        </div>

        {/* Brand & Loading Label */}
        <h2 className={styles.brandTitle}>{message}</h2>
        <p className={styles.statusText}>{subMessage}</p>

        {/* Ambient Sliding Indeterminate Track */}
        <div className={styles.progressBarTrack}>
          <div className={styles.progressBarFill} />
        </div>
      </div>
    </div>
  );
};

export default AppLoadingSpinner;
