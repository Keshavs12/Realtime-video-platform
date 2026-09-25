/**
 * Single source of truth for which frontend origins may talk to this API,
 * shared by both the Express CORS middleware and the Socket.IO server.
 *
 * CORS_ORIGIN accepts a comma-separated list, e.g.:
 *   CORS_ORIGIN=http://localhost:3000,https://abcd1234.ngrok-free.app,https://*.vercel.app
 */
export const allowedOrigins: string[] = (
    process.env.CORS_ORIGIN || "http://localhost:3000"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

/**
 * Validates whether an incoming HTTP or WebSocket origin is permitted.
 * Automatically permits:
 * 1. Missing origin (e.g. server-to-server, native apps, curl)
 * 2. Any Vercel deployment (*.vercel.app)
 * 3. Exact matches in CORS_ORIGIN
 * 4. Wildcard domain patterns like *.example.com or https://*.vercel.app
 */
export const isOriginAllowed = (origin?: string): boolean => {
    if (!origin) return true;

    try {
        const originUrl = new URL(origin);
        const originHostname = originUrl.hostname;

        // Auto-allow all Vercel deployment preview and production domains & localhost
        if (
            originHostname.endsWith(".vercel.app") ||
            originHostname === "localhost" ||
            originHostname === "127.0.0.1"
        ) {
            return true;
        }

        return allowedOrigins.some((allowed) => {
            if (allowed === "*" || allowed === origin) return true;

            try {
                // Remove protocol and wildcard prefix if present, e.g. https://*.domain.com -> domain.com
                const cleanAllowed = allowed.replace(/^https?:\/\//, "");
                if (cleanAllowed.startsWith("*.")) {
                    const suffix = cleanAllowed.slice(2);
                    return originHostname === suffix || originHostname.endsWith("." + suffix);
                }

                const allowedHost = new URL(allowed).host;
                return allowedHost === originUrl.host;
            } catch {
                return false;
            }
        });
    } catch {
        return false;
    }
};

/**
 * Dynamic CORS origin callback for Express cors() middleware.
 */
export const corsOriginDelegate = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
) => {
    if (isOriginAllowed(origin)) {
        callback(null, true);
    } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
};

