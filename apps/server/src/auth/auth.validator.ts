/**
 * --------------------------------------------------------------------------
 * Auth Validator
 * --------------------------------------------------------------------------
 *
 * Responsible for validating authentication requests.
 *
 * TODO:
 * - Signup validation
 * - Login validation
 * - Forgot password validation
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