import rateLimit from "express-rate-limit";
import { Request } from "express";

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 60, // 60 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        // Use client IP via proxy header or connection
        const forwarded = req.headers["x-forwarded-for"];
        if (typeof forwarded === "string") {
            return forwarded.split(",")[0].trim();
        }
        return req.ip || req.socket.remoteAddress || "unknown-ip";
    },
    message: {
        success: false,
        message: "Too many attempts from this IP address. Please try again after a few minutes.",
    },
});

