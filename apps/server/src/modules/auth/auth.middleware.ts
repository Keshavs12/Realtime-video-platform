/**
 * --------------------------------------------------------------------------
 * Auth Middleware
 * --------------------------------------------------------------------------
 *
 * Middleware executes before the request reaches the controller.
 *
 * Responsibilities:
 * - Verify JWT access tokens.
 * - Authenticate users.
 * - Protect private routes.
 * - Attach authenticated user information to the request object.
 *
 * Example:
 * Authorization: Bearer <access_token>
 *
 * Note:
 * If authentication fails, return HTTP 401 Unauthorized.
 * --------------------------------------------------------------------------
 */
import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../../utils/jwt";

export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Access token is required.",
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization header.",
            });
        }
        
        const token = authHeader.split(" ")[1];

        const payload = verifyAccessToken(token);
        
        req.user = payload;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token.",
        });
    }
};