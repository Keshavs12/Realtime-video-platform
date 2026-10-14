import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { User } from "../types";
import { Colors } from "../theme/colors";

export interface WebRTCStageWebViewRef {
  toggleAudio: (muted: boolean) => void;
  toggleVideo: (muted: boolean) => void;
  flipCamera: () => void;
}

interface WebRTCStageWebViewProps {
  roomCode: string;
  user: User | null;
  token: string | null;
  serverUrl: string;
  isVideoMuted: boolean;
  isAudioMuted: boolean;
  onParticipantCountChange?: (count: number) => void;
  onConnectionStatus?: (status: string) => void;
}

export const WebRTCStageWebView = forwardRef<WebRTCStageWebViewRef, WebRTCStageWebViewProps>(
  (
    {
      roomCode,
      user,
      token,
      serverUrl,
      isVideoMuted,
      isAudioMuted,
      onParticipantCountChange,
      onConnectionStatus,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Imperative handles so parent RoomScreen can trigger camera flip, audio/video toggles
    useImperativeHandle(ref, () => ({
      toggleAudio: (muted: boolean) => {
        webViewRef.current?.injectJavaScript(`
          if (typeof window.setAudioMuted === 'function') {
            window.setAudioMuted(${muted});
          }
          true;
        `);
      },
      toggleVideo: (muted: boolean) => {
        webViewRef.current?.injectJavaScript(`
          if (typeof window.setVideoMuted === 'function') {
            window.setVideoMuted(${muted});
          }
          true;
        `);
      },
      flipCamera: () => {
        webViewRef.current?.injectJavaScript(`
          if (typeof window.flipCameraFacing === 'function') {
            window.flipCameraFacing();
          }
          true;
        `);
      },
    }));

    // Sync audio/video mute props to WebView
    useEffect(() => {
      webViewRef.current?.injectJavaScript(`
        if (typeof window.setAudioMuted === 'function') {
          window.setAudioMuted(${isAudioMuted});
        }
        true;
      `);
    }, [isAudioMuted]);

    useEffect(() => {
      webViewRef.current?.injectJavaScript(`
        if (typeof window.setVideoMuted === 'function') {
          window.setVideoMuted(${isVideoMuted});
        }
        true;
      `);
    }, [isVideoMuted]);

    // Handle incoming messages from WebView WebRTC bridge
    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "PEER_COUNT" && typeof onParticipantCountChange === "function") {
          onParticipantCountChange(data.count);
        } else if (data.type === "STATUS" && typeof onConnectionStatus === "function") {
          onConnectionStatus(data.status);
        } else if (data.type === "READY") {
          setIsLoading(false);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    const cleanRoomCode = (roomCode || "")
      .replace(/^https?:\/\/[^\/]+\/room\//i, "")
      .replace(/^https?:\/\/[^\/]+\//i, "")
      .replace(/^room[:\s\/-]*/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .trim()
      .toLowerCase();

    const userName = user?.name || "Mobile User";
    const userId = user?.id || `mobile-${Date.now().toString(36)}`;
    const socketEndpoint = serverUrl.replace(/\/api\/v1\/?$/, "");

    // Embedded HTML WebRTC implementation running inside Apple's WKWebView
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #070b13;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #stage {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      padding: 12px;
      align-content: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    .video-card {
      position: relative;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      max-height: 100%;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }
    .video-card.speaking {
      border-color: #6366f1;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #000;
    }
    video.mirrored {
      transform: scaleX(-1);
    }
    .name-badge {
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: rgba(15, 23, 42, 0.78);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 5px;
      z-index: 2;
    }
    .avatar-placeholder {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      background: radial-gradient(circle at center, #1e1b4b, #070b13);
      z-index: 1;
    }
    .avatar-circle {
      width: 72px;
      height: 72px;
      border-radius: 36px;
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }
    .cam-off-label {
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }
    .status-toast {
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(99, 102, 241, 0.35);
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 11px;
      color: #a5b4fc;
      z-index: 10;
      pointer-events: none;
      display: none;
    }
  </style>
</head>
<body>
  <div id="statusToast" class="statusToast">Connecting HD Call...</div>
  <div id="stage">
    <!-- Local Participant Card -->
    <div id="card-local" class="video-card">
      <video id="localVideo" autoplay playsinline muted class="mirrored"></video>
      <div id="avatar-local" class="avatar-placeholder">
        <div class="avatar-circle">${userName.slice(0, 1).toUpperCase()}</div>
        <div class="cam-off-label">Camera Off</div>
      </div>
      <div class="name-badge">
        <span>${userName} (You)</span>
      </div>
    </div>
  </div>

  <script>
    const ROOM_CODE = "${cleanRoomCode}";
    const USER_ID = "${userId}";
    const USER_NAME = "${userName}";
    const AUTH_TOKEN = "${token || ""}";
    const SOCKET_URL = "${socketEndpoint}";

    let localStream = null;
    let socket = null;
    let peerConnections = {};
    let remoteStreams = {};
    let iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ];
    let facingMode = "user";
    let isVideoOff = false;
    let isAudioOff = false;

    function notifyRN(type, data) {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }

    function showToast(text, duration = 3000) {
      const toast = document.getElementById("statusToast");
      if (toast) {
        toast.innerText = text;
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, duration);
      }
    }

    // Fetch Metered TURN relay credentials
    async function initIceServers() {
      try {
        const res = await fetch("https://callingbalouini.metered.live/api/v1/turn/credentials?apiKey=e00eb332c25503c6108f99e8c6149198c54f");
        if (res.ok) {
          const servers = await res.json();
          iceServers = [...iceServers, ...servers];
        }
      } catch (e) {
        console.warn("Metered TURN fetch fallback to Google STUN:", e);
      }
    }

    // Capture Local Camera & Microphone
    async function startLocalMedia() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        const localVideo = document.getElementById("localVideo");
        if (localVideo) {
          localVideo.srcObject = localStream;
        }
        notifyRN("READY", {});
      } catch (err) {
        console.error("Camera/Mic access error:", err);
        showToast("⚠️ Camera/Mic permission needed");
        notifyRN("STATUS", { status: "permission-denied" });
      }
    }

    // Create RTCPeerConnection for a remote peer
    function createPC(peerSocketId, peerName) {
      if (peerConnections[peerSocketId]) {
        return peerConnections[peerSocketId];
      }

      const pc = new RTCPeerConnection({ iceServers: iceServers });
      peerConnections[peerSocketId] = pc;

      // Add local audio and video tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("ice-candidate", {
            to: peerSocketId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        let stream = event.streams && event.streams[0] ? event.streams[0] : null;
        if (!stream && event.track) {
          stream = new MediaStream([event.track]);
        }
        if (stream) {
          remoteStreams[peerSocketId] = stream;
          renderRemoteVideo(peerSocketId, peerName, stream);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("Peer", peerSocketId, "state:", pc.connectionState);
      };

      return pc;
    }

    // Render remote peer card in grid
    function renderRemoteVideo(peerSocketId, peerName, stream) {
      const stage = document.getElementById("stage");
      let card = document.getElementById("card-" + peerSocketId);

      if (!card) {
        card = document.createElement("div");
        card.id = "card-" + peerSocketId;
        card.className = "video-card";

        const video = document.createElement("video");
        video.id = "video-" + peerSocketId;
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;

        const nameBadge = document.createElement("div");
        nameBadge.className = "name-badge";
        nameBadge.innerText = peerName || "Participant";

        card.appendChild(video);
        card.appendChild(nameBadge);
        stage.appendChild(card);
      } else {
        const video = card.querySelector("video");
        if (video) video.srcObject = stream;
      }

      updateParticipantCount();
    }

    function removeRemoteVideo(peerSocketId) {
      const card = document.getElementById("card-" + peerSocketId);
      if (card) card.remove();
      if (peerConnections[peerSocketId]) {
        try { peerConnections[peerSocketId].close(); } catch (e) {}
        delete peerConnections[peerSocketId];
      }
      delete remoteStreams[peerSocketId];
      updateParticipantCount();
    }

    function updateParticipantCount() {
      const count = Object.keys(peerConnections).length + 1;
      notifyRN("PEER_COUNT", { count });
    }

    // Connect to Socket.IO Signaling Server
    async function startSignaling() {
      await initIceServers();
      await startLocalMedia();

      socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        auth: AUTH_TOKEN ? { token: AUTH_TOKEN } : { guestName: USER_NAME },
        reconnection: true,
      });

      socket.on("connect", () => {
        showToast("Connected to Meeting");
        notifyRN("STATUS", { status: "connected" });

        socket.emit("join-room", {
          roomId: ROOM_CODE,
          name: USER_NAME,
          userId: USER_ID,
          isVideoMuted: isVideoOff,
          isAudioMuted: isAudioOff
        });
      });

      // Existing peers in the room -> initiate offer
      socket.on("room-users", async ({ users }) => {
        if (!users) return;
        for (const peer of users) {
          if (!peer.socketId) continue;
          const pc = createPC(peer.socketId, peer.name);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", {
              to: peer.socketId,
              offer: offer,
              name: USER_NAME,
              userId: USER_ID
            });
          } catch (e) {
            console.error("Offer creation error:", e);
          }
        }
        updateParticipantCount();
      });

      // New user joins
      socket.on("user-joined", (user) => {
        if (user && user.socketId) {
          createPC(user.socketId, user.name);
          updateParticipantCount();
        }
      });

      // Receive WebRTC offer
      socket.on("offer", async ({ from, offer, name }) => {
        const pc = createPC(from, name);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", {
            to: from,
            answer: answer,
            name: USER_NAME,
            userId: USER_ID
          });
        } catch (e) {
          console.error("Answer error:", e);
        }
      });

      // Receive WebRTC answer
      socket.on("answer", async ({ from, answer }) => {
        const pc = peerConnections[from];
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (e) {
            console.error("Remote desc error:", e);
          }
        }
      });

      // Receive ICE Candidate
      socket.on("ice-candidate", async ({ from, candidate }) => {
        const pc = peerConnections[from];
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("ICE error:", e);
          }
        }
      });

      // User Left
      socket.on("user-left", ({ socketId }) => {
        removeRemoteVideo(socketId);
      });
    }

    // Exposed controls for React Native bridge
    window.setAudioMuted = function(muted) {
      isAudioOff = muted;
      if (localStream) {
        localStream.getAudioTracks().forEach(t => { t.enabled = !muted; });
      }
    };

    window.setVideoMuted = function(muted) {
      isVideoOff = muted;
      const avatar = document.getElementById("avatar-local");
      const video = document.getElementById("localVideo");
      if (avatar) avatar.style.display = muted ? "flex" : "none";
      if (video) video.style.opacity = muted ? "0" : "1";
      if (localStream) {
        localStream.getVideoTracks().forEach(t => { t.enabled = !muted; });
      }
    };

    window.flipCameraFacing = async function() {
      facingMode = facingMode === "user" ? "environment" : "user";
      const localVideo = document.getElementById("localVideo");
      if (localVideo) {
        if (facingMode === "user") {
          localVideo.classList.add("mirrored");
        } else {
          localVideo.classList.remove("mirrored");
        }
      }

      if (localStream) {
        const oldTrack = localStream.getVideoTracks()[0];
        if (oldTrack) oldTrack.stop();
      }

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        const newTrack = newStream.getVideoTracks()[0];
        if (localStream && newTrack) {
          localStream.removeTrack(localStream.getVideoTracks()[0]);
          localStream.addTrack(newTrack);
          if (localVideo) localVideo.srcObject = localStream;

          // Replace track in peer connections
          Object.values(peerConnections).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
            if (sender) {
              sender.replaceTrack(newTrack);
            }
          });
        }
      } catch (e) {
        console.error("Flip camera error:", e);
      }
    };

    // Auto-launch signaling when DOM is ready
    window.addEventListener("DOMContentLoaded", startSignaling);
  </script>
</body>
</html>
    `;

    const RNWebView = WebView as any;

    return (
      <View style={styles.container}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Connecting to HD Video Stage...</Text>
          </View>
        )}
        <RNWebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{
            html: htmlContent,
            baseUrl: "https://realtime-video-platform.onrender.com",
          }}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleMessage}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070b13",
  },
  webview: {
    flex: 1,
    backgroundColor: "#070b13",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#070b13",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
  },
});
