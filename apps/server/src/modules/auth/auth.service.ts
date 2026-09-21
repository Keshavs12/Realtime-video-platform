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
        email: user.email,
    });

    const refreshToken = generateRefreshToken({
        userId: user.id,
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
        email: user.email,
    });

    const newRefreshToken = generateRefreshToken({
        userId: user.id,
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
