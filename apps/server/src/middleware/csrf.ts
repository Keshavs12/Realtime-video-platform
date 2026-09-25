import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { allowedOrigins } from "../config/cors";

/**
 * CSRF Protection Middleware
 *
 * Protects cookie-authenticated mutating endpoints (/api/v1/auth/refresh, /api/v1/auth/logout)
 * from Cross-Site Request Forgery (CSRF).
 *
 * OWASP Defense In Depth:
 * 1. Checks that the request contains the custom header 'X-Requested-With: XMLHttpRequest'.
 *    Browsers strictly prohibit cross-origin HTML forms / scripts from setting custom headers
 *    without CORS preflight (OPTIONS) approval.
 * 2. Validates Origin / Referer against authorized client domains when present.
 */
export const csrfProtection = (req: Request, _res: Response, next: NextFunction) => {
    // Only state-changing methods require CSRF validation
    const method = req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return next();
    }

    const customHeader = req.headers["x-requested-with"];
    const origin = req.headers["origin"] as string | undefined;

    // 1. Verify custom anti-CSRF header
    if (customHeader !== "XMLHttpRequest") {
        return next(
            new AppError("CSRF protection: Missing or invalid X-Requested-With header.", 403)
        );
    }

    // 2. Validate Origin if provided
    if (origin) {
        try {
            const originHost = new URL(origin).host;

            const isAllowed =
                allowedOrigins.includes(origin) ||
                allowedOrigins.some((allowed) => {
                    try {
                        return new URL(allowed).host === originHost;
                    } catch {
                        return false;
                    }
                }) ||
                originHost.startsWith("localhost:") ||
                originHost === "localhost" ||
                originHost.endsWith(".ngrok-free.app") ||
                originHost.endsWith(".ngrok.io") ||
                originHost.endsWith(".vercel.app");

            if (!isAllowed) {
                return next(
                    new AppError("CSRF protection: Cross-origin request rejected.", 403)
                );
            }
        } catch {
            return next(new AppError("CSRF protection: Invalid request origin.", 403));
        }
    }

    next();
};
