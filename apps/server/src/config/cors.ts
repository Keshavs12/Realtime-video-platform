/**
 * Single source of truth for which frontend origins may talk to this API,
 * shared by both the Express CORS middleware and the Socket.IO server.
 *
 * CORS_ORIGIN accepts a comma-separated list, e.g.:
 *   CORS_ORIGIN=http://localhost:3000,https://abcd1234.ngrok-free.app
 */
export const allowedOrigins: string[] = (
    process.env.CORS_ORIGIN || "http://localhost:3000"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
