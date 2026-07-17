/**
 * --------------------------------------------------------------------------
 * Auth Routes
 * --------------------------------------------------------------------------
 *
 * This file defines all authentication-related API endpoints.
 *
 * Responsibilities:
 * - Map HTTP routes to controller methods.
 * - Register authentication endpoints.
 * - Keep routing logic separate from business logic.
 *
 * Example Routes:
 * - POST /api/v1/auth/signup
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - GET  /api/v1/auth/me
 *
 * Note:
 * Do NOT write business logic in this file.
 * This file should only connect routes with controllers.
 * --------------------------------------------------------------------------
/**
 * --------------------------------------------------------------------------
 * Auth Routes
 * --------------------------------------------------------------------------
 *
 * This file defines all authentication-related API endpoints.
 * It maps HTTP routes to controller methods.
 */

import { Router } from "express";
import { signup, login, refreshToken, logout } from "./auth.controller";
import { authenticate } from "./auth.middleware";

const authRouter = Router();

// POST /api/v1/auth/signup
authRouter.post("/signup", signup);
// login /api/v1/auth/login
authRouter.post("/login", login)
authRouter.post("/refresh", refreshToken);
authRouter.post("/logout", authenticate, logout);

authRouter.get(
    "/me",
    authenticate,
    (req, res) => {
        res.json({
            success: true,
            user: req.user,
        });
    }
);
export default authRouter;