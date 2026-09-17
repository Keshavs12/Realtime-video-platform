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
import { signup, login, refreshToken, logout, getMe, updateProfile, changePassword } from "./auth.controller";
import { authenticate } from "./auth.middleware";
import { validate } from "../../middleware/validate";
import { authRateLimiter } from "../../middleware/rateLimit";
import { signupSchema, loginSchema, updateProfileSchema, changePasswordSchema } from "./auth.validator";

const authRouter = Router();

// POST /api/v1/auth/signup
authRouter.post("/signup", authRateLimiter, validate(signupSchema), signup);
// login /api/v1/auth/login
authRouter.post("/login", authRateLimiter, validate(loginSchema), login)
authRouter.post("/refresh", refreshToken);
authRouter.post("/logout", authenticate, logout);

authRouter.get("/me", authenticate, getMe);
authRouter.patch("/me", authenticate, validate(updateProfileSchema), updateProfile);
authRouter.patch("/me/password", authenticate, validate(changePasswordSchema), changePassword);
export default authRouter;