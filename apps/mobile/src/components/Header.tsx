import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
}

export const Header = ({ title, showBack = false, onBack, rightAction }: HeaderProps) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <View style={styles.header}>
      <View style={[styles.innerContainer, isWide && styles.innerContainerWide]}>
        <View style={styles.leftContainer}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.brandRow}>
              <View style={styles.brandIconCircle}>
                <Ionicons name="flash" size={16} color="#ffffff" />
              </View>
              <Text style={styles.brandTitle}>SuperCall</Text>
            </View>
          )}
        </View>

        {title ? (
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
        ) : null}

        <View style={styles.rightContainer}>
          {rightAction ? (
            <TouchableOpacity onPress={rightAction.onPress} activeOpacity={0.7} style={styles.actionBtn}>
              <Ionicons name={rightAction.icon} size={20} color={Colors.accent} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: "rgba(10, 15, 29, 0.88)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
  },
  innerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    width: "100%",
  },
  innerContainerWide: {
    maxWidth: 1080,
    alignSelf: "center",
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 44,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  rightContainer: {
    minWidth: 44,
    alignItems: "flex-end",
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});

