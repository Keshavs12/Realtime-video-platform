# Stage 1: Base Alpine with libc6-compat (required by Prisma engine on Alpine)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm@10.15.0

# Stage 2: Dependencies & Build
FROM base AS builder
WORKDIR /app

# Copy root workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/

# Install dependencies
RUN pnpm install --filter @realtime/server... --frozen-lockfile

# Copy source and prisma files
COPY apps/server/tsconfig.json ./apps/server/
COPY apps/server/prisma ./apps/server/prisma/
COPY apps/server/src ./apps/server/src/

# Generate Prisma Client & compile TypeScript
WORKDIR /app/apps/server
RUN npx prisma generate
RUN pnpm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat wget curl

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

USER nodejs
EXPOSE 5000

# Deep healthcheck using our built-in /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

WORKDIR /app/apps/server
CMD ["node", "dist/server.js"]
