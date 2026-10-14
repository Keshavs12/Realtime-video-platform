import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ViewStyle, TextInputProps } from "react-native";
import { Colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export const Input = ({
  label,
  error,
  containerStyle,
  isPassword = false,
  ...props
}: InputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isFocused ? styles.inputFocused : null,
          error ? styles.inputError : null,
        ]}
      >
        <TextInput
          placeholderTextColor={Colors.textSubtle}
          style={styles.input}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={isFocused ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: "100%",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textMuted,
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 17, 32, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 14,
    paddingHorizontal: 15,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(20, 30, 56, 0.85)",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
  },
});

