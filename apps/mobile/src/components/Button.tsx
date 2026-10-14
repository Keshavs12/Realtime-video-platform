import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { Colors } from "../theme/colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps) => {
  const getBackgroundColor = () => {
    if (disabled) return "rgba(30, 41, 59, 0.4)";
    switch (variant) {
      case "primary":
        return Colors.primary;
      case "secondary":
        return Colors.cardSecondary;
      case "danger":
        return Colors.danger;
      case "outline":
      case "ghost":
        return "transparent";
      default:
        return Colors.primary;
    }
  };

  const getBorderColor = () => {
    if (disabled) return "rgba(255, 255, 255, 0.05)";
    if (variant === "outline") return Colors.borderLight;
    if (variant === "secondary") return Colors.glassBorderStrong;
    if (variant === "primary") return "rgba(255, 255, 255, 0.2)";
    if (variant === "danger") return "rgba(255, 255, 255, 0.15)";
    return "transparent";
  };

  const getTextColor = () => {
    if (disabled) return Colors.textSubtle;
    switch (variant) {
      case "primary":
      case "danger":
        return "#ffffff";
      case "secondary":
        return Colors.text;
      case "outline":
      case "ghost":
        return Colors.accent;
      default:
        return "#ffffff";
    }
  };

  const getElevationStyle = () => {
    if (disabled) return null;
    if (variant === "primary") return styles.primaryElevation;
    if (variant === "danger") return styles.dangerElevation;
    if (variant === "secondary") return styles.glassElevation;
    return null;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[size],
        getElevationStyle(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "ghost" ? 0 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              styles[`text_${size}`],
              { color: getTextColor() },
              icon ? { marginLeft: 8 } : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  primaryElevation: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  dangerElevation: {
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  glassElevation: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  small: {
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  medium: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  large: {
    paddingVertical: 18,
    paddingHorizontal: 26,
  },
  text: {
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  text_small: {
    fontSize: 13,
  },
  text_medium: {
    fontSize: 15,
  },
  text_large: {
    fontSize: 17,
  },
});

