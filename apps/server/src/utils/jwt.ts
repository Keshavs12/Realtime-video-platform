/**
 * --------------------------------------------------------------------------
 * JWT Utility
 * --------------------------------------------------------------------------
 *
 * Responsible for generating and verifying JWT tokens.
 */

import * as jwt from "jsonwebtoken";
import crypto from "node:crypto";

export interface JwtPayload {
    userId: string;
    name ?:string;
    email: string;
}

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: JWT_SECRET environment variable is missing in production.");
        }
        return "supercall-dev-jwt-secret-key-at-least-32-chars";
    }
    return secret;
};

const getJwtRefreshSecret = (): string => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: JWT_REFRESH_SECRET environment variable is missing in production.");
        }
        return "supercall-dev-refresh-secret-key-at-least-32-chars";
    }
    return secret;
};

export const generateAccessToken = (payload: JwtPayload) => {
    return jwt.sign(payload, getJwtSecret(), {
        algorithm: "HS256",
        expiresIn: (process.env.JWT_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"],
    });
};

export const generateRefreshToken = (payload: JwtPayload) => {
    return jwt.sign(payload, getJwtRefreshSecret(), {
        algorithm: "HS256",
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
        jwtid: crypto.randomUUID(),
    });
};

export const verifyRefreshToken = (token: string) => {
    return jwt.verify(token, getJwtRefreshSecret(), {
        algorithms: ["HS256"],
    }) as JwtPayload;
};

export const verifyAccessToken = (token: string): JwtPayload => {
    return jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"],
    }) as JwtPayload;
};