/**
 * --------------------------------------------------------------------------
 * JWT Utility
 * --------------------------------------------------------------------------
 *
 * Responsible for generating and verifying JWT tokens.
 */

import * as jwt from "jsonwebtoken";

interface JwtPayload {
    userId: string;
    email: string;
}

export const generateAccessToken = (payload: JwtPayload) => {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "15m",
    });
};