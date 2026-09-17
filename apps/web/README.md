# SuperCall — Web

Next.js (App Router) frontend: auth pages, dashboard, and the WebRTC room UI.

> **Note for AI coding agents:** see `AGENTS.md` — this project pins a Next.js version with breaking changes from what most training data assumes.

## Scripts

```bash
pnpm dev      # next dev (Turbopack)
pnpm build    # production build
pnpm start    # run the production build
pnpm lint     # eslint
```

## Environment variables

Copy `.env.example` to `.env`. Both default to `localhost:5000`, which is correct for local development against the backend in `apps/server`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL for REST calls (`/auth/*`) |
| `NEXT_PUBLIC_SOCKET_URL` | Base URL the Socket.IO client connects to for signaling |

For LAN or ngrok-based testing from a second device, point these at the backend's LAN IP or ngrok tunnel URL instead — see the root [`README.md`](../../README.md#testing-across-two-machines-lan-or-internet-via-ngrok).

## Pages

| Route | Purpose |
|---|---|
| `/signup`, `/login` | Auth forms, call the backend directly via `services/auth.service.ts` |
| `/dashboard` | Create or join a room by ID |
| `/dashboard/room/[roomId]` | The call itself — video grid, mute/camera toggle, camera/mic device selection, presence sidebar |

## Auth

`src/context/AuthContext.tsx` holds `user`/`accessToken` in memory and rehydrates on load by calling `/auth/me` with whatever's in `localStorage`. `src/lib/axios.ts` is the single shared HTTP client: it attaches the access token to every request and, on a `401`, transparently refreshes (rotating the refresh token) and retries the original request.

`ProtectedRoute` (`src/components/ProtectedRoute.tsx`) wraps the entire dashboard layout — anything under `/dashboard` requires a valid session, checked before any page content (including camera/mic prompts) mounts.

## Realtime / WebRTC

`src/hooks/useRoom.ts` owns the whole call lifecycle for a room: acquiring local media, connecting to Socket.IO, exchanging offers/answers/ICE candidates with each peer, and maintaining one `RTCPeerConnection` per participant (mesh topology — every participant connects directly to every other participant, not through an SFU). Camera/mic switching mid-call uses `RTCRtpSender.replaceTrack()` rather than renegotiating the connection.
