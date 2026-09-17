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
import { AppError } from "../../utils/AppError";

export const authenticate = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            throw new AppError("Access token is required.", 401);
        }

        if (!authHeader.startsWith("Bearer ")) {
            throw new AppError("Invalid authorization header.", 401);
        }

        const token = authHeader.split(" ")[1];

        const payload = verifyAccessToken(token);

        req.user = payload;

        next();
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError("Invalid or expired access token.", 401));
    }
};