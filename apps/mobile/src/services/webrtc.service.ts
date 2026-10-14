import { NativeModules, View } from "react-native";
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

/**
 * Checks if react-native-webrtc native module is available in the current runtime.
 * (Returns true in Dev Client or Production APK/IPA; returns false in standard Expo Go).
 */
export const isWebRTCSupported = Boolean(NativeModules.WebRTCModule);

let RTCPeerConnection: any;
let RTCIceCandidate: any;
let RTCSessionDescription: any;
let RTCView: any = View;
let MediaStream: any;
let mediaDevices: any;

if (isWebRTCSupported) {
  try {
    const webrtc = require("react-native-webrtc");
    RTCPeerConnection = webrtc.RTCPeerConnection;
    RTCIceCandidate = webrtc.RTCIceCandidate;
    RTCSessionDescription = webrtc.RTCSessionDescription;
    RTCView = webrtc.RTCView;
    MediaStream = webrtc.MediaStream;
    mediaDevices = webrtc.mediaDevices;
  } catch (err) {
    console.warn("[WebRTC] Failed to load native WebRTC module:", err);
  }
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
  if (!isWebRTCSupported) {
    console.warn("[WebRTC] Native WebRTC module not detected (Running in standard Expo Go). Media streaming is mocked.");
    return null;
  }

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
    console.error("[WebRTC] Failed to get user media:", err);
    return null;
  }
};

/**
 * Toggles camera between front and back lens.
 */
export const switchCameraFacing = (stream: any): boolean => {
  if (!stream) return false;
  try {
    const videoTracks = stream.getVideoTracks();
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
