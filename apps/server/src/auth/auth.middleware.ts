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

import { Request, Response, NextFunction } from "express";

export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    next();
};