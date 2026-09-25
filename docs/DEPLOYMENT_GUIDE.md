# 🐳 Realtime Video Platform: Production Deployment & Containerization Guide

This guide covers complete instructions for deploying the **Realtime Video Platform** to production environments (AWS EC2, DigitalOcean, Hetzner, GCP, or any Linux VPS) using **Docker**, **Docker Compose**, and **Nginx**.

---

## 📌 Architecture Overview

```text
       [ Public Users / Web Browsers ]
                      │
                      ▼
           ┌──────────────────────┐
           │ Nginx (Port 80/443)  │  <-- SSL/TLS, WebSocket Upgrade, Gzip
           └──────────┬───────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
  [ / /_next ]            [ /api /socket.io /health ]
┌──────────────────┐    ┌─────────────────────────────────┐
│ Next.js Web      │    │ Express + Socket.IO Server      │
│ (Port 3000)      │    │ (Port 5000, Multi-stage alpine) │
└──────────────────┘    └────────────────┬────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
               ┌──────────────────┐            ┌──────────────────┐
               │ PostgreSQL 16    │            │ Redis 7          │
               │ (Persistent DB)  │            │ (Pub/Sub Adapter)│
               └──────────────────┘            └──────────────────┘
```

---

## 🚀 Quick Start: Running with Docker Compose

### 1. Prerequisites
- Docker engine (`>= 24.0`)
- Docker Compose (`>= 2.20` or `docker compose`)

### 2. Configure Production Environment Variables
Create a `.env.production` file (or set environment variables in your deployment environment):

```bash
# Database Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_postgres_password_here
POSTGRES_DB=supercall

# Authentication Secrets (generate with `openssl rand -hex 32`)
JWT_SECRET=generate_strong_random_jwt_secret_here
JWT_REFRESH_SECRET=generate_strong_random_refresh_secret_here

# Frontend Configuration
CORS_ORIGIN=https://yourdomain.com,http://localhost
NEXT_PUBLIC_SOCKET_URL=https://yourdomain.com

# Metered TURN Relay Credentials (for strict NAT/firewall traversal)
NEXT_PUBLIC_METERED_DOMAIN=your-metered-app.metered.live
NEXT_PUBLIC_METERED_API_KEY=your_metered_api_key_here
```

### 3. Build & Launch Entire Stack
Run from the root directory:

```bash
# Build and start all 5 containers in the background
docker compose up -d --build
```

### 4. Run Database Migrations
Once the database container is healthy:

```bash
docker compose exec server npx prisma migrate deploy
```

Your platform is now live on `http://localhost` (or your server's public IP)!

---

## 🛠️ Service Breakdown & Ports

| Container | Image / Source | Internal Port | Host Port | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `realtime_nginx` | `nginx:alpine` | 80 | **80** (or 443) | Single-domain entrypoint, SSL, WebSockets |
| `realtime_web` | `apps/web/Dockerfile` | 3000 | 3000 | Next.js 16 standalone frontend |
| `realtime_server` | `apps/server/Dockerfile` | 5000 | 5000 | Express API + Socket.IO signaling server |
| `realtime_postgres` | `postgres:16-alpine` | 5432 | 5433 | Persistent relational storage |
| `realtime_redis` | `redis:7-alpine` | 6379 | 6379 | Horizontal Socket.IO scaling backplane |

---

## 🔒 Production VPS Deployment with SSL (Let's Encrypt / Certbot)

### Step 1: Point Domain DNS
In your DNS registrar (Cloudflare, Namecheap, GoDaddy), create an **A Record**:
- `yourdomain.com` -> `YOUR_VPS_PUBLIC_IP`
- `www.yourdomain.com` -> `YOUR_VPS_PUBLIC_IP`

### Step 2: Install Certbot & Generate SSL Certificates
On your Linux VPS:

```bash
sudo apt update && sudo apt install -y certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

Certificates will be saved in `/etc/letsencrypt/live/yourdomain.com/`.

### Step 3: Enable SSL in Nginx
Update `nginx/nginx.conf` to mount certificates and redirect HTTP to HTTPS:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... Include same location blocks as standard nginx.conf ...
}
```

In `docker-compose.yml`, mount the certificates volume to Nginx:
```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

---

## 📊 Health Checks & Production Monitoring

### 1. Check Stack Health
The Express backend provides a deep health check endpoint validating database connectivity and memory usage:

```bash
curl http://localhost/health
```

Expected JSON output:
```json
{
  "status": "ok",
  "uptime": 1243.5,
  "services": {
    "database": "up",
    "socketServer": "up"
  },
  "memory": {
    "rssMB": "52.14 MB",
    "heapUsedMB": "26.31 MB"
  }
}
```

### 2. View Live Container Logs
```bash
# View all service logs
docker compose logs -f

# View only backend server logs
docker compose logs -f server

# View only Nginx access/error logs
docker compose logs -f nginx
```

---

## 🔄 Zero-Downtime Deployment & Updates

When updating application code:

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild images with new code
docker compose build

# 3. Re-launch containers with zero interruption
docker compose up -d

# 4. Run any pending database migrations
docker compose exec server npx prisma migrate deploy
```

---

## 💻 Local Development: Database & Redis Only
If you prefer developing locally on your host machine with `pnpm dev`, you can spin up **only Postgres and Redis** using the lightweight compose file:

```bash
# Start Postgres & Redis only
docker compose -f docker-compose.dev.yml up -d

# Run local development servers on host
pnpm dev
```
