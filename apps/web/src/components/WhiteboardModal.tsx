"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import styles from "@/styles/whiteboard.module.scss";

export type WhiteboardTool = "pen" | "highlighter" | "eraser" | "line" | "rect" | "circle";

export interface WhiteboardPoint {
  x: number; // Normalized 0.0 - 1.0
  y: number; // Normalized 0.0 - 1.0
}

export interface WhiteboardElement {
  id: string;
  type: "path" | "line" | "rect" | "circle";
  tool: WhiteboardTool;
  color: string;
  size: number;
  points?: WhiteboardPoint[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  userId?: string;
}

interface WhiteboardDrawStep {
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
  color: string;
  size: number;
  tool: WhiteboardTool;
}

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  roomId: string;
}

const PRESET_COLORS = [
  "#ffffff", // White
  "#94a3b8", // Slate Gray
  "#6366f1", // Indigo
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
];

const STROKE_SIZES = [
  { label: "Fine", size: 2 },
  { label: "Medium", size: 4 },
  { label: "Bold", size: 8 },
  { label: "Marker", size: 16 },
];

interface WhiteboardDrawOptions {
  width: number;
  height: number;
  scaledSize: number;
  tool: WhiteboardTool;
  color: string;
}

function drawInitialDot(
  ctx: CanvasRenderingContext2D,
  normX: number,
  normY: number,
  options: WhiteboardDrawOptions
) {
  const { width, height, scaledSize, tool, color } = options;
  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.beginPath();
    ctx.arc(normX * width, normY * height, scaledSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = tool === "highlighter" ? 0.35 : 1.0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
      normX * width,
      normY * height,
      (tool === "highlighter" ? scaledSize * 1.25 : scaledSize) / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function renderFreehandStep(
  ctx: CanvasRenderingContext2D,
  prev: WhiteboardPoint,
  curr: WhiteboardPoint,
  options: WhiteboardDrawOptions
) {
  const { width, height, scaledSize, tool, color } = options;
  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = scaledSize * 3;
  } else if (tool === "highlighter") {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = scaledSize * 2.5;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = color;
    ctx.lineWidth = scaledSize;
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(prev.x * width, prev.y * height);
  ctx.lineTo(curr.x * width, curr.y * height);
  ctx.stroke();
  ctx.restore();
}

function renderShapePreview(
  prevCtx: CanvasRenderingContext2D,
  start: WhiteboardPoint,
  curr: WhiteboardPoint,
  options: WhiteboardDrawOptions
) {
  const { width, height, scaledSize, tool, color } = options;
  prevCtx.clearRect(0, 0, width, height);
  prevCtx.save();
  prevCtx.strokeStyle = color;
  prevCtx.lineWidth = scaledSize;
  prevCtx.lineCap = "round";
  prevCtx.lineJoin = "round";

  if (tool === "line") {
    prevCtx.beginPath();
    prevCtx.moveTo(start.x * width, start.y * height);
    prevCtx.lineTo(curr.x * width, curr.y * height);
    prevCtx.stroke();
  } else if (tool === "rect") {
    const x = Math.min(start.x, curr.x) * width;
    const y = Math.min(start.y, curr.y) * height;
    const w = Math.abs(curr.x - start.x) * width;
    const h = Math.abs(curr.y - start.y) * height;
    prevCtx.strokeRect(x, y, w, h);
  } else if (tool === "circle") {
    const centerX = ((start.x + curr.x) / 2) * width;
    const centerY = ((start.y + curr.y) / 2) * height;
    const radiusX = (Math.abs(curr.x - start.x) * width) / 2;
    const radiusY = (Math.abs(curr.y - start.y) * height) / 2;
    prevCtx.beginPath();
    prevCtx.ellipse(
      centerX,
      centerY,
      Math.max(1, radiusX),
      Math.max(1, radiusY),
      0,
      0,
      2 * Math.PI
    );
    prevCtx.stroke();
  }

  prevCtx.restore();
}

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  isOpen,
  onClose,
  socket,
  roomId,
}) => {
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>("pen");
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff");
  const [selectedSize, setSelectedSize] = useState<number>(4);
  const [elementCount, setElementCount] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawingRef = useRef(false);
  const prevPointRef = useRef<WhiteboardPoint | null>(null);
  const startPointRef = useRef<WhiteboardPoint | null>(null);
  const currentPathPointsRef = useRef<WhiteboardPoint[]>([]);
  const elementsRef = useRef<WhiteboardElement[]>([]);

  // Redraw all stored elements onto the main canvas
  const redrawAll = useCallback((elements: WhiteboardElement[]) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Reset and clear canvas
    ctx.clearRect(0, 0, width, height);

    elements.forEach((elem) => {
      ctx.save();
      const scaledSize = Math.max(1, elem.size * (width / 1200));

      if (elem.type === "path" && elem.points && elem.points.length > 0) {
        if (elem.tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
          ctx.lineWidth = scaledSize * 3;
        } else if (elem.tool === "highlighter") {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = elem.color;
          ctx.lineWidth = scaledSize * 2.5;
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = elem.color;
          ctx.lineWidth = scaledSize;
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(elem.points[0].x * width, elem.points[0].y * height);

        for (let i = 1; i < elem.points.length; i++) {
          ctx.lineTo(elem.points[i].x * width, elem.points[i].y * height);
        }
        ctx.stroke();
      } else if (elem.type === "line" && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = elem.color;
        ctx.lineWidth = scaledSize;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(elem.startX * width, elem.startY * height);
        ctx.lineTo(elem.endX * width, elem.endY * height);
        ctx.stroke();
      } else if (elem.type === "rect" && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = elem.color;
        ctx.lineWidth = scaledSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const x = Math.min(elem.startX, elem.endX) * width;
        const y = Math.min(elem.startY, elem.endY) * height;
        const w = Math.abs(elem.endX - elem.startX) * width;
        const h = Math.abs(elem.endY - elem.startY) * height;
        ctx.strokeRect(x, y, w, h);
      } else if (elem.type === "circle" && elem.startX !== undefined && elem.startY !== undefined && elem.endX !== undefined && elem.endY !== undefined) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = elem.color;
        ctx.lineWidth = scaledSize;
        const centerX = ((elem.startX + elem.endX) / 2) * width;
        const centerY = ((elem.startY + elem.endY) / 2) * height;
        const radiusX = Math.abs(elem.endX - elem.startX) * width / 2;
        const radiusY = Math.abs(elem.endY - elem.startY) * height / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, 2 * Math.PI);
        ctx.stroke();
      }

      ctx.restore();
    });
  }, []);

  // Set up retina display resolution and resize handler
  const setupCanvases = useCallback(() => {
    const container = containerRef.current;
    const mainCanvas = mainCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!container || !mainCanvas || !previewCanvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    mainCanvas.width = rect.width * dpr;
    mainCanvas.height = rect.height * dpr;
    mainCanvas.style.width = `${rect.width}px`;
    mainCanvas.style.height = `${rect.height}px`;

    const mainCtx = mainCanvas.getContext("2d");
    if (mainCtx) {
      mainCtx.scale(dpr, dpr);
    }

    previewCanvas.width = rect.width * dpr;
    previewCanvas.height = rect.height * dpr;
    previewCanvas.style.width = `${rect.width}px`;
    previewCanvas.style.height = `${rect.height}px`;

    const prevCtx = previewCanvas.getContext("2d");
    if (prevCtx) {
      prevCtx.scale(dpr, dpr);
    }

    redrawAll(elementsRef.current);
  }, [redrawAll]);

  // Listen to window resize
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure DOM dimensions have settled
    const timer = setTimeout(() => {
      setupCanvases();
    }, 50);

    const handleResize = () => {
      setupCanvases();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, setupCanvases]);

  // Socket.IO event bindings for real-time collaboration
  useEffect(() => {
    if (!socket || !isOpen) return;

    // Request initial history
    socket.emit("whiteboard-request-history");

    // 1. Live stroke segment from remote peer
    const handleRemoteDraw = (step: WhiteboardDrawStep) => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const scaledSize = Math.max(1, step.size * (width / 1200));

      ctx.save();
      if (step.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = scaledSize * 3;
      } else if (step.tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = step.color;
        ctx.lineWidth = scaledSize * 2.5;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = step.color;
        ctx.lineWidth = scaledSize;
      }

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(step.prevX * width, step.prevY * height);
      ctx.lineTo(step.currX * width, step.currY * height);
      ctx.stroke();
      ctx.restore();
    };

    // 2. Full element added by peer
    const handleRemoteElementAdd = (elem: WhiteboardElement) => {
      elementsRef.current.push(elem);
      setElementCount(elementsRef.current.length);

      // If it's a shape (not freehand path which was already drawn incrementally), render it
      if (elem.type !== "path") {
        redrawAll(elementsRef.current);
      }
    };

    // 3. Clear board
    const handleRemoteClear = () => {
      elementsRef.current = [];
      setElementCount(0);
      const canvas = mainCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          ctx.clearRect(0, 0, rect.width, rect.height);
        }
      }
    };

    // 4. Whiteboard history / undo sync
    const handleHistory = (payload: { elements: WhiteboardElement[] }) => {
      elementsRef.current = payload.elements || [];
      setElementCount(elementsRef.current.length);
      redrawAll(elementsRef.current);
    };

    socket.on("whiteboard-draw", handleRemoteDraw);
    socket.on("whiteboard-element-add", handleRemoteElementAdd);
    socket.on("whiteboard-clear", handleRemoteClear);
    socket.on("whiteboard-history", handleHistory);

    return () => {
      socket.off("whiteboard-draw", handleRemoteDraw);
      socket.off("whiteboard-element-add", handleRemoteElementAdd);
      socket.off("whiteboard-clear", handleRemoteClear);
      socket.off("whiteboard-history", handleHistory);
    };
  }, [socket, isOpen, redrawAll]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    isDrawingRef.current = true;
    startPointRef.current = { x: normX, y: normY };
    prevPointRef.current = { x: normX, y: normY };

    if (selectedTool === "pen" || selectedTool === "highlighter" || selectedTool === "eraser") {
      currentPathPointsRef.current = [{ x: normX, y: normY }];

      const mainCanvas = mainCanvasRef.current;
      const ctx = mainCanvas?.getContext("2d");
      if (ctx) {
        const scaledSize = Math.max(1, selectedSize * (rect.width / 1200));
        drawInitialDot(ctx, normX, normY, {
          width: rect.width,
          height: rect.height,
          scaledSize,
          tool: selectedTool,
          color: selectedColor,
        });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const prev = prevPointRef.current;
    const start = startPointRef.current;
    if (!prev || !start) return;

    const scaledSize = Math.max(1, selectedSize * (width / 1200));

    if (selectedTool === "pen" || selectedTool === "highlighter" || selectedTool === "eraser") {
      const mainCanvas = mainCanvasRef.current;
      const ctx = mainCanvas?.getContext("2d");
      if (!ctx) return;

      renderFreehandStep(ctx, prev, { x: normX, y: normY }, {
        width,
        height,
        scaledSize,
        tool: selectedTool,
        color: selectedColor,
      });

      // Broadcast live stroke step to other peers
      if (socket) {
        socket.emit("whiteboard-draw", {
          prevX: prev.x,
          prevY: prev.y,
          currX: normX,
          currY: normY,
          color: selectedColor,
          size: selectedSize,
          tool: selectedTool,
        });
      }

      currentPathPointsRef.current.push({ x: normX, y: normY });
      prevPointRef.current = { x: normX, y: normY };
    } else {
      const prevCtx = canvas.getContext("2d");
      if (!prevCtx) return;
      renderShapePreview(prevCtx, start, { x: normX, y: normY }, {
        width,
        height,
        scaledSize,
        tool: selectedTool,
        color: selectedColor,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const start = startPointRef.current;

    // Clear preview canvas
    const prevCtx = canvas.getContext("2d");
    if (prevCtx) {
      prevCtx.clearRect(0, 0, width, height);
    }

    const randomSuffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
    const elemId = `${Date.now()}-${randomSuffix}`;

    if (selectedTool === "pen" || selectedTool === "highlighter" || selectedTool === "eraser") {
      const points = currentPathPointsRef.current;
      if (points.length === 0) return;

      const newElement: WhiteboardElement = {
        id: elemId,
        type: "path",
        tool: selectedTool,
        color: selectedColor,
        size: selectedSize,
        points,
      };

      elementsRef.current.push(newElement);
      setElementCount(elementsRef.current.length);

      if (socket) {
        socket.emit("whiteboard-element-add", newElement);
      }
    } else if (start) {
      const newElement: WhiteboardElement = {
        id: elemId,
        type: selectedTool,
        tool: selectedTool,
        color: selectedColor,
        size: selectedSize,
        startX: start.x,
        startY: start.y,
        endX: normX,
        endY: normY,
      };

      elementsRef.current.push(newElement);
      setElementCount(elementsRef.current.length);

      // Render finalized shape to main canvas
      redrawAll(elementsRef.current);

      if (socket) {
        socket.emit("whiteboard-element-add", newElement);
      }
    }

    currentPathPointsRef.current = [];
    prevPointRef.current = null;
    startPointRef.current = null;
  };

  // Undo last action (synced over Socket.IO)
  const handleUndo = () => {
    if (elementsRef.current.length === 0) return;
    if (socket) {
      socket.emit("whiteboard-undo");
    } else {
      elementsRef.current.pop();
      setElementCount(elementsRef.current.length);
      redrawAll(elementsRef.current);
    }
  };

  // Clear board (synced over Socket.IO)
  const handleClear = () => {
    if (elementsRef.current.length === 0) return;
    if (confirm("Are you sure you want to clear the entire whiteboard for everyone in the room?")) {
      if (socket) {
        socket.emit("whiteboard-clear");
      } else {
        elementsRef.current = [];
        setElementCount(0);
        redrawAll([]);
      }
    }
  };

  // Export board as high-res PNG image
  const handleExportPNG = () => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;

    const rect = mainCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Create high-resolution export canvas with dark slate background
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = rect.width * dpr;
    exportCanvas.height = rect.height * dpr;
    const expCtx = exportCanvas.getContext("2d");
    if (!expCtx) return;

    // Fill premium dark background
    expCtx.fillStyle = "#0b0f19";
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Subtle grid dots
    expCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
    const dotSpacing = 24 * dpr;
    for (let x = dotSpacing / 2; x < exportCanvas.width; x += dotSpacing) {
      for (let y = dotSpacing / 2; y < exportCanvas.height; y += dotSpacing) {
        expCtx.beginPath();
        expCtx.arc(x, y, 1.25 * dpr, 0, Math.PI * 2);
        expCtx.fill();
      }
    }

    // Draw whiteboard drawing
    expCtx.drawImage(mainCanvas, 0, 0);

    // Add room watermark in bottom-right
    expCtx.font = `600 ${12 * dpr}px sans-serif`;
    expCtx.fillStyle = "rgba(148, 163, 184, 0.6)";
    expCtx.textAlign = "right";
    expCtx.fillText(
      `SuperCall Whiteboard • Room: ${roomId} • ${new Date().toLocaleDateString()}`,
      exportCanvas.width - 20 * dpr,
      exportCanvas.height - 16 * dpr
    );

    // Trigger download
    const dataUrl = exportCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `whiteboard-${roomId}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.whiteboardOverlay}>
      <button
        type="button"
        className={styles.modalBackdrop}
        onClick={onClose}
        aria-label="Close whiteboard modal"
        tabIndex={-1}
      />
      <dialog
        open
        aria-modal="true"
        aria-label="Collaborative Whiteboard"
        className={styles.whiteboardModal}
      >
        {/* Header Bar */}
        <header className={styles.whiteboardHeader}>
          <div className={styles.headerLeft}>
            <h2>🎨 Collaborative Whiteboard</h2>
            <span className={styles.roomBadge}>Room: {roomId}</span>
            <span className={styles.syncIndicator}>
              <span className={styles.pulseDot} />
              {" "}Live Synced
            </span>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={handleUndo}
              disabled={elementCount === 0}
              title="Undo Last Stroke (Ctrl+Z)"
            >
              ⤺ Undo
            </button>
            <button
              type="button"
              className={`${styles.headerBtn} ${styles.dangerBtn}`}
              onClick={handleClear}
              disabled={elementCount === 0}
              title="Clear Canvas for All Participants"
            >
              🧹 Clear Board
            </button>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={handleExportPNG}
              title="Download High-Res PNG"
            >
              💾 Export PNG
            </button>
            <button
              type="button"
              className={`${styles.headerBtn} ${styles.closeBtn}`}
              onClick={onClose}
              title="Close Whiteboard"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Workspace */}
        <div className={styles.whiteboardWorkspace}>
          {/* Floating Tool Dock */}
          <aside className={styles.toolbarDock}>
            <div className={styles.sectionLabel}>Drawing Tools</div>
            <div className={styles.toolGroup}>
              <button
                type="button"
                className={`${styles.toolBtn} ${selectedTool === "pen" ? styles.activeTool : ""}`}
                onClick={() => setSelectedTool("pen")}
                title="Pen (P)"
              >
                ✏️
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${selectedTool === "highlighter" ? styles.activeTool : ""}`}
                onClick={() => setSelectedTool("highlighter")}
                title="Highlighter (H)"
              >
                🖍️
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${selectedTool === "eraser" ? styles.activeTool : ""}`}
                onClick={() => setSelectedTool("eraser")}
                title="Eraser (E)"
              >
                🧼
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${selectedTool === "line" ? styles.activeTool : ""}`}
                onClick={() => setSelectedTool("line")}
                title="Straight Line (L)"
              >
                📏
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${selectedTool === "rect" ? styles.activeTool : ""}`}
                onClick={() => setSelectedTool("rect")}
                title="Rectangle (R)"
              >
                🔲
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${selectedTool === "circle" ? styles.activeTool : ""}`}
                onClick={() => setSelectedTool("circle")}
                title="Circle / Ellipse (C)"
              >
                ⭕
              </button>
            </div>

            <div className={styles.divider} />

            <div className={styles.sectionLabel}>Stroke Width</div>
            <div className={styles.sizeGroup}>
              {STROKE_SIZES.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  className={`${styles.sizeBtn} ${selectedSize === s.size ? styles.activeSize : ""}`}
                  onClick={() => setSelectedSize(s.size)}
                  title={`${s.label} (${s.size}px)`}
                >
                  <span
                    className={styles.sizeDot}
                    style={{ width: `${s.size + 4}px`, height: `${s.size + 4}px` }}
                  />
                </button>
              ))}
            </div>

            <div className={styles.divider} />

            <div className={styles.sectionLabel}>Color Palette</div>
            <div className={styles.colorPalette}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${selectedColor === c ? styles.activeColor : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setSelectedColor(c)}
                  title={`Color: ${c}`}
                />
              ))}
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className={styles.customColorPicker}
                title="Custom Color Picker"
              />
            </div>
          </aside>

          {/* Canvas Viewport */}
          <div ref={containerRef} className={styles.canvasContainer}>
            <canvas ref={mainCanvasRef} className={styles.mainCanvas} />
            <canvas
              ref={previewCanvasRef}
              className={styles.previewCanvas}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />

            <div className={styles.bottomInfoBar}>
              <span>✨ Real-time collaboration synced over Socket.IO</span>
              {" • "}
              <span>{elementCount} elements</span>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
};
