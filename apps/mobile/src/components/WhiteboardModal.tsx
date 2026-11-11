import React, { useRef, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";

export interface WhiteboardModalProps {
  visible: boolean;
  onClose: () => void;
  onDrawSegment: (segment: {
    prevX: number;
    prevY: number;
    currX: number;
    currY: number;
    color: string;
    size: number;
    tool: string;
  }) => void;
  onClearBoard: () => void;
  onUndoBoard: () => void;
  onAddElement?: (element: any) => void;
  onRequestHistory?: () => void;
  remoteDrawStep?: {
    prevX: number;
    prevY: number;
    currX: number;
    currY: number;
    color: string;
    size: number;
    tool: string;
  } | null;
  remoteClearTimestamp?: number;
  remoteHistory?: any[];
}

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  visible,
  onClose,
  onDrawSegment,
  onClearBoard,
  onUndoBoard,
  onAddElement,
  onRequestHistory,
  remoteDrawStep,
  remoteClearTimestamp,
  remoteHistory,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const webViewRef = useRef<WebView | null>(null);
  const isWebViewReadyRef = useRef<boolean>(false);
  const pendingMessagesRef = useRef<any[]>([]);

  const postToWebView = useCallback((data: any) => {
    if (!isWebViewReadyRef.current) {
      pendingMessagesRef.current.push(data);
      return;
    }
    const jsonStr = JSON.stringify(data);
    webViewRef.current?.injectJavaScript(`
      try {
        if (window.handleNativeMessage) {
          window.handleNativeMessage(${jsonStr});
        }
      } catch (err) {
        console.error("injectJavaScript error:", err);
      }
      true;
    `);
  }, []);

  // Flush queued messages when WebView signals READY
  const flushPendingQueue = useCallback(() => {
    const queue = pendingMessagesRef.current.splice(0);
    for (const msg of queue) {
      const jsonStr = JSON.stringify(msg);
      webViewRef.current?.injectJavaScript(`
        try {
          if (window.handleNativeMessage) {
            window.handleNativeMessage(${jsonStr});
          }
        } catch (err) {}
        true;
      `);
    }
  }, []);

  // Forward incoming remote draw step
  useEffect(() => {
    if (!remoteDrawStep) return;
    postToWebView({ type: "REMOTE_DRAW", step: remoteDrawStep });
  }, [remoteDrawStep, postToWebView]);

  // Forward incoming remote clear
  useEffect(() => {
    if (!remoteClearTimestamp) return;
    postToWebView({ type: "REMOTE_CLEAR" });
  }, [remoteClearTimestamp, postToWebView]);

  // Forward incoming remote history
  useEffect(() => {
    if (!remoteHistory) return;
    postToWebView({ type: "REMOTE_HISTORY", elements: remoteHistory });
  }, [remoteHistory, postToWebView]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case "READY":
          isWebViewReadyRef.current = true;
          flushPendingQueue();
          onRequestHistory?.();
          break;
        case "DRAW_STEP":
          onDrawSegment(data.payload);
          break;
        case "ADD_ELEMENT":
          onAddElement?.(data.payload);
          break;
        case "CLEAR":
          onClearBoard();
          break;
        case "UNDO":
          onUndoBoard();
          break;
        case "CLOSE":
          onClose();
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn("[WhiteboardModal] Message parse error:", err);
    }
  };

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #070b13;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(18, 25, 45, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 10;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .icon-badge {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .title-text h3 {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }
    .title-text p {
      font-size: 11px;
      color: #94a3b8;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .action-btn {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.15s;
    }
    .action-btn:active {
      transform: scale(0.92);
      background: rgba(255, 255, 255, 0.1);
    }
    .clear-btn {
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.25);
      background: rgba(239, 68, 68, 0.12);
    }
    .close-btn {
      color: #94a3b8;
    }

    /* Canvas Stage */
    .canvas-container {
      flex: 1;
      position: relative;
      background: #070b13;
      touch-action: none;
      overflow: hidden;
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
    }
    #previewCanvas {
      z-index: 2;
    }
    #mainCanvas {
      z-index: 1;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(18, 25, 45, 0.95);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 10;
    }
    .tool-group {
      display: flex;
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 2px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      gap: 2px;
    }
    .tool-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.15s;
    }
    .tool-btn.active {
      background: #6366f1;
      color: #fff;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
    }

    /* Colors */
    .color-palette {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .color-dot {
      width: 22px;
      height: 22px;
      border-radius: 11px;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
    }
    .color-dot.active {
      border-color: #6366f1;
      transform: scale(1.25);
    }
    .eraser-hint {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      padding: 0 4px;
    }

    /* Stroke sizes */
    .size-group {
      display: flex;
      align-items: center;
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 2px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      gap: 2px;
    }
    .size-btn {
      width: 32px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      cursor: pointer;
    }
    .size-btn.active {
      background: rgba(99, 102, 241, 0.25);
      border: 1px solid #6366f1;
    }
    .size-indicator {
      border-radius: 50%;
      background: #94a3b8;
    }
    .size-btn.active .size-indicator {
      background: #6366f1;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="title-row">
      <div class="icon-badge">🎨</div>
      <div class="title-text">
        <h3>Shared Whiteboard</h3>
        <p>Synced with all meeting participants</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="action-btn" id="undoBtn" title="Undo">↩</button>
      <button class="action-btn clear-btn" id="clearBtn" title="Clear All">🗑</button>
      <button class="action-btn close-btn" id="closeBtn" title="Close">✕</button>
    </div>
  </div>

  <!-- Interactive Canvas Container -->
  <div class="canvas-container" id="container">
    <canvas id="mainCanvas"></canvas>
    <canvas id="previewCanvas"></canvas>
  </div>

  <!-- Bottom Toolbar -->
  <div class="toolbar">
    <div class="tool-group">
      <button class="tool-btn active" id="penBtn" title="Pen">✏️</button>
      <button class="tool-btn" id="eraserBtn" title="Eraser">🧹</button>
    </div>

    <div class="color-palette" id="palette">
      <div class="color-dot active" style="background:#ffffff;" data-color="#ffffff"></div>
      <div class="color-dot" style="background:#6366f1;" data-color="#6366f1"></div>
      <div class="color-dot" style="background:#10b981;" data-color="#10b981"></div>
      <div class="color-dot" style="background:#f59e0b;" data-color="#f59e0b"></div>
      <div class="color-dot" style="background:#ef4444;" data-color="#ef4444"></div>
    </div>

    <div class="size-group">
      <button class="size-btn active" data-size="2"><div class="size-indicator" style="width:4px;height:4px;"></div></button>
      <button class="size-btn" data-size="4"><div class="size-indicator" style="width:7px;height:7px;"></div></button>
      <button class="size-btn" data-size="8"><div class="size-indicator" style="width:11px;height:11px;"></div></button>
    </div>
  </div>

  <script>
    (function() {
      var container = document.getElementById("container");
      var mainCanvas = document.getElementById("mainCanvas");
      var previewCanvas = document.getElementById("previewCanvas");
      var mainCtx = mainCanvas.getContext("2d");
      var prevCtx = previewCanvas.getContext("2d");

      var currentTool = "pen";
      var currentColor = "#ffffff";
      var currentSize = 2;
      var isDrawing = false;
      var prevPoint = null;
      var currentPathPoints = [];
      var elements = [];

      function sendToRN(data) {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      }

      function resizeCanvases() {
        var rect = container.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        var w = rect.width;
        var h = rect.height;
        if (w === 0 || h === 0) return;

        mainCanvas.width = w * dpr;
        mainCanvas.height = h * dpr;
        mainCanvas.style.width = w + "px";
        mainCanvas.style.height = h + "px";
        mainCtx.scale(dpr, dpr);

        previewCanvas.width = w * dpr;
        previewCanvas.height = h * dpr;
        previewCanvas.style.width = w + "px";
        previewCanvas.style.height = h + "px";
        prevCtx.scale(dpr, dpr);

        redrawAll();
      }

      window.addEventListener("resize", resizeCanvases);
      setTimeout(resizeCanvases, 50);

      function redrawAll() {
        var rect = container.getBoundingClientRect();
        var w = rect.width;
        var h = rect.height;
        if (w === 0 || h === 0) return;

        mainCtx.clearRect(0, 0, w, h);

        for (var i = 0; i < elements.length; i++) {
          var el = elements[i];
          var scaledSize = Math.max(1.5, el.size * Math.max(0.65, w / 1200));
          mainCtx.save();
          if (el.tool === "eraser") {
            mainCtx.globalCompositeOperation = "destination-out";
            mainCtx.strokeStyle = "rgba(0,0,0,1)";
            mainCtx.lineWidth = scaledSize * 3;
          } else {
            mainCtx.globalCompositeOperation = "source-over";
            mainCtx.strokeStyle = el.color;
            mainCtx.lineWidth = scaledSize;
          }
          mainCtx.lineCap = "round";
          mainCtx.lineJoin = "round";

          if (el.type === "path" && el.points && el.points.length > 0) {
            mainCtx.beginPath();
            mainCtx.moveTo(el.points[0].x * w, el.points[0].y * h);
            for (var p = 1; p < el.points.length; p++) {
              mainCtx.lineTo(el.points[p].x * w, el.points[p].y * h);
            }
            mainCtx.stroke();
          } else if (el.type === "line" && el.startX !== undefined) {
            mainCtx.beginPath();
            mainCtx.moveTo(el.startX * w, el.startY * h);
            mainCtx.lineTo(el.endX * w, el.endY * h);
            mainCtx.stroke();
          } else if (el.type === "rect" && el.startX !== undefined) {
            var rx = Math.min(el.startX, el.endX) * w;
            var ry = Math.min(el.startY, el.endY) * h;
            var rw = Math.abs(el.endX - el.startX) * w;
            var rh = Math.abs(el.endY - el.startY) * h;
            mainCtx.strokeRect(rx, ry, rw, rh);
          } else if (el.type === "circle" && el.startX !== undefined) {
            var cx = ((el.startX + el.endX) / 2) * w;
            var cy = ((el.startY + el.endY) / 2) * h;
            var radX = Math.abs(el.endX - el.startX) * w / 2;
            var radY = Math.abs(el.endY - el.startY) * h / 2;
            mainCtx.beginPath();
            mainCtx.ellipse(cx, cy, Math.max(1, radX), Math.max(1, radY), 0, 0, 2 * Math.PI);
            mainCtx.stroke();
          }
          mainCtx.restore();
        }
      }

      function renderStep(prev, curr, tool, color, size) {
        var rect = container.getBoundingClientRect();
        var w = rect.width;
        var h = rect.height;
        var scaledSize = Math.max(1.5, size * Math.max(0.65, w / 1200));

        mainCtx.save();
        if (tool === "eraser") {
          mainCtx.globalCompositeOperation = "destination-out";
          mainCtx.strokeStyle = "rgba(0,0,0,1)";
          mainCtx.lineWidth = scaledSize * 3;
        } else {
          mainCtx.globalCompositeOperation = "source-over";
          mainCtx.strokeStyle = color;
          mainCtx.lineWidth = scaledSize;
        }
        mainCtx.lineCap = "round";
        mainCtx.lineJoin = "round";
        mainCtx.beginPath();
        mainCtx.moveTo(prev.x * w, prev.y * h);
        mainCtx.lineTo(curr.x * w, curr.y * h);
        mainCtx.stroke();
        mainCtx.restore();
      }

      // Pointer Event Handlers for smooth and responsive drawing
      previewCanvas.addEventListener("pointerdown", function(e) {
        e.preventDefault();
        try { previewCanvas.setPointerCapture(e.pointerId); } catch(err) {}

        var rect = container.getBoundingClientRect();
        var w = rect.width;
        var h = rect.height;
        if (w === 0 || h === 0) return;

        var normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
        var normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / h));

        isDrawing = true;
        prevPoint = { x: normX, y: normY };
        currentPathPoints = [{ x: normX, y: normY }];

        var scaledSize = Math.max(1.5, currentSize * Math.max(0.65, w / 1200));
        mainCtx.save();
        if (currentTool === "eraser") {
          mainCtx.globalCompositeOperation = "destination-out";
          mainCtx.fillStyle = "rgba(0,0,0,1)";
          mainCtx.beginPath();
          mainCtx.arc(normX * w, normY * h, scaledSize * 1.5, 0, Math.PI * 2);
          mainCtx.fill();
        } else {
          mainCtx.globalCompositeOperation = "source-over";
          mainCtx.fillStyle = currentColor;
          mainCtx.beginPath();
          mainCtx.arc(normX * w, normY * h, scaledSize / 2, 0, Math.PI * 2);
          mainCtx.fill();
        }
        mainCtx.restore();
      });

      previewCanvas.addEventListener("pointermove", function(e) {
        if (!isDrawing || !prevPoint) return;
        e.preventDefault();

        var rect = container.getBoundingClientRect();
        var w = rect.width;
        var h = rect.height;
        if (w === 0 || h === 0) return;

        var normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
        var normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / h));

        // Skip jitter
        if (Math.hypot(normX - prevPoint.x, normY - prevPoint.y) < 0.001) return;

        var curr = { x: normX, y: normY };
        renderStep(prevPoint, curr, currentTool, currentColor, currentSize);

        sendToRN({
          type: "DRAW_STEP",
          payload: {
            prevX: prevPoint.x,
            prevY: prevPoint.y,
            currX: curr.x,
            currY: curr.y,
            color: currentColor,
            size: currentSize,
            tool: currentTool
          }
        });

        currentPathPoints.push(curr);
        prevPoint = curr;
      });

      function handlePointerEnd(e) {
        if (!isDrawing) return;
        isDrawing = false;
        try { previewCanvas.releasePointerCapture(e.pointerId); } catch(err) {}

        if (currentPathPoints.length > 0) {
          var elem = {
            id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 6),
            type: "path",
            tool: currentTool,
            color: currentColor,
            size: currentSize,
            points: currentPathPoints
          };
          elements.push(elem);
          sendToRN({ type: "ADD_ELEMENT", payload: elem });
        }
        currentPathPoints = [];
        prevPoint = null;
      }

      previewCanvas.addEventListener("pointerup", handlePointerEnd);
      previewCanvas.addEventListener("pointercancel", handlePointerEnd);

      // Handle Toolbar UI
      var penBtn = document.getElementById("penBtn");
      var eraserBtn = document.getElementById("eraserBtn");
      var palette = document.getElementById("palette");

      penBtn.addEventListener("click", function() {
        currentTool = "pen";
        penBtn.classList.add("active");
        eraserBtn.classList.remove("active");
        palette.style.display = "flex";
      });

      eraserBtn.addEventListener("click", function() {
        currentTool = "eraser";
        eraserBtn.classList.add("active");
        penBtn.classList.remove("active");
      });

      palette.addEventListener("click", function(e) {
        var dot = e.target.closest(".color-dot");
        if (!dot) return;
        document.querySelectorAll(".color-dot").forEach(function(d) { d.classList.remove("active"); });
        dot.classList.add("active");
        currentColor = dot.dataset.color;
        if (currentTool === "eraser") {
          currentTool = "pen";
          penBtn.classList.add("active");
          eraserBtn.classList.remove("active");
        }
      });

      document.querySelectorAll(".size-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
          document.querySelectorAll(".size-btn").forEach(function(b) { b.classList.remove("active"); });
          btn.classList.add("active");
          currentSize = parseInt(btn.dataset.size, 10);
        });
      });

      document.getElementById("undoBtn").addEventListener("click", function() {
        if (elements.length > 0) {
          elements.pop();
          redrawAll();
          sendToRN({ type: "UNDO" });
        }
      });

      document.getElementById("clearBtn").addEventListener("click", function() {
        elements = [];
        var rect = container.getBoundingClientRect();
        mainCtx.clearRect(0, 0, rect.width, rect.height);
        sendToRN({ type: "CLEAR" });
      });

      document.getElementById("closeBtn").addEventListener("click", function() {
        sendToRN({ type: "CLOSE" });
      });

      // Handle messages incoming from React Native
      window.handleNativeMessage = function(data) {
        if (!data) return;
        switch(data.type) {
          case "REMOTE_DRAW":
            if (data.step) {
              renderStep(
                { x: data.step.prevX, y: data.step.prevY },
                { x: data.step.currX, y: data.step.currY },
                data.step.tool,
                data.step.color,
                data.step.size
              );
            }
            break;
          case "REMOTE_CLEAR":
            elements = [];
            var rect = container.getBoundingClientRect();
            mainCtx.clearRect(0, 0, rect.width, rect.height);
            break;
          case "REMOTE_HISTORY":
            if (Array.isArray(data.elements)) {
              elements = data.elements;
              redrawAll();
            }
            break;
          default:
            break;
        }
      };

      // Signal ready
      sendToRN({ type: "READY" });
    })();
  </script>
</body>
</html>`;

  const RNWebView = WebView as any;

  return (
    <Modal visible={visible} animationType={isTablet ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isTablet && styles.overlayTablet]}>
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          <RNWebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: htmlContent }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handleMessage}
            style={styles.webview}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  overlayTablet: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#070b13",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "85%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 16,
  },
  containerTablet: {
    width: "100%",
    maxWidth: 780,
    height: 680,
    borderRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
  webview: {
    flex: 1,
    backgroundColor: "#070b13",
  },
});
