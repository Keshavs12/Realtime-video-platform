# SuperCall — Server

Express + TypeScript backend: REST auth API and a Socket.IO signaling server for WebRTC room video.

## Scripts

```bash
pnpm dev         # tsx watch — auto-restarts on file changes
pnpm build       # tsc compile to dist/
pnpm start       # run the compiled build
pnpm typecheck   # tsc --noEmit
```

## Environment variables

See `.env.example` for the full list. Copy it to `.env` and fill in real values before running.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 5000) |
| `NODE_ENV` | `development` / `production` — also controls log format (pretty vs JSON) |
| `CORS_ORIGIN` | Comma-separated list of frontend origins allowed to call this API / connect via Socket.IO |
| `DATABASE_URL` | Postgres connection string, used by Prisma |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Access token signing key and lifetime |
| `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Refresh token signing key and lifetime |

## Architecture

Each feature area (currently just `auth`) is a self-contained module under `src/modules/<name>/`, split into:

- `*.routes.ts` — maps HTTP verbs/paths to controller functions, applies middleware (validation, rate limiting, auth)
- `*.controller.ts` — thin HTTP layer; extracts request data, calls the service, shapes the response. Wrapped in `asyncHandler` so a rejected promise is forwarded to the centralized error handler automatically
- `*.service.ts` — business logic; throws `AppError(message, statusCode)` on failure, knows nothing about `req`/`res`
- `*.validator.ts` — zod schemas, applied via the shared `validate()` middleware

Cross-cutting concerns live in `src/middleware/` (`validate`, `authRateLimiter`, `errorHandler`/`notFoundHandler`) and `src/utils/` (`AppError`, `asyncHandler`, `logger` (pino), `jwt`, `bcrypt`).

Errors thrown anywhere in the request lifecycle land in `errorHandler`: an `AppError` becomes its declared status code + message, anything else becomes a logged `500` with no internal details leaked to the client.

## API routes

All routes are mounted under `/api/v1`.

| Method | Path | Auth required | Notes |
|---|---|---|---|
| GET | `/health` | No | Liveness check |
| POST | `/auth/signup` | No | Rate-limited, zod-validated |
| POST | `/auth/login` | No | Rate-limited, zod-validated |
| POST | `/auth/refresh` | No (needs a valid refresh token in the body) | Refresh tokens rotate on every use — the old one is invalidated |
| POST | `/auth/logout` | Yes (`Authorization: Bearer <accessToken>`) | Clears the stored refresh token |
| GET | `/auth/me` | Yes | Returns the current user |

## Socket.IO events

Connect to the root namespace at the server's base URL (not under `/api/v1`).

| Event | Direction | Payload |
|---|---|---|
| `join-room` | client → server | `{ roomId, userId, name }` |
| `room-users` | server → client | List of other users already in the room (sent to the joiner) |
| `user-joined` / `user-left` | server → clients in room | Presence updates |
| `leave-room` | client → server | — |
| `offer` / `answer` / `ice-candidate` | both directions | Relayed 1:1 between peers via `{ to/from, ... }` — the server does not inspect SDP/ICE content, just relays it |

## Database

Prisma schema lives in `prisma/schema.prisma`. After changing it:

```bash
pnpm exec prisma migrate dev --name <description>
pnpm exec prisma generate
```

`pnpm exec prisma studio` is the quickest way to inspect data while testing locally.
