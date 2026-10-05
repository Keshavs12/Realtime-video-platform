import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { FloatingReaction } from "../types";

interface ReactionOverlayProps {
  reactions: FloatingReaction[];
}

export const ReactionOverlay = ({ reactions }: ReactionOverlayProps) => {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      {reactions.map((r) => (
        <FloatingReactionItem key={r.id} reaction={r} />
      ))}
    </View>
  );
};

const FloatingReactionItem = ({ reaction }: { reaction: FloatingReaction }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 2500,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.3,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.reactionContainer,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text style={styles.emoji}>{reaction.emoji}</Text>
      <View style={styles.nameBadge}>
        <Text style={styles.nameText}>{reaction.fromName || "Participant"}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 100,
  },
  reactionContainer: {
    position: "absolute",
    alignItems: "center",
  },
  emoji: {
    fontSize: 42,
  },
  nameBadge: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  nameText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
});
