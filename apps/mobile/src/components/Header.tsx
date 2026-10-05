import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
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
  return (
    <View style={styles.header}>
      <View style={styles.leftContainer}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.brandRow}>
            <Text style={styles.brandIcon}>⚡</Text>
            <Text style={styles.brandTitle}>SuperCall</Text>
          </View>
        )}
      </View>

      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.rightContainer}>
        {rightAction ? (
          <TouchableOpacity onPress={rightAction.onPress} style={styles.iconBtn}>
            <Ionicons name={rightAction.icon} size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  rightContainer: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
  },
});
