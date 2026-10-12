import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  GestureResponderEvent,
  PanResponderGestureState,
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

const { width } = Dimensions.get("window");

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="color-palette" size={20} color={Colors.accent} />
              <Text style={styles.title}>Live Shared Whiteboard</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleUndo} style={styles.iconBtn}>
                <Ionicons name="arrow-undo" size={18} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClear} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Canvas Area */}
          <View style={styles.canvas} {...panResponder.panHandlers}>
            {segments.map((seg) => {
              const dx = seg.x2 - seg.x1;
              const dy = seg.y2 - seg.y1;
              const length = Math.hypot(dx, dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

              return (
                <View
                  key={seg.id}
                  pointerEvents="none"
                  style={[
                    styles.lineSegment,
                    {
                      left: seg.x1,
                      top: seg.y1,
                      width: Math.max(length, 1),
                      height: seg.size,
                      backgroundColor: seg.color,
                      transform: [
                        { translateX: 0 },
                        { translateY: -seg.size / 2 },
                        { rotate: `${angle}deg` },
                      ],
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Bottom Toolbar */}
          <View style={styles.toolbar}>
            {/* Tool Selection (Pen vs Eraser) */}
            <View style={styles.toolGroup}>
              <TouchableOpacity
                onPress={() => setTool("pen")}
                style={[styles.toolBtn, tool === "pen" && styles.toolBtnActive]}
              >
                <Ionicons
                  name="pencil"
                  size={18}
                  color={tool === "pen" ? "#ffffff" : Colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTool("eraser")}
                style={[styles.toolBtn, tool === "eraser" && styles.toolBtnActive]}
              >
                <Ionicons
                  name="backspace-outline"
                  size={18}
                  color={tool === "eraser" ? "#ffffff" : Colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Color Palette */}
            {tool === "pen" ? (
              <View style={styles.colorPalette}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      selectedColor === c && styles.colorDotSelected,
                    ]}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.eraserHint}>Eraser Active</Text>
            )}

            {/* Stroke Size Toggles */}
            <View style={styles.sizeGroup}>
              {[2, 4, 8].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStrokeSize(s)}
                  style={[styles.sizeBtn, strokeSize === s && styles.sizeBtnActive]}
                >
                  <View
                    style={{
                      width: s * 1.8,
                      height: s * 1.8,
                      borderRadius: (s * 1.8) / 2,
                      backgroundColor: "#ffffff",
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#070b13",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "82%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    padding: 4,
    marginLeft: 4,
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
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  toolGroup: {
    flexDirection: "row",
    backgroundColor: Colors.cardSecondary,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: {
    backgroundColor: Colors.primary,
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
    transform: [{ scale: 1.2 }],
  },
  eraserHint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  sizeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sizeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeBtnActive: {
    borderWidth: 1,
    borderColor: Colors.accent,
  },
});
