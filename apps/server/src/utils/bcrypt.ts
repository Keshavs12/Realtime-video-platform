import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * Password ko hash karta hai.
 */
export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Plain password aur hashed password compare karta hai.
 */
export const comparePassword = async (
    password: string,
    hashedPassword: string
): Promise<boolean> => {
    return bcrypt.compare(password, hashedPassword);
};