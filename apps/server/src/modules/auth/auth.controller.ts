/**
 * --------------------------------------------------------------------------
 * Auth Controller
 * --------------------------------------------------------------------------
 *
 * Handles incoming authentication requests. Extracts request data, calls
 * the auth service, and returns the HTTP response. Errors thrown by the
 * service are forwarded to the centralized error handler via asyncHandler.
 * --------------------------------------------------------------------------
 */

import { CookieOptions } from "express";
import * as authService from "./auth.service";
import { asyncHandler } from "../../utils/asyncHandler";

const isProduction = process.env.NODE_ENV === "production";
const sameSiteSetting: "none" | "lax" = (process.env.COOKIE_SAME_SITE as "none" | "lax") || (isProduction ? "none" : "lax");

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: isProduction || sameSiteSetting === "none",
    sameSite: sameSiteSetting,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/v1/auth",
};

export const signup = asyncHandler(async (req, res) => {
    const user = await authService.signup(req.body);
    res.status(201).json({
        success: true,
        message: "User registered successfully.",
        data: user,
    });
});

export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
        success: true,
        message: "User logged in successfully.",
        data: {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        },
    });
});

export const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Refresh token required.",
        });
    }

    const data = await authService.refreshToken(token);

    res.cookie("refreshToken", data.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
        success: true,
        message: "Access token refreshed successfully.",
        data: {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
        },
    });
});

export const logout = asyncHandler(async (req, res) => {
    if (req.user?.userId) {
        await authService.logout(req.user.userId);
    }

    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProduction || sameSiteSetting === "none",
        sameSite: sameSiteSetting,
        path: "/api/v1/auth",
    });

    res.status(200).json({
        success: true,
        message: "Logged out successfully.",
    });
});

export const getMe = asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const user = await authService.getUserById(userId);

    res.status(200).json({
        success: true,
        user,
    });
});

export const updateProfile = asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user!.userId, req.body.name);

    res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        data: user,
    });
});

export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);

    res.status(200).json({
        success: true,
        message: "Password changed successfully.",
    });
});