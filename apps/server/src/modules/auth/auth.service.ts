/**
 * --------------------------------------------------------------------------
 * Auth Service
 * --------------------------------------------------------------------------
 *
 * This file contains all authentication business logic.
 *
 * Responsibilities:
 * - Register new users.
 * - Verify user credentials.
 * - Hash passwords using bcrypt.
 * - Generate JWT access tokens.
 * - Generate refresh tokens.
 * - Handle authentication workflows.
 *
 * Note:
 * This layer should never know anything about HTTP requests or responses.
 * It only focuses on business rules.
 * --------------------------------------------------------------------------
 */

/**
 * --------------------------------------------------------------------------
 * Auth Service
 * --------------------------------------------------------------------------
 *
 * Contains authentication business logic.
 */
import crypto from "node:crypto";
import { prisma } from "../../config/prisma";
import { hashPassword } from "../../utils/bcrypt";
import * as bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { AppError } from "../../utils/AppError";
import { emailService } from "../../services/email.service";

export const hashToken = (token: string): string => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

export const timingSafeMatch = (a: string, b: string): boolean => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

interface SignupPayload {
    name: string;
    email: string;
    password: string;
}

export const signup = async (data: SignupPayload) => {
    const { name, email, password } = data;
    const hashedPassword = await hashPassword(password);

    const existingUser = await prisma.user.findUnique({
        where: {
            email,
        },
    });

    if (existingUser) {
        throw new AppError("Email already registered.", 409);
    }

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
        },
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
        },
    });

    return user;
};

export const login = async (email: string, password: string) => {
    const user = await prisma.user.findUnique({
        where: {
            email,
        },
    });

    if (!user) {
        throw new AppError("Invalid email or password.", 401);
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
        throw new AppError("Invalid email or password.", 401);
    }

    const accessToken = generateAccessToken({
        userId: user.id,
        name: user.name,
        email: user.email,
    });

    const refreshToken = generateRefreshToken({
        userId: user.id,
        name: user.name,
        email: user.email,
    });

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            refreshToken: hashToken(refreshToken),
        },
    });

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
        accessToken,
        refreshToken,
    };

}

export const logout = async (userId: string) => {
    await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            refreshToken: null,
        },
    });
};

export const comparePassword = async (
    plainPassword: string,
    hashedPassword: string
) => {
    return bcrypt.compare(plainPassword, hashedPassword);
};

export const refreshToken = async (token: string) => {

    let payload;
    try {
        payload = verifyRefreshToken(token);
    } catch {
        throw new AppError("Invalid or expired refresh token.", 401);
    }

    const user = await prisma.user.findUnique({
        where: {
            id: payload.userId,
        },
    });

    if (!user || !user.refreshToken) {
        throw new AppError("Invalid refresh token.", 401);
    }

    const tokenHash = hashToken(token);
    const isValid =
        (user.refreshToken.length === 64 && timingSafeMatch(user.refreshToken, tokenHash)) ||
        user.refreshToken === token; // graceful fallback for existing legacy unhashed sessions

    if (!isValid) {
        throw new AppError("Invalid refresh token.", 401);
    }

    const accessToken = generateAccessToken({
        userId: user.id,
        name: user.name,
        email: user.email,
    });

    const newRefreshToken = generateRefreshToken({
        userId: user.id,
        name: user.name,
        email: user.email,
    });

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            refreshToken: hashToken(newRefreshToken),
        },
    });

    return {
        accessToken,
        refreshToken: newRefreshToken,
    };
};

export const updateProfile = async (userId: string, name: string) => {
    const user = await prisma.user.update({
        where: { id: userId },
        data: { name },
        select: {
            id: true,
            name: true,
            email: true,
        },
    });

    return user;
};

export const changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string
) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
        throw new AppError("User not found.", 404);
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        throw new AppError("Current password is incorrect.", 401);
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
    });
};

export const getUserById = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
        },
    });

    if (!user) {
        throw new AppError("User not found.", 404);
    }

    return user;
};

const cleanupExpiredOtps = async () => {
    try {
        await prisma.emailOtp.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
    } catch {
        // silent background cleanup
    }
};

export const initiateSignupOtp = async (data: SignupPayload) => {
    const { name, email, password } = data;

    // Prune stale expired records in the background
    void cleanupExpiredOtps();

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new AppError("Email already registered. Please log in.", 409);
    }

    // Server-side Cooldown Check: Minimum 60 seconds between OTP requests per email
    const existingOtp = await prisma.emailOtp.findUnique({
        where: { email },
    });

    if (existingOtp) {
        const timeSinceLastSent = (Date.now() - existingOtp.lastSentAt.getTime()) / 1000;
        if (timeSinceLastSent < 60) {
            const waitSeconds = Math.ceil(60 - timeSinceLastSent);
            throw new AppError(
                `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
                429
            );
        }
    }

    const hashedPassword = await hashPassword(password);
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashToken(otp); // Store SHA-256 hash instead of plaintext
    const expiresInSeconds = 15 * 60; // 15 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await prisma.emailOtp.upsert({
        where: { email },
        update: {
            otpHash,
            name,
            password: hashedPassword,
            attempts: 0, // Reset attempt counter
            lastSentAt: new Date(),
            expiresAt,
        },
        create: {
            email,
            otpHash,
            name,
            password: hashedPassword,
            attempts: 0,
            lastSentAt: new Date(),
            expiresAt,
        },
    });

    const emailSent = await emailService.sendSignupOtp({ to: email, name, otp });

    if (!emailSent && process.env.NODE_ENV === "production") {
        if (!emailService.isConfigured()) {
            throw new AppError(
                "Email service is not configured on the backend server. Please configure your email provider (Brevo, Resend, or SMTP).",
                503
            );
        }
        const lastErr = emailService.getLastError();
        throw new AppError(
            lastErr
                ? `Failed to deliver verification code to your email: ${lastErr}`
                : "Failed to deliver verification code to your email. Please check your email address or mail service configuration.",
            502
        );
    }

    return {
        email,
        expiresInSeconds,
        emailDelivered: emailSent,
    };
};

export const resendSignupOtp = async (email: string) => {
    void cleanupExpiredOtps();

    const existingOtp = await prisma.emailOtp.findUnique({
        where: { email },
    });

    if (!existingOtp) {
        throw new AppError("No pending registration found for this email. Please sign up again.", 404);
    }

    // Server-side Cooldown Check: Minimum 60 seconds
    const timeSinceLastSent = (Date.now() - existingOtp.lastSentAt.getTime()) / 1000;
    if (timeSinceLastSent < 60) {
        const waitSeconds = Math.ceil(60 - timeSinceLastSent);
        throw new AppError(
            `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
            429
        );
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashToken(otp);
    const expiresInSeconds = 15 * 60; // 15 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await prisma.emailOtp.update({
        where: { email },
        data: {
            otpHash,
            attempts: 0, // Reset attempts on fresh OTP
            lastSentAt: new Date(),
            expiresAt,
        },
    });

    const emailSent = await emailService.sendSignupOtp({ to: email, name: existingOtp.name, otp });

    if (!emailSent && process.env.NODE_ENV === "production") {
        if (!emailService.isConfigured()) {
            throw new AppError(
                "Email service is not configured on the backend server. Please configure your email provider (Brevo, Resend, or SMTP).",
                503
            );
        }
        const lastErr = emailService.getLastError();
        throw new AppError(
            lastErr
                ? `Failed to deliver verification code to your email: ${lastErr}`
                : "Failed to deliver verification code to your email. Please check your email address or mail service configuration.",
            502
        );
    }

    return {
        email,
        expiresInSeconds,
        emailDelivered: emailSent,
    };
};

export const verifySignupOtp = async (email: string, otp: string) => {
    void cleanupExpiredOtps();

    const record = await prisma.emailOtp.findUnique({
        where: { email },
    });

    if (!record) {
        throw new AppError("No pending registration found or verification code has expired. Please sign up again.", 400);
    }

    // Check expiry
    if (new Date() > record.expiresAt) {
        await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
        throw new AppError("Verification code has expired. Please request a new code.", 400);
    }

    // Check brute-force attempts limit (Max 5 attempts)
    const MAX_ATTEMPTS = 5;
    if (record.attempts >= MAX_ATTEMPTS) {
        await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
        throw new AppError("Too many failed attempts. For security, this verification code has been revoked. Please request a new one.", 429);
    }

    // Timing-safe cryptographic comparison using SHA-256 hashes
    const inputHash = hashToken(otp.trim());
    const isMatch = timingSafeMatch(inputHash, record.otpHash);

    if (!isMatch) {
        const currentAttempts = record.attempts + 1;
        const remainingAttempts = MAX_ATTEMPTS - currentAttempts;

        if (remainingAttempts <= 0) {
            await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
            throw new AppError("Too many failed attempts. For security, this verification code has been revoked. Please request a new one.", 429);
        }

        // Increment attempts counter in database
        await prisma.emailOtp.update({
            where: { email },
            data: { attempts: currentAttempts },
        });

        throw new AppError(
            `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining before code is locked.`,
            400
        );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
        throw new AppError("Email already registered. Please log in.", 409);
    }

    const user = await prisma.user.create({
        data: {
            name: record.name,
            email: record.email,
            password: record.password,
        },
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
        },
    });

    await prisma.emailOtp.delete({ where: { email } }).catch(() => {});

    const accessToken = generateAccessToken({
        userId: user.id,
        name: user.name,
        email: user.email,
    });

    const refreshToken = generateRefreshToken({
        userId: user.id,
        name: user.name,
        email: user.email,
    });

    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashToken(refreshToken) },
    });

    return {
        user,
        accessToken,
        refreshToken,
    };
};

