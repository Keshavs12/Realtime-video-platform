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

import * as authService from "./auth.service";
import { asyncHandler } from "../../utils/asyncHandler";

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
    const user = await authService.login(email, password);

    res.status(200).json({
        success: true,
        message: "User logged in successfully.",
        data: user,
    });
});

export const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    const data = await authService.refreshToken(refreshToken);

    res.status(200).json({
        success: true,
        message: "Access token refreshed successfully.",
        data,
    });
});

export const logout = asyncHandler(async (req, res) => {
    await authService.logout(req.user!.userId);

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