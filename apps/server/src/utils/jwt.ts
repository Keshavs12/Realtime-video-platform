/**
 * --------------------------------------------------------------------------
 * JWT Utility
 * --------------------------------------------------------------------------
 *
 * Responsible for generating and verifying JWT tokens.
 */

import * as jwt from "jsonwebtoken";

export interface JwtPayload {
    userId: string;
    email: string;
}

export const generateAccessToken = (payload: JwtPayload) => {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "15m",
    });
};

export const generateRefreshToken = (payload: JwtPayload) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as "7d",
    });
}

export const verifyRefreshToken = (token: string) => {
        return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET!
    ) as JwtPayload;
}

export const verifyAccessToken = (token: string): JwtPayload => {
    return jwt.verify(
        token,
        process.env.JWT_SECRET!
    ) as JwtPayload;
};