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

interface SignupPayload {
    name: string;
    email: string;
    password: string;
}

export const signup = async (data: SignupPayload) => {
    const { name, email } = data;

    // Later:
    // 1. Check email exists
    // 2. Hash password
    // 3. Save user using Prisma
    // 4. Return user

    return {
        id: "temp-id",
        name,
        email,
    };
};