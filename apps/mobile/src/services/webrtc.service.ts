import React from "react";
import { NativeModules, View, Platform } from "react-native";
import type {
  RTCPeerConnection as IRTCPeerConnection,
  RTCIceCandidate as IRTCIceCandidate,
  RTCSessionDescription as IRTCSessionDescription,
  MediaStream as IMediaStream,
} from "react-native-webrtc";

export type RTCPeerConnection = IRTCPeerConnection;
export type RTCIceCandidate = IRTCIceCandidate;
export type RTCSessionDescription = IRTCSessionDescription;
export type MediaStream = IMediaStream;

// Check native WebRTC module or browser WebRTC (for iOS Safari web mode)
export const isNativeWebRTC = Boolean(NativeModules && NativeModules.WebRTCModule);
export const isBrowserWebRTC =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  Boolean((window as any).RTCPeerConnection || (typeof navigator !== "undefined" && navigator.mediaDevices));

export const isWebRTCSupported = isNativeWebRTC || isBrowserWebRTC;

class SafeSessionDescription {
  type: string;
  sdp: string;
  constructor(desc: any = {}) {
    this.type = desc?.type || "";
    this.sdp = desc?.sdp || "";
  }
  toJSON() {
    return { type: this.type, sdp: this.sdp };
  }
}

class SafeIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  constructor(cand: any = {}) {
    this.candidate = cand?.candidate || "";
    this.sdpMid = cand?.sdpMid ?? null;
    this.sdpMLineIndex = cand?.sdpMLineIndex ?? null;
  }
  toJSON() {
    return {
      candidate: this.candidate,
      sdpMid: this.sdpMid,
      sdpMLineIndex: this.sdpMLineIndex,
    };
  }
}

class SafeMediaStream {
  id: string;
  private _tracks: any[];
  constructor(tracks: any[] = []) {
    this.id = `stream-${Date.now().toString(36)}`;
    this._tracks = tracks;
  }
  getTracks() {
    return this._tracks;
  }
  getVideoTracks() {
    return this._tracks.filter((t: any) => t.kind === "video");
  }
  getAudioTracks() {
    return this._tracks.filter((t: any) => t.kind === "audio");
  }
  addTrack(track: any) {
    if (!this._tracks.includes(track)) {
      this._tracks.push(track);
    }
  }
  removeTrack(track: any) {
    this._tracks = this._tracks.filter((t: any) => t !== track);
  }
  toURL() {
    return "";
  }
}

let RTCPeerConnection: any;
let RTCIceCandidate: any = SafeIceCandidate;
let RTCSessionDescription: any = SafeSessionDescription;
let RTCView: any = View;
let MediaStream: any = SafeMediaStream;
let mediaDevices: any;

if (isNativeWebRTC) {
  try {
    const webrtc = require("react-native-webrtc");
    RTCPeerConnection = webrtc.RTCPeerConnection;
    RTCIceCandidate = webrtc.RTCIceCandidate || SafeIceCandidate;
    RTCSessionDescription = webrtc.RTCSessionDescription || SafeSessionDescription;
    RTCView = webrtc.RTCView || View;
    MediaStream = webrtc.MediaStream || SafeMediaStream;
    mediaDevices = webrtc.mediaDevices;
  } catch (err) {
    console.warn("[WebRTC] Failed to load native WebRTC module:", err);
  }
} else if (isBrowserWebRTC) {
  RTCPeerConnection = (window as any).RTCPeerConnection;
  RTCIceCandidate = (window as any).RTCIceCandidate || SafeIceCandidate;
  RTCSessionDescription = (window as any).RTCSessionDescription || SafeSessionDescription;
  MediaStream = (window as any).MediaStream || SafeMediaStream;
  mediaDevices = navigator.mediaDevices;

  // Universal RTCView component for web/mobile Safari
  RTCView = (props: any) => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    React.useEffect(() => {
      if (videoRef.current && props.stream) {
        videoRef.current.srcObject = props.stream;
      }
    }, [props.stream]);

    return React.createElement(
      View,
      { style: props.style },
      React.createElement("video", {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: Boolean(props.mirror),
        style: {
          width: "100%",
          height: "100%",
          objectFit: props.objectFit || "cover",
          transform: props.mirror ? "scaleX(-1)" : "none",
          backgroundColor: "#000",
        },
      })
    );
  };
}

// Metered.ca TURN Relay Credentials
const METERED_DOMAIN = "callingbalouini.metered.live";
const METERED_API_KEY = "e00eb332c25503c6108f99e8c6149198c54f";

export const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

/**
 * Fetches short-lived TURN credentials from Metered.ca for reliable cross-network P2P connections.
 */
export const fetchIceServers = async (): Promise<any[]> => {
  try {
    const res = await fetch(
      `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    if (!res.ok) throw new Error(`Metered request returned status: ${res.status}`);
    const turnServers = await res.json();
    return [...FALLBACK_ICE_SERVERS, ...turnServers];
  } catch (err) {
    console.warn("[WebRTC] Metered TURN fetch failed, falling back to Google STUN servers:", err);
    return FALLBACK_ICE_SERVERS;
  }
};

/**
 * Requests local audio and camera media stream.
 */
export const getLocalMediaStream = async (video = true, audio = true): Promise<any | null> => {
  if (isBrowserWebRTC && typeof navigator !== "undefined" && navigator.mediaDevices) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: video
          ? {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            }
          : false,
      });
      return stream;
    } catch (err) {
      console.warn("[WebRTC Browser] getUserMedia error:", err);
      return null;
    }
  }

  if (isNativeWebRTC && mediaDevices) {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio,
        video: video
          ? {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            }
          : false,
      });
      return stream;
    } catch (err) {
      console.error("[WebRTC Native] Failed to get user media:", err);
      return null;
    }
  }

  console.warn(
    "[WebRTC] Native WebRTC drivers not present in Expo Go sandbox. Session connected via real-time signaling."
  );
  return null;
};

/**
 * Toggles camera between front and back lens.
 */
export const switchCameraFacing = (stream: any): boolean => {
  if (!stream) return false;
  try {
    const videoTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
    if (videoTracks.length > 0 && typeof videoTracks[0]._switchCamera === "function") {
      videoTracks[0]._switchCamera();
      return true;
    }
  } catch (err) {
    console.error("[WebRTC] Error switching camera:", err);
  }
  return false;
};

export {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
};
