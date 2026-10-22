import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { User } from "../types";
import { Colors } from "../theme/colors";

export interface WebRTCStageWebViewRef {
  sendSignalingEvent: (event: any) => void;
  toggleAudio: (muted: boolean) => void;
  toggleVideo: (muted: boolean) => void;
  flipCamera: () => void;
  setHandRaise?: (peerSocketId: string, isRaised: boolean) => void;
  setLayoutMode?: (mode: "grid" | "spotlight") => void;
  pinParticipant?: (socketId: string) => void;
  startScreenShare?: () => void;
  stopScreenShare?: () => void;
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
  onScreenShareStateChange?: (isSharing: boolean) => void;
  onScreenShareError?: (message: string) => void;
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
      onScreenShareStateChange,
      onScreenShareError,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const pendingQueueRef = useRef<any[]>([]);
    const webViewReadyRef = useRef(false);

    const safeRoomCode = (roomCode || "").trim().toLowerCase();
    const userName = (user?.name || "Mobile User").replace(/'/g, "\\'");
    const initialLetter = ((user?.name || "M")[0] || "M").toUpperCase();

    // Safety timeout: ensure "Connecting HD Call…" never hangs forever
    useEffect(() => {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 3500);
      return () => clearTimeout(timer);
    }, []);

    // Helper: inject a message into the WebView JS bridge
    const injectMessage = useCallback((data: any) => {
      if (!webViewReadyRef.current) {
        pendingQueueRef.current.push(data);
        return;
      }
      const json = JSON.stringify(data);
      webViewRef.current?.injectJavaScript(
        `try{if(typeof window.handleRNMessage==='function'){window.handleRNMessage(${json});}}catch(e){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'WEBVIEW_ERROR',message:e.message}));}}true;`
      );
    }, []);

    // Flush queued messages after WebView JS signals readiness
    const flushPendingQueue = useCallback(() => {
      const queue = pendingQueueRef.current.splice(0);
      for (const data of queue) {
        const json = JSON.stringify(data);
        webViewRef.current?.injectJavaScript(
          `try{if(typeof window.handleRNMessage==='function'){window.handleRNMessage(${json});}}catch(e){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'WEBVIEW_ERROR',message:e.message}));}}true;`
        );
      }
    }, []);

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
      setHandRaise: (peerSocketId: string, isRaised: boolean) => {
        injectMessage({ type: "SET_HAND_RAISE", peerSocketId, isRaised });
      },
      setLayoutMode: (mode: "grid" | "spotlight") => {
        injectMessage({ type: "SET_LAYOUT_MODE", mode });
      },
      pinParticipant: (socketId: string) => {
        injectMessage({ type: "PIN_PARTICIPANT", socketId });
      },
      startScreenShare: () => {
        injectMessage({ type: "START_SCREEN_SHARE" });
      },
      stopScreenShare: () => {
        injectMessage({ type: "STOP_SCREEN_SHARE" });
      },
    }));

    // Forward ICE servers whenever updated
    useEffect(() => {
      if (iceServers && iceServers.length > 0) {
        injectMessage({ type: "SET_ICE_SERVERS", iceServers });
      }
    }, [iceServers, injectMessage]);

    // Handle messages posted from inside the WebView
    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        switch (data.type) {
          case "READY":
            webViewReadyRef.current = true;
            flushPendingQueue();
            break;
          case "LOCAL_STREAM_READY":
            setIsLoading(false);
            onLocalStreamReady?.();
            flushPendingQueue();
            break;
          case "MEDIA_ERROR":
            setIsLoading(false);
            onLocalStreamReady?.();
            flushPendingQueue();
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
            if (typeof data.count === "number") {
              onParticipantCountChange?.(data.count);
            }
            break;
          case "REMOTE_STREAM_RECEIVED":
            onRemoteStreamReceived?.(data.peerSocketId);
            break;
          case "SCREEN_SHARE_STATE":
            onScreenShareStateChange?.(Boolean(data.isSharing));
            break;
          case "SCREEN_SHARE_ERROR":
            onScreenShareError?.(data.message || "Screen sharing failed");
            break;
          case "WEBVIEW_ERROR":
            console.warn("[WKWebView Stage Error]:", data.message);
            break;
          default:
            break;
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    // ─── Embedded WKWebView HTML/JS ────────────────────────────────────────────
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#070b13;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;width:100vw;height:100vh;display:flex;flex-direction:column}
    #stage{flex:1;display:grid;grid-template-columns:1fr;gap:12px;padding:12px;width:100%;height:100%;align-content:stretch;justify-content:stretch}
    .video-card{position:relative;background:#0f172a;border:1.5px solid rgba(255,255,255,0.14);border-radius:20px;overflow:hidden;display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;box-shadow:0 8px 30px rgba(0,0,0,0.5);transition:border-color .2s,box-shadow .2s}
    .video-card.speaking{border-color:#6366f1;box-shadow:0 0 20px rgba(99,102,241,0.6)}
    video{width:100%;height:100%;object-fit:cover;background:#000;display:block}
    video.mirrored{transform:scaleX(-1)}
    .name-badge{position:absolute;bottom:12px;left:12px;background:rgba(15,23,42,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:5px 12px;border-radius:12px;font-size:12px;font-weight:600;color:#f8fafc;border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;gap:6px;z-index:4;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
    .name-badge .dot{width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981}
    .avatar-placeholder{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(circle at center,#1e1b4b,#070b13);z-index:2}
    .avatar-circle{width:76px;height:76px;border-radius:38px;background:linear-gradient(135deg,#6366f1,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;margin-bottom:8px;box-shadow:0 0 24px rgba(99,102,241,0.45)}
    .cam-off-label{font-size:11px;color:#94a3b8;letter-spacing:.5px}
  </style>
</head>
<body>
  <div id="stage">
    <div id="card-local" class="video-card">
      <video id="localVideo" autoplay playsinline webkit-playsinline muted class="mirrored"></video>
      <div id="avatar-local" class="avatar-placeholder">
        <div class="avatar-circle">${initialLetter}</div>
        <div class="cam-off-label">Camera Off</div>
      </div>
      <div class="name-badge"><div class="dot"></div><span>${userName} (You)</span></div>
    </div>
  </div>

  <script>
    var localStream = null;
    var peerConnections = {};
    var remoteStreams = {};
    var iceQueues = {};
    var signalingQueue = [];
    var localStreamReady = false;

    // Default STUN and robust Metered TURN relays for reliable multi-network P2P connections
    var iceServers = [
      {urls:"stun:stun.l.google.com:19302"},
      {urls:"stun:stun1.l.google.com:19302"},
      {urls:"stun:stun.relay.metered.ca:80"},
      {urls:"turn:global.relay.metered.ca:80",username:"74874f47825c9fc59ca67c83",credential:"wZBB3lp6RrROlR+k"},
      {urls:"turn:global.relay.metered.ca:80?transport=tcp",username:"74874f47825c9fc59ca67c83",credential:"wZBB3lp6RrROlR+k"},
      {urls:"turn:global.relay.metered.ca:443",username:"74874f47825c9fc59ca67c83",credential:"wZBB3lp6RrROlR+k"},
      {urls:"turns:global.relay.metered.ca:443?transport=tcp",username:"74874f47825c9fc59ca67c83",credential:"wZBB3lp6RrROlR+k"}
    ];

    var facingMode = "user";
    var isVideoMuted = ${Boolean(isVideoMuted)};
    var isAudioMuted = ${Boolean(isAudioMuted)};
    var cameraVideoTrack = null;
    var isScreenSharing = false;

    function postToRN(data) {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function updateLayout() {
      var stage = document.getElementById("stage");
      if (!stage) return;
      var cards = stage.querySelectorAll(".video-card");
      var count = cards.length;
      var isLandscape = window.innerWidth > window.innerHeight;

      if (count <= 1) {
        stage.style.gridTemplateColumns = "1fr";
        stage.style.gridTemplateRows = "1fr";
      } else if (count === 2) {
        if (isLandscape) {
          stage.style.gridTemplateColumns = "1fr 1fr";
          stage.style.gridTemplateRows = "1fr";
        } else {
          stage.style.gridTemplateColumns = "1fr";
          stage.style.gridTemplateRows = "1fr 1fr";
        }
      } else {
        stage.style.gridTemplateColumns = "1fr 1fr";
        stage.style.gridTemplateRows = count > 4 ? "repeat(auto-fit, minmax(180px, 1fr))" : "1fr 1fr";
      }
      postToRN({type:"PEER_COUNT",count:count});
    }
    window.addEventListener("resize", updateLayout);

    async function flushIceQueue(socketId) {
      var pc = peerConnections[socketId];
      var queue = iceQueues[socketId] || [];
      if (pc && pc.remoteDescription && queue.length > 0) {
        for (var i = 0; i < queue.length; i++) {
          try { await pc.addIceCandidate(queue[i]); } catch(e) { console.warn("Queued ICE err:",e); }
        }
        iceQueues[socketId] = [];
      }
    }

    async function flushSignalingQueue() {
      var queue = signalingQueue.splice(0);
      for (var i = 0; i < queue.length; i++) {
        try { await handleRNMessage(queue[i]); } catch(e) { console.error("Signaling queue err:", e); }
      }
    }

    // High-performance canvas fallback stream with animated user avatar
    function createFallbackCanvasStream(initial, name, micAudioTrack) {
      var canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      var ctx = canvas.getContext("2d");
      var angle = 0;

      function renderFrame() {
        if (!ctx) return;
        ctx.fillStyle = "#070b13";
        ctx.fillRect(0, 0, 640, 480);

        // Ambient background glow
        var radGrad = ctx.createRadialGradient(320, 220, 10, 320, 220, 240);
        radGrad.addColorStop(0, "rgba(99, 102, 241, 0.28)");
        radGrad.addColorStop(1, "rgba(7, 11, 19, 0)");
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, 640, 480);

        // Center Avatar Circle
        var grad = ctx.createLinearGradient(240, 140, 400, 300);
        grad.addColorStop(0, "#6366f1");
        grad.addColorStop(1, "#3b82f6");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(320, 220, 75, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 64px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initial || "U", 320, 224);

        ctx.font = "600 20px -apple-system, sans-serif";
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(name || "Mobile User", 320, 340);

        ctx.font = "500 13px -apple-system, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Camera Off • Audio Active", 320, 370);
      }
      renderFrame();

      var stream = canvas.captureStream ? canvas.captureStream(15) : null;
      if (!stream) {
        stream = new MediaStream();
      }

      // Add real microphone audio track if available, else create silent audio track
      if (micAudioTrack) {
        stream.addTrack(micAudioTrack);
      } else {
        try {
          var AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            var audioCtx = new AudioCtx();
            var osc = audioCtx.createOscillator();
            var dst = audioCtx.createMediaStreamDestination();
            var gain = audioCtx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(dst);
            osc.start();
            var silentTrack = dst.stream.getAudioTracks()[0];
            if (silentTrack) stream.addTrack(silentTrack);
          }
        } catch(e) {}
      }
      return stream;
    }

    // Robust multi-tier getUserMedia with timeout guarantee
    async function initLocalStream() {
      var acquired = null;
      var micTrack = null;

      var acquireWithTimeout = new Promise(async function(resolve) {
        var timer = setTimeout(function() {
          console.warn("[Media] getUserMedia timed out after 15000ms, falling back gracefully");
          resolve(null);
        }, 15000);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          clearTimeout(timer);
          resolve(null);
          return;
        }

        // Tier 1: User-facing video + clean audio
        try {
          var s1 = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true
          });
          clearTimeout(timer);
          resolve(s1);
          return;
        } catch (e1) {
          console.warn("Tier 1 getUserMedia rejected:", e1?.name || e1);
        }

        // Tier 2: Generic video + audio
        try {
          var s2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          clearTimeout(timer);
          resolve(s2);
          return;
        } catch (e2) {
          console.warn("Tier 2 getUserMedia rejected:", e2?.name || e2);
        }

        // Tier 3: Audio only
        try {
          var s3 = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          clearTimeout(timer);
          resolve(s3);
          return;
        } catch (e3) {
          console.warn("Tier 3 audio-only rejected:", e3?.name || e3);
        }

        clearTimeout(timer);
        resolve(null);
      });

      acquired = await acquireWithTimeout;

      if (acquired && acquired.getVideoTracks().length > 0) {
        localStream = acquired;
      } else {
        if (acquired && acquired.getAudioTracks().length > 0) {
          micTrack = acquired.getAudioTracks()[0];
        }
        localStream = createFallbackCanvasStream("${initialLetter}", "${userName}", micTrack);
      }

      var lv = document.getElementById("localVideo");
      if (lv) {
        lv.srcObject = localStream;
        lv.play().catch(function(){});
      }

      if (localStream) {
        localStream.getAudioTracks().forEach(function(t) { t.enabled = !isAudioMuted; });
      }
      if (isVideoMuted && localStream) {
        localStream.getVideoTracks().forEach(function(t) { t.enabled = false; });
        var av = document.getElementById("avatar-local");
        if (av) av.style.display = "flex";
      }

      localStreamReady = true;
      // Attach local tracks to any already-created peer connections
      if (localStream) {
        Object.keys(peerConnections).forEach(function(pId) {
          var pc = peerConnections[pId];
          if (pc && pc.getSenders) {
            var senders = pc.getSenders();
            localStream.getTracks().forEach(function(track) {
              var exists = senders.some(function(s) { return s.track && s.track.id === track.id; });
              if (!exists) {
                try { pc.addTrack(track, localStream); } catch(e) {}
              }
            });
          }
        });
      }
      postToRN({type: "LOCAL_STREAM_READY"});
      await flushSignalingQueue();
      updateLayout();
    }

    function getOrCreatePC(peerSocketId, peerName) {
      if (peerConnections[peerSocketId]) return peerConnections[peerSocketId];
      var pc = new RTCPeerConnection({ iceServers: iceServers });
      peerConnections[peerSocketId] = pc;
      iceQueues[peerSocketId] = [];

      if (localStream) {
        localStream.getTracks().forEach(function(t) {
          try { pc.addTrack(t, localStream); } catch(e) {}
        });
      }

      pc.onicecandidate = function(e) {
        if (e.candidate) {
          postToRN({ type: "ICE_CANDIDATE_GENERATED", to: peerSocketId, candidate: e.candidate });
        }
      };

      pc.ontrack = function(e) {
        var stream = (e.streams && e.streams[0]) ? e.streams[0] : null;
        if (!stream) {
          if (!remoteStreams[peerSocketId]) {
            remoteStreams[peerSocketId] = new MediaStream();
          }
          if (e.track) remoteStreams[peerSocketId].addTrack(e.track);
          stream = remoteStreams[peerSocketId];
        } else {
          remoteStreams[peerSocketId] = stream;
        }

        renderRemoteVideo(peerSocketId, peerName, stream);
        postToRN({ type: "REMOTE_STREAM_RECEIVED", peerSocketId: peerSocketId });
      };

      pc.onconnectionstatechange = function() {
        if (pc.connectionState === 'closed') {
          removeRemoteVideo(peerSocketId);
        }
      };

      return pc;
    }

    function renderRemoteVideo(peerSocketId, peerName, stream) {
      var stage = document.getElementById("stage");
      var card = document.getElementById("card-" + peerSocketId);

      // 1. Dedicated audio element to guarantee mobile WebKit routes audio to speaker/earpiece
      var audio = document.getElementById("audio-" + peerSocketId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = "audio-" + peerSocketId;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.setAttribute("playsinline", "");
        audio.setAttribute("webkit-playsinline", "");
        document.body.appendChild(audio);
      }
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
      audio.play().catch(function(err) {
        console.log("Audio auto-play pending touch unlock:", err);
      });

      // 2. Video element (strictly unmuted for remote participants)
      if (!card) {
        card = document.createElement("div");
        card.id = "card-" + peerSocketId;
        card.className = "video-card";

        var video = document.createElement("video");
        video.id = "video-" + peerSocketId;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        video.srcObject = stream;

        var avatar = document.createElement("div");
        avatar.id = "avatar-" + peerSocketId;
        avatar.className = "avatar-placeholder";
        var letter = (peerName || "P")[0].toUpperCase();
        avatar.innerHTML = '<div class="avatar-circle">' + letter + '</div><div class="cam-off-label">Camera Off</div>';

        var badge = document.createElement("div");
        badge.className = "name-badge";
        badge.innerHTML = '<div class="dot"></div><span>' + (peerName || "Participant") + '</span>';

        card.appendChild(video);
        card.appendChild(avatar);
        card.appendChild(badge);
        stage.appendChild(card);

        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function(err) {
            console.log("Remote video play pending user touch:", err);
          });
        }
      } else {
        var video = card.querySelector("video");
        if (video) {
          if (video.srcObject !== stream) {
            video.srcObject = stream;
          }
          var p = video.play();
          if (p && typeof p.catch === "function") {
            p.catch(function() {});
          }
        }
      }

      // 3. Play immediately whenever incoming media tracks unmute
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(function(track) {
          track.onunmute = function() {
            var v = document.getElementById("video-" + peerSocketId);
            var a = document.getElementById("audio-" + peerSocketId);
            if (v && v.paused) v.play().catch(function(){});
            if (a && a.paused) a.play().catch(function(){});
          };
        });
      }

      updateLayout();
    }

    // Touch/click audio unlocker for mobile WebKit
    function unlockAllAudio() {
      document.querySelectorAll("audio").forEach(function(a) {
        if (a.paused) a.play().catch(function(){});
      });
      document.querySelectorAll("video").forEach(function(v) {
        if (v.id !== "localVideo" && v.paused) {
          v.play().catch(function(){});
        }
      });
    }
    document.addEventListener("touchstart", unlockAllAudio, { passive: true });
    document.addEventListener("click", unlockAllAudio, { passive: true });

    function removeRemoteVideo(peerSocketId) {
      var card = document.getElementById("card-" + peerSocketId);
      if (card) card.remove();

      var audio = document.getElementById("audio-" + peerSocketId);
      if (audio) {
        audio.srcObject = null;
        try { audio.remove(); } catch(e){}
      }

      if (peerConnections[peerSocketId]) {
        try { peerConnections[peerSocketId].close(); } catch(e) {}
        delete peerConnections[peerSocketId];
      }
      delete remoteStreams[peerSocketId];
      delete iceQueues[peerSocketId];
      updateLayout();
    }

    window.handleRNMessage = async function(msg) {
      if (!msg || !msg.type) return;

      // Signaling that requires local tracks waits for stream init
      if ((msg.type === "INITIATE_PEER" || msg.type === "HANDLE_OFFER" || msg.type === "PEER_JOINED") && !localStreamReady) {
        signalingQueue.push(msg);
        return;
      }

      switch(msg.type) {
        case "SET_ICE_SERVERS":
          if (msg.iceServers && Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
            iceServers = msg.iceServers;
          }
          break;

        case "PEER_JOINED": {
          // If no offer is received from this peer within 1500ms, initiate offer ourselves
          var targetId = msg.peerSocketId;
          var targetName = msg.peerName;
          setTimeout(async function() {
            if (!peerConnections[targetId] || !peerConnections[targetId].remoteDescription) {
              console.log("[WebRTC] Auto-initiating offer to peer:", targetId);
              var pc = getOrCreatePC(targetId, targetName);
              try {
                var offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                postToRN({ type: "OFFER_CREATED", to: targetId, offer: offer });
              } catch(e) { console.error("Auto initiate offer err:", e); }
            }
          }, 1500);
          break;
        }

        case "INITIATE_PEER": {
          if (msg.iceServers && Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
            iceServers = msg.iceServers;
          }
          var pc = getOrCreatePC(msg.peerSocketId, msg.peerName);
          try {
            var offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            postToRN({ type: "OFFER_CREATED", to: msg.peerSocketId, offer: offer });
          } catch(e) { console.error("createOffer err:", e); }
          break;
        }

        case "HANDLE_OFFER": {
          if (msg.iceServers && Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
            iceServers = msg.iceServers;
          }
          var pc = getOrCreatePC(msg.from, msg.name);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            await flushIceQueue(msg.from);
            var answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await flushIceQueue(msg.from);
            postToRN({ type: "ANSWER_CREATED", to: msg.from, answer: answer });
          } catch(e) { console.error("handleOffer err:", e); }
          break;
        }

        case "HANDLE_ANSWER": {
          var pc = peerConnections[msg.from];
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
              await flushIceQueue(msg.from);
            } catch(e) { console.error("handleAnswer err:", e); }
          }
          break;
        }

        case "HANDLE_ICE_CANDIDATE": {
          if (!msg.candidate) break;
          var pc = peerConnections[msg.from];
          if (!pc) break;
          try {
            var cand = new RTCIceCandidate(msg.candidate);
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(cand);
            } else {
              if (!iceQueues[msg.from]) iceQueues[msg.from] = [];
              iceQueues[msg.from].push(cand);
            }
          } catch(e) { console.warn("ICE err:", e); }
          break;
        }

        case "USER_LEFT":
          removeRemoteVideo(msg.socketId);
          break;

        case "TOGGLE_AUDIO":
          isAudioMuted = Boolean(msg.muted);
          if (localStream) {
            localStream.getAudioTracks().forEach(function(t) { t.enabled = !isAudioMuted; });
          }
          break;

        case "TOGGLE_VIDEO": {
          isVideoMuted = Boolean(msg.muted);
          var av = document.getElementById("avatar-local");
          var v  = document.getElementById("localVideo");
          if (av) av.style.display = isVideoMuted ? "flex" : "none";
          if (v)  v.style.opacity  = isVideoMuted ? "0" : "1";
          if (localStream) {
            localStream.getVideoTracks().forEach(function(t) { t.enabled = !isVideoMuted; });
          }
          break;
        }

        case "FLIP_CAMERA": {
          facingMode = facingMode === "user" ? "environment" : "user";
          var v = document.getElementById("localVideo");
          if (v) {
            facingMode === "user" ? v.classList.add("mirrored") : v.classList.remove("mirrored");
          }
          if (localStream) {
            var ot = localStream.getVideoTracks()[0];
            if (ot) ot.stop();
          }
          try {
            var ns = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
            });
            var nt = ns.getVideoTracks()[0];
            if (localStream && nt) {
              var ovt = localStream.getVideoTracks();
              if (ovt[0]) localStream.removeTrack(ovt[0]);
              localStream.addTrack(nt);
              if (v) {
                v.srcObject = localStream;
                v.play().catch(function(){});
              }
              Object.values(peerConnections).forEach(function(pc) {
                var s = pc.getSenders().find(function(s) { return s.track && s.track.kind === "video"; });
                if (s) s.replaceTrack(nt);
              });
            }
          } catch(e) { console.error("Flip camera err:", e); }
          break;
        }

        case "START_SCREEN_SHARE": {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            postToRN({ type: "SCREEN_SHARE_ERROR", message: "Screen sharing is not supported by this device or browser engine." });
            break;
          }
          try {
            var screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            var screenTrack = screenStream.getVideoTracks()[0];
            if (!screenTrack) {
              postToRN({ type: "SCREEN_SHARE_ERROR", message: "No screen video track captured." });
              break;
            }

            if (localStream && localStream.getVideoTracks().length > 0) {
              cameraVideoTrack = localStream.getVideoTracks()[0];
              localStream.removeTrack(cameraVideoTrack);
            }
            localStream.addTrack(screenTrack);

            var lv = document.getElementById("localVideo");
            if (lv) {
              lv.srcObject = localStream;
              lv.classList.remove("mirrored");
              lv.play().catch(function(){});
            }

            Object.values(peerConnections).forEach(function(pc) {
              if (pc.getSenders) {
                var s = pc.getSenders().find(function(sender) {
                  return sender.track && sender.track.kind === "video";
                });
                if (s) {
                  s.replaceTrack(screenTrack);
                }
              }
            });

            isScreenSharing = true;
            postToRN({ type: "SCREEN_SHARE_STATE", isSharing: true });

            screenTrack.onended = function() {
              revertScreenShare();
            };
          } catch(err) {
            console.warn("Screen share error:", err);
            if (err && err.name !== "NotAllowedError") {
              postToRN({ type: "SCREEN_SHARE_ERROR", message: err.message || "Could not start screen share" });
            }
            postToRN({ type: "SCREEN_SHARE_STATE", isSharing: false });
          }
          break;
        }

        case "STOP_SCREEN_SHARE": {
          revertScreenShare();
          break;
        }

        default:
          break;
      }
    };

    function revertScreenShare() {
      if (!isScreenSharing) return;
      isScreenSharing = false;

      if (localStream) {
        var tracks = localStream.getVideoTracks();
        tracks.forEach(function(t) {
          if (t !== cameraVideoTrack) {
            try { t.stop(); } catch(e){}
            localStream.removeTrack(t);
          }
        });
        if (cameraVideoTrack) {
          localStream.addTrack(cameraVideoTrack);
        }
      }

      var lv = document.getElementById("localVideo");
      if (lv) {
        lv.srcObject = localStream;
        if (facingMode === "user") {
          lv.classList.add("mirrored");
        }
        lv.play().catch(function(){});
      }

      if (cameraVideoTrack) {
        Object.values(peerConnections).forEach(function(pc) {
          if (pc.getSenders) {
            var s = pc.getSenders().find(function(sender) {
              return sender.track && sender.track.kind === "video";
            });
            if (s) {
              s.replaceTrack(cameraVideoTrack);
            }
          }
        });
      }

      postToRN({ type: "SCREEN_SHARE_STATE", isSharing: false });
    }

    // Signal to React Native that the JS bridge is ready
    postToRN({ type: "READY" });

    // Begin capturing local media immediately
    initLocalStream();
  </script>
</body>
</html>`;

    const RNWebView = WebView as any;

    return (
      <View style={styles.container}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Connecting HD Call…</Text>
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
