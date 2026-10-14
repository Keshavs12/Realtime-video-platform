import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { User } from "../types";
import { Colors } from "../theme/colors";

export interface WebRTCStageWebViewRef {
  sendSignalingEvent: (event: any) => void;
  toggleAudio: (muted: boolean) => void;
  toggleVideo: (muted: boolean) => void;
  flipCamera: () => void;
}

interface WebRTCStageWebViewProps {
  roomCode: string;
  user: User | null;
  isVideoMuted: boolean;
  isAudioMuted: boolean;
  iceServers: any[];
  onOfferCreated?: (to: string, offer: any) => void;
  onAnswerCreated?: (to: string, answer: any) => void;
  onIceCandidateGenerated?: (to: string, candidate: any) => void;
  onParticipantCountChange?: (count: number) => void;
  onRemoteStreamReceived?: (peerSocketId: string) => void;
  onLocalStreamReady?: () => void;
}

export const WebRTCStageWebView = forwardRef<WebRTCStageWebViewRef, WebRTCStageWebViewProps>(
  (
    {
      roomCode,
      user,
      isVideoMuted,
      isAudioMuted,
      iceServers,
      onOfferCreated,
      onAnswerCreated,
      onIceCandidateGenerated,
      onParticipantCountChange,
      onRemoteStreamReceived,
      onLocalStreamReady,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const safeRoomCode = (roomCode || "").trim().toLowerCase();
    const userName = user?.name || "Mobile User";
    const initialLetter = (userName[0] || "U").toUpperCase();

    // Helper to send message into WebView
    const injectMessage = (data: any) => {
      const json = JSON.stringify(data);
      webViewRef.current?.injectJavaScript(`
        if (typeof window.handleRNMessage === 'function') {
          window.handleRNMessage(${json});
        }
        true;
      `);
    };

    // Imperative methods exposed to RoomScreen
    useImperativeHandle(ref, () => ({
      sendSignalingEvent: (event: any) => {
        injectMessage(event);
      },
      toggleAudio: (muted: boolean) => {
        injectMessage({ type: "TOGGLE_AUDIO", muted });
      },
      toggleVideo: (muted: boolean) => {
        injectMessage({ type: "TOGGLE_VIDEO", muted });
      },
      flipCamera: () => {
        injectMessage({ type: "FLIP_CAMERA" });
      },
    }));

    // Pass ICE servers when available
    useEffect(() => {
      if (iceServers && iceServers.length > 0) {
        injectMessage({ type: "SET_ICE_SERVERS", iceServers });
      }
    }, [iceServers]);

    // Handle incoming events from the WebRTC WebView engine
    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        switch (data.type) {
          case "READY":
          case "LOCAL_STREAM_READY":
            setIsLoading(false);
            onLocalStreamReady?.();
            break;

          case "OFFER_CREATED":
            onOfferCreated?.(data.to, data.offer);
            break;

          case "ANSWER_CREATED":
            onAnswerCreated?.(data.to, data.answer);
            break;

          case "ICE_CANDIDATE_GENERATED":
            onIceCandidateGenerated?.(data.to, data.candidate);
            break;

          case "PEER_COUNT":
            onParticipantCountChange?.(data.count);
            break;

          case "REMOTE_STREAM_RECEIVED":
            onRemoteStreamReceived?.(data.peerSocketId);
            break;

          default:
            break;
        }
      } catch {
        // Ignore unparseable messages
      }
    };

    // Embedded HTML with Apple WKWebView Hardware WebRTC Engine
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
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
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
      transition: border-color 0.2s, box-shadow 0.2s;
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
      width: 68px;
      height: 68px;
      border-radius: 34px;
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
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
  </style>
</head>
<body>
  <div id="stage">
    <!-- Local Participant Card -->
    <div id="card-local" class="video-card">
      <video id="localVideo" autoplay playsinline muted class="mirrored"></video>
      <div id="avatar-local" class="avatar-placeholder">
        <div class="avatar-circle">${initialLetter}</div>
        <div class="cam-off-label">Camera Off</div>
      </div>
      <div class="name-badge">
        <span>${userName} (You)</span>
      </div>
    </div>
  </div>

  <script>
    let localStream = null;
    let peerConnections = {};
    let remoteStreams = {};
    let iceQueues = {};
    let iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ];
    let facingMode = "user";
    let isVideoMuted = ${Boolean(isVideoMuted)};
    let isAudioMuted = ${Boolean(isAudioMuted)};

    function postToRN(data) {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    // Flush any queued ICE candidates once remote description is set
    async function flushIceQueue(socketId) {
      const pc = peerConnections[socketId];
      const queue = iceQueues[socketId] || [];
      if (pc && pc.remoteDescription && queue.length > 0) {
        for (const cand of queue) {
          try {
            await pc.addIceCandidate(cand);
          } catch (e) {
            console.warn("Error applying queued ICE:", e);
          }
        }
        iceQueues[socketId] = [];
      }
    }

    // Capture Local Camera & Microphone
    async function initLocalStream() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        const localVideo = document.getElementById("localVideo");
        if (localVideo) {
          localVideo.srcObject = localStream;
          localVideo.play().catch(() => {});
        }

        // Apply initial mute states
        if (isAudioMuted) {
          localStream.getAudioTracks().forEach(t => { t.enabled = false; });
        }
        if (isVideoMuted) {
          localStream.getVideoTracks().forEach(t => { t.enabled = false; });
          const av = document.getElementById("avatar-local");
          if (av) av.style.display = "flex";
        }

        postToRN({ type: "LOCAL_STREAM_READY" });
      } catch (err) {
        console.error("Local media error:", err);
        postToRN({ type: "MEDIA_ERROR", error: err.message });
      }
    }

    // Get or Create RTCPeerConnection for a remote peer
    function getOrCreatePC(peerSocketId, peerName) {
      if (peerConnections[peerSocketId]) {
        return peerConnections[peerSocketId];
      }

      const pc = new RTCPeerConnection({ iceServers: iceServers });
      peerConnections[peerSocketId] = pc;
      iceQueues[peerSocketId] = [];

      // Add local tracks to the connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          postToRN({
            type: "ICE_CANDIDATE_GENERATED",
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
          postToRN({ type: "REMOTE_STREAM_RECEIVED", peerSocketId });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          removeRemoteVideo(peerSocketId);
        }
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
        video.play().catch(() => {});
      } else {
        const video = card.querySelector("video");
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
      }

      updatePeerCount();
    }

    function removeRemoteVideo(peerSocketId) {
      const card = document.getElementById("card-" + peerSocketId);
      if (card) card.remove();
      if (peerConnections[peerSocketId]) {
        try { peerConnections[peerSocketId].close(); } catch (e) {}
        delete peerConnections[peerSocketId];
      }
      delete remoteStreams[peerSocketId];
      delete iceQueues[peerSocketId];
      updatePeerCount();
    }

    function updatePeerCount() {
      const count = Object.keys(peerConnections).length + 1;
      postToRN({ type: "PEER_COUNT", count });
    }

    // Handle messages sent from React Native
    window.handleRNMessage = async function(msg) {
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case "SET_ICE_SERVERS":
          if (msg.iceServers && Array.isArray(msg.iceServers)) {
            iceServers = msg.iceServers;
          }
          break;

        case "INITIATE_PEER": {
          if (msg.iceServers) iceServers = msg.iceServers;
          const pc = getOrCreatePC(msg.peerSocketId, msg.peerName);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            postToRN({
              type: "OFFER_CREATED",
              to: msg.peerSocketId,
              offer: offer
            });
          } catch (e) {
            console.error("Error creating offer:", e);
          }
          break;
        }

        case "HANDLE_OFFER": {
          if (msg.iceServers) iceServers = msg.iceServers;
          const pc = getOrCreatePC(msg.from, msg.name);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            await flushIceQueue(msg.from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            postToRN({
              type: "ANSWER_CREATED",
              to: msg.from,
              answer: answer
            });
          } catch (e) {
            console.error("Error handling offer:", e);
          }
          break;
        }

        case "HANDLE_ANSWER": {
          const pc = peerConnections[msg.from];
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
              await flushIceQueue(msg.from);
            } catch (e) {
              console.error("Error handling answer:", e);
            }
          }
          break;
        }

        case "HANDLE_ICE_CANDIDATE": {
          const pc = peerConnections[msg.from];
          const cand = new RTCIceCandidate(msg.candidate);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(cand);
            } catch (e) {
              console.warn("Direct ICE error:", e);
            }
          } else {
            if (!iceQueues[msg.from]) iceQueues[msg.from] = [];
            iceQueues[msg.from].push(cand);
          }
          break;
        }

        case "USER_LEFT":
          removeRemoteVideo(msg.socketId);
          break;

        case "TOGGLE_AUDIO":
          isAudioMuted = Boolean(msg.muted);
          if (localStream) {
            localStream.getAudioTracks().forEach(t => { t.enabled = !isAudioMuted; });
          }
          break;

        case "TOGGLE_VIDEO": {
          isVideoMuted = Boolean(msg.muted);
          const av = document.getElementById("avatar-local");
          const v = document.getElementById("localVideo");
          if (av) av.style.display = isVideoMuted ? "flex" : "none";
          if (v) v.style.opacity = isVideoMuted ? "0" : "1";
          if (localStream) {
            localStream.getVideoTracks().forEach(t => { t.enabled = !isVideoMuted; });
          }
          break;
        }

        case "FLIP_CAMERA": {
          facingMode = facingMode === "user" ? "environment" : "user";
          const v = document.getElementById("localVideo");
          if (v) {
            if (facingMode === "user") {
              v.classList.add("mirrored");
            } else {
              v.classList.remove("mirrored");
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
              if (v) {
                v.srcObject = localStream;
                v.play().catch(() => {});
              }

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
          break;
        }

        default:
          break;
      }
    };

    // Self-executing setup without waiting for DOMContentLoaded (safe for inline HTML)
    initLocalStream();
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
            <Text style={styles.loadingText}>Initializing Camera & Audio...</Text>
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

WebRTCStageWebView.displayName = "WebRTCStageWebView";

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
