/**
 * --------------------------------------------------------------------------
 * Auth Service
 * --------------------------------------------------------------------------
 *
 * This file contains all authentication business logic.
 *
 * Responsibilities:
 * - Register new users.
 * - Verify user credentials.
 * - Hash passwords using bcrypt.
 * - Generate JWT access tokens.
 * - Generate refresh tokens.
 * - Handle authentication workflows.
 *
 * Note:
 * This layer should never know anything about HTTP requests or responses.
 * It only focuses on business rules.
 * --------------------------------------------------------------------------
 */

/**
 * --------------------------------------------------------------------------
 * Auth Service
 * --------------------------------------------------------------------------
 *
 * Contains authentication business logic.
 */
import { prisma } from "../../config/prisma";
import { hashPassword } from "../../utils/bcrypt";
import * as bcrypt from "bcrypt";
import { generateAccessToken } from "../../utils/jwt";

interface SignupPayload {
    name: string;
    email: string;
    password: string;
}

export const signup = async (data: SignupPayload) => {
    const { name, email, password } = data;
    const hashedPassword = await hashPassword(password);

    const existingUser = await prisma.user.findUnique({
        where: {
            email,
        },
    });

    if (existingUser) {
        throw new Error("Email already registered.");
    }

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
        },
    });

    return user;
};

export const login = async (email: string, password: string) => {
    const user = await prisma.user.findUnique({
        where: {
            email,
        },
    });

    if (!user) {
        throw new Error("Invalid email or password");
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
        throw new Error("Invalid  password or email");
    }

    const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
    });

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        }, accessToken
    };

}

export const comparePassword = async (
    plainPassword: string,
    hashedPassword: string
) => {
    return bcrypt.compare(plainPassword, hashedPassword);
};