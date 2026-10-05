/**
 * --------------------------------------------------------------------------
 * Auth Validator
 * --------------------------------------------------------------------------
 *
 * Responsible for validating authentication requests.
 */
import { z } from "zod";

export const signupSchema = z.object({
    name: z
        .string()
        .min(3, "Name must be at least 3 characters"),

    email: z
        .email("Invalid email address"),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters"),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
    email: z.email("Invalid email"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
    name: z
        .string()
        .min(3, "Name must be at least 3 characters"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(8, "Current password must be at least 8 characters"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const sendOtpSchema = signupSchema;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
    email: z.email("Invalid email address"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const resendOtpSchema = z.object({
    email: z.email("Invalid email address"),
});
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;