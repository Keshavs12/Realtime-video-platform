import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
}

export const StatCard = ({ label, value, icon, trend }: StatCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrapper}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        {trend ? (
          <View style={styles.trendBadge}>
            <Text style={styles.trendText}>{trend}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "rgba(18, 25, 45, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 18,
    padding: 16,
    margin: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 20,
  },
  trendBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trendText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  value: {
    fontSize: 26,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});

