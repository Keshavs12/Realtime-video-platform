import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface LineSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  size: number;
}

interface WhiteboardModalProps {
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
}

const COLORS = ["#ffffff", "#6366f1", "#10b981", "#ef4444", "#f59e0b"];

export const WhiteboardModal = ({
  visible,
  onClose,
  onDrawSegment,
  onClearBoard,
  onUndoBoard,
}: WhiteboardModalProps) => {
  const [segments, setSegments] = useState<LineSegment[]>([]);
  const [selectedColor, setSelectedColor] = useState("#ffffff");
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [strokeSize, setStrokeSize] = useState(3);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const prevPointRef = useRef<{ x: number; y: number } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        prevPointRef.current = { x: locationX, y: locationY };
      },
      onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (!prevPointRef.current) {
          prevPointRef.current = { x: locationX, y: locationY };
          return;
        }

        const prevX = prevPointRef.current.x;
        const prevY = prevPointRef.current.y;
        const currX = locationX;
        const currY = locationY;

        // Skip micro movements to keep rendering fast
        const dist = Math.hypot(currX - prevX, currY - prevY);
        if (dist < 2) return;

        const activeColor = tool === "eraser" ? "#070b13" : selectedColor;
        const activeSize = tool === "eraser" ? 20 : strokeSize;

        const newSegment: LineSegment = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x1: prevX,
          y1: prevY,
          x2: currX,
          y2: currY,
          color: activeColor,
          size: activeSize,
        };

        setSegments((prev) => [...prev.slice(-400), newSegment]);

        // Sync with backend & web participants
        onDrawSegment({
          prevX,
          prevY,
          currX,
          currY,
          color: activeColor,
          size: activeSize,
          tool,
        });

        prevPointRef.current = { x: currX, y: currY };
      },
      onPanResponderRelease: () => {
        prevPointRef.current = null;
      },
    })
  ).current;

  const handleClear = () => {
    setSegments([]);
    onClearBoard();
  };

  const handleUndo = () => {
    setSegments((prev) => prev.slice(0, Math.max(0, prev.length - 20)));
    onUndoBoard();
  };

  return (
    <Modal visible={visible} animationType={isTablet ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isTablet && styles.overlayTablet]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="color-palette" size={18} color={Colors.warning} />
              </View>
              <View>
                <Text style={styles.title}>Live Shared Whiteboard</Text>
                <Text style={styles.subtitle}>Collaborative canvas synced live</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleUndo} style={styles.iconBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-undo" size={17} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClear} style={[styles.iconBtn, styles.clearBtn]} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={17} color={Colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Canvas Area */}
          <View style={styles.canvas} {...panResponder.panHandlers}>
            {segments.map((seg) => {
              const dx = seg.x2 - seg.x1;
              const dy = seg.y2 - seg.y1;
              const length = Math.hypot(dx, dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={seg.id}
                  style={[
                    styles.lineSegment,
                    {
                      left: seg.x1,
                      top: seg.y1 - seg.size / 2,
                      width: Math.max(length, 1),
                      height: seg.size,
                      backgroundColor: seg.color,
                      transform: [{ rotateZ: `${angle}deg` }],
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Whiteboard Toolbar */}
          <View style={styles.toolbar}>
            {/* Tool Selection (Pen / Eraser) */}
            <View style={styles.toolGroup}>
              <TouchableOpacity
                onPress={() => setTool("pen")}
                style={[styles.toolBtn, tool === "pen" && styles.toolBtnActive]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="pencil"
                  size={16}
                  color={tool === "pen" ? "#ffffff" : "#94a3b8"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTool("eraser")}
                style={[styles.toolBtn, tool === "eraser" && styles.toolBtnActive]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="cut-outline"
                  size={16}
                  color={tool === "eraser" ? "#ffffff" : "#94a3b8"}
                />
              </TouchableOpacity>
            </View>

            {/* Color Palette (Pen mode only) */}
            {tool === "pen" ? (
              <View style={styles.colorPalette}>
                {COLORS.map((col) => (
                  <TouchableOpacity
                    key={col}
                    onPress={() => setSelectedColor(col)}
                    activeOpacity={0.8}
                    style={[
                      styles.colorDot,
                      { backgroundColor: col },
                      selectedColor === col && styles.colorDotSelected,
                    ]}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.eraserHint}>Eraser Active</Text>
            )}

            {/* Stroke Thickness */}
            <View style={styles.sizeGroup}>
              {[2, 4, 8].map((size) => (
                <TouchableOpacity
                  key={size}
                  onPress={() => setStrokeSize(size)}
                  style={[styles.sizeBtn, strokeSize === size && styles.sizeBtnActive]}
                  activeOpacity={0.75}
                >
                  <View
                    style={{
                      width: size * 1.8,
                      height: size * 1.8,
                      borderRadius: (size * 1.8) / 2,
                      backgroundColor: strokeSize === size ? Colors.primary : "#94a3b8",
                    }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
    height: "82%",
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(18, 25, 45, 0.85)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  canvas: {
    flex: 1,
    backgroundColor: "#070b13",
    overflow: "hidden",
    position: "relative",
  },
  lineSegment: {
    position: "absolute",
    borderRadius: 2,
    transformOrigin: "left center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(18, 25, 45, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  toolGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 4,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  colorPalette: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotSelected: {
    borderColor: Colors.accent,
    transform: [{ scale: 1.25 }],
  },
  eraserHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  sizeGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 4,
  },
  sizeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeBtnActive: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
});
