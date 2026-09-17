# SuperCall — Realtime Video Platform

A group video-calling platform built as a learning project: Next.js frontend, Express backend, Socket.IO signaling, WebRTC mesh video, PostgreSQL + Prisma for persistence, JWT auth with refresh-token rotation. A reusable TypeScript SDK is planned but not yet built (see [Status](#status) below).

## Tech stack

| Layer | Tech |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 16 (App Router), React 19, Sass modules |
| Backend | Express 5, TypeScript |
| Realtime | Socket.IO (signaling + presence), WebRTC (mesh peer connections) |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT access + refresh tokens (rotated on use), bcrypt password hashing, zod validation |

## Project layout

```
apps/
  server/     Express API + Socket.IO signaling server
  web/        Next.js frontend
docs/         PRD / architecture / decisions (currently placeholders — not filled in yet)
```

## Prerequisites

- Node.js 20+
- pnpm (`packageManager` is pinned to `pnpm@10.15.0`)
- A running PostgreSQL instance

## Setup

1. Install dependencies from the repo root:
   ```bash
   pnpm install
   ```
2. Configure environment variables — copy the example files and fill in real values:
   ```bash
   cp apps/server/.env.example apps/server/.env
   cp apps/web/.env.example apps/web/.env
   ```
   `apps/server/.env` needs a real `DATABASE_URL` and JWT secrets. `apps/web/.env` defaults to `localhost:5000` for the API, which is correct for local development.
3. Run Prisma migrations against your database:
   ```bash
   cd apps/server
   pnpm exec prisma migrate dev
   ```

## Running it

There's no root-level `dev` script wired up yet, so run each app in its own terminal:

```bash
# Terminal 1 — backend (http://localhost:5000)
cd apps/server && pnpm dev

# Terminal 2 — frontend (http://localhost:3000)
cd apps/web && pnpm dev
```

Open `http://localhost:3000/signup`, create an account, log in, and create or join a room from the dashboard.

## Testing across two machines (LAN or internet via ngrok)

The frontend and backend both read their peer's URL from environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` on the frontend; `CORS_ORIGIN` on the backend), so a second laptop can join a call without needing the source code at all — it just needs a browser and a URL.

- **Same Wi-Fi/LAN:** point the frontend env vars at the host machine's LAN IP instead of `localhost`.
- **Different networks, over the internet:** use ngrok. A ready-to-copy multi-tunnel config is at `ngrok.yml.example` (free ngrok accounts only allow one agent session, so both the frontend and backend tunnels need to run together from one config, not as two separate `ngrok http` commands).
  ```bash
  cp ngrok.yml.example ngrok.yml   # then add your authtoken
  ngrok start --all --config=ngrok.yml
  ```
  Set `CORS_ORIGIN` (backend) to the ngrok URL forwarding port 3000, and `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` (frontend) to the ngrok URL forwarding port 5000, then restart both dev servers.
- WebRTC connectivity uses STUN plus a public TURN fallback (Open Relay Project test servers) for cases where a restrictive NAT blocks a direct peer connection — expect that fallback to be a rate-limited best-effort relay, not production-grade.

## Status
 
Roughly Days 1–9 of the internal build roadmap are implemented and hardened (auth with refresh rotation/rate-limiting/validation, centralized error handling, Socket.IO presence, multi-peer WebRTC video, mute/camera-toggle/device-selection). Not yet built: in-call chat, screen sharing, the standalone SDK/React-hooks package, automated tests, and Docker/deployment config. `docs/PRD.md`, `docs/Architecture.md`, and `docs/Decisions.md` are placeholders reserved for that documentation as the project progresses.

See [`apps/server/README.md`](apps/server/README.md) and [`apps/web/README.md`](apps/web/README.md) for details specific to each app.
