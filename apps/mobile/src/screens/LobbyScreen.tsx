import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Share,
  Alert,
  useWindowDimensions,
  Vibration,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

interface LobbyScreenProps {
  roomCode: string;
  onJoin: (options: { isAudioMuted: boolean; isVideoMuted: boolean }) => void;
  onCancel: () => void;
}

export const LobbyScreen = ({ roomCode, onJoin, onCancel }: LobbyScreenProps) => {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isBackCamera, setIsBackCamera] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const webViewRef = useRef<WebView | null>(null);

  const cleanCode = (roomCode || "").trim().toLowerCase();

  const handleToggleAudio = () => {
    try { Vibration.vibrate(30); } catch {}
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    webViewRef.current?.injectJavaScript(`
      if (window.toggleAudio) { window.toggleAudio(${next}); }
      true;
    `);
  };

  const handleToggleVideo = () => {
    try { Vibration.vibrate(30); } catch {}
    const next = !isVideoMuted;
    setIsVideoMuted(next);
    webViewRef.current?.injectJavaScript(`
      if (window.toggleVideo) { window.toggleVideo(${next}); }
      true;
    `);
  };

  const handleFlipCamera = () => {
    try { Vibration.vibrate(40); } catch {}
    setIsBackCamera((prev) => !prev);
    webViewRef.current?.injectJavaScript(`
      if (window.flipCamera) { window.flipCamera(); }
      true;
    `);
  };

  const handleShareRoom = async () => {
    try { Vibration.vibrate(25); } catch {}
    try {
      await Share.share({
        message: `Join my SuperCall video meeting!\nRoom Code: ${cleanCode}\nLink: https://realtime-video-platform.onrender.com/room/${cleanCode}`,
        title: "SuperCall Meeting Code",
      });
    } catch {
      Alert.alert("Room Code", `Meeting code: ${cleanCode}`);
    }
  };

  const handleJoinPress = () => {
    try { Vibration.vibrate(45); } catch {}
    webViewRef.current?.injectJavaScript(`
      if (currentStream) {
        currentStream.getTracks().forEach(function(t) { t.stop(); });
      }
      true;
    `);
    onJoin({
      isAudioMuted,
      isVideoMuted,
    });
  };

  const handleCancelPress = () => {
    try { Vibration.vibrate(20); } catch {}
    webViewRef.current?.injectJavaScript(`
      if (currentStream) {
        currentStream.getTracks().forEach(function(t) { t.stop(); });
      }
      true;
    `);
    onCancel();
  };

  const userInitial = (user?.name || "U")[0].toUpperCase();

  // Self-contained camera preview HTML (No external network dependencies)
  const previewHtml = useMemo(
    () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; background: #070b13; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #container { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #0f172a; }
    video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
    video.rear { transform: none; }
    #avatarView { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at center, #1e293b, #070b13); }
    .avatarCircle { width: 88px; height: 88px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #4f46e5); display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 800; color: #fff; box-shadow: 0 0 35px rgba(99,102,241,0.4); margin-bottom: 12px; }
    .avatarSub { color: #94a3b8; font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
  <div id="container">
    <video id="previewVideo" autoplay playsinline muted></video>
    <div id="avatarView">
      <div class="avatarCircle">${userInitial}</div>
      <div class="avatarSub">Camera is off</div>
    </div>
  </div>

  <script>
    var currentStream = null;
    var facingMode = "user";
    var isMutedAudio = false;
    var isMutedVideo = false;

    function postToRN(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    async function startCamera() {
      if (currentStream) {
        currentStream.getTracks().forEach(function(t) { t.stop(); });
      }
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        var v = document.getElementById("previewVideo");
        if (v) {
          v.srcObject = currentStream;
          v.className = facingMode === "user" ? "" : "rear";
          v.play().catch(function(){});
        }
        setupAudioMeter(currentStream);
      } catch (err) {
        console.warn("Lobby getUserMedia error:", err);
        // Fallback audio only
        try {
          currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setupAudioMeter(currentStream);
          document.getElementById("avatarView").style.display = "flex";
        } catch(e) {}
      }
    }

    function setupAudioMeter(stream) {
      try {
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var source = audioCtx.createMediaStreamSource(stream);
        var analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        var data = new Uint8Array(analyser.frequencyBinCount);
        setInterval(function() {
          if (isMutedAudio) {
            postToRN({ type: "MIC_STATUS", active: false });
            return;
          }
          analyser.getByteFrequencyData(data);
          var sum = 0;
          for (var i = 0; i < data.length; i++) sum += data[i];
          var avg = sum / data.length;
          postToRN({ type: "MIC_STATUS", active: avg > 15 });
        }, 200);
      } catch(e){}
    }

    window.toggleAudio = function(muted) {
      isMutedAudio = muted;
      if (currentStream) {
        currentStream.getAudioTracks().forEach(function(t) { t.enabled = !muted; });
      }
    };

    window.toggleVideo = function(muted) {
      isMutedVideo = muted;
      var av = document.getElementById("avatarView");
      if (currentStream) {
        currentStream.getVideoTracks().forEach(function(t) { t.enabled = !muted; });
      }
      if (av) {
        av.style.display = muted ? "flex" : "none";
      }
    };

    window.flipCamera = function() {
      facingMode = facingMode === "user" ? "environment" : "user";
      startCamera();
    };

    startCamera();
  </script>
</body>
</html>`,
    [userInitial]
  );

  const RNWebView = WebView as any;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070b13" />

      {/* Top Navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleCancelPress}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.topTitleGroup}>
          <Text style={styles.topTitle}>Ready to join?</Text>
          <Text style={styles.topSubtitle}>Set up your audio &amp; video</Text>
        </View>

        <TouchableOpacity
          onPress={handleShareRoom}
          style={styles.shareBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={19} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Main Container */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.mainContent, isTablet && styles.mainContentTablet]}>
          {/* Preview Card */}
          <View style={styles.previewCard}>
            <RNWebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: previewHtml }}
              style={styles.previewWebView}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grant"
              javaScriptEnabled={true}
              scrollEnabled={false}
              bounces={false}
              onMessage={(e: any) => {
                try {
                  const data = JSON.parse(e.nativeEvent.data);
                  if (data.type === "MIC_STATUS") {
                    setMicActive(data.active && !isAudioMuted);
                  }
                } catch {}
              }}
            />

          {/* Live Mic Activity Badge */}
          <View style={[styles.micActivityPill, isAudioMuted ? styles.micActivityMuted : micActive ? styles.micActivitySpeaking : null]}>
            <Ionicons
              name={isAudioMuted ? "mic-off" : "mic"}
              size={13}
              color={isAudioMuted ? "#f87171" : micActive ? "#34d399" : "#94a3b8"}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.micActivityText, isAudioMuted ? styles.micTextMuted : micActive ? styles.micTextSpeaking : null]}>
              {isAudioMuted ? "Mic Muted" : micActive ? "Voice Detected" : "Mic Active"}
            </Text>
          </View>

          {/* Quick Floating Preview Controls */}
          <View style={styles.previewControlsOverlay}>
            <TouchableOpacity
              onPress={handleToggleAudio}
              style={[styles.floatingControlBtn, isAudioMuted && styles.floatingControlBtnMuted]}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isAudioMuted ? "mic-off" : "mic"}
                size={20}
                color={isAudioMuted ? "#f87171" : "#ffffff"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleToggleVideo}
              style={[styles.floatingControlBtn, isVideoMuted && styles.floatingControlBtnMuted]}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isVideoMuted ? "videocam-off" : "videocam"}
                size={20}
                color={isVideoMuted ? "#f87171" : "#ffffff"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleFlipCamera}
              style={styles.floatingControlBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="camera-reverse" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Meeting Information & Join Actions */}
        <View style={styles.joinCard}>
          <View style={styles.roomCodeRow}>
            <View style={styles.roomCodePill}>
              <Ionicons name="videocam-outline" size={14} color="#818cf8" style={{ marginRight: 6 }} />
              <Text style={styles.roomCodeText}>{cleanCode}</Text>
            </View>
            <TouchableOpacity
              onPress={handleShareRoom}
              style={styles.copyBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* User Profile */}
          <View style={styles.userInfoRow}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{userInitial}</Text>
            </View>
            <View>
              <Text style={styles.userNameText}>{user?.name || "Participant"}</Text>
              <Text style={styles.userRoleText}>Joining call as attendee</Text>
            </View>
          </View>

          {/* Big Join Meeting Button */}
          <TouchableOpacity
            onPress={handleJoinPress}
            style={styles.joinPrimaryBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.joinPrimaryText}>Join Meeting</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={handleCancelPress}
            style={styles.cancelBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070b13",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitleGroup: {
    alignItems: "center",
  },
  topTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  topSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentTablet: {
    alignItems: "center",
  },
  mainContent: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 520,
  },
  mainContentTablet: {
    maxWidth: 580,
    width: "100%",
    alignSelf: "center",
  },
  previewCard: {
    flex: 1,
    maxHeight: "56%",
    minHeight: 280,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#0f172a",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  previewWebView: {
    flex: 1,
    backgroundColor: "#070b13",
  },
  micActivityPill: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  micActivitySpeaking: {
    borderColor: "rgba(16, 185, 129, 0.5)",
    backgroundColor: "rgba(16, 185, 129, 0.18)",
  },
  micActivityMuted: {
    borderColor: "rgba(239, 68, 68, 0.5)",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
  },
  micActivityText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  micTextSpeaking: {
    color: "#34d399",
  },
  micTextMuted: {
    color: "#f87171",
  },
  previewControlsOverlay: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  floatingControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingControlBtnMuted: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
  },
  joinCard: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  roomCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  roomCodePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  roomCodeText: {
    color: "#c7d2fe",
    fontSize: 13,
    fontWeight: "700",
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    borderWidth: 1.5,
    borderColor: "rgba(99, 102, 241, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatarText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  userNameText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  userRoleText: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  joinPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  joinPrimaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
});
