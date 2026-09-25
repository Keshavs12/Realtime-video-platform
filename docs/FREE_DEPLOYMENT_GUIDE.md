# 🆓 Realtime Video Platform: 100% Free Deployment Guide
> Deploy this full-stack real-time video platform to production for **FREE** (Zero Cost, No Credit Card Required).

---

## 📌 The 100% Free Architecture Stack

| Layer | Recommended Free Cloud Provider | Free Tier Benefits | Cost |
| :--- | :--- | :--- | :--- |
| **Database** | **Supabase** or **Neon.tech** | 500MB PostgreSQL, connection pooling, always active | **$0 / month** |
| **Backend API + Sockets** | **Render.com** or **Koyeb** | Node.js runtime, native WebSocket support, free HTTPS URL | **$0 / month** |
| **Frontend App** | **Vercel** | Optimized Next.js 16 hosting, global edge CDN, custom domain | **$0 / month** |
| **WebRTC Relays (TURN/STUN)** | **Metered.ca** + Google STUN | 50GB/month free TURN bandwidth + unlimited Google STUN | **$0 / month** |

---

## 🚀 Step-by-Step Free Deployment

---

### Step 1: Create a Free PostgreSQL Database (Supabase)
*(Takes 2 minutes, no credit card required)*

1. Go to [https://supabase.com](https://supabase.com) and click **Start your project** (Sign in with GitHub).
2. Click **New Project**:
   - Name: `supercall-db`
   - Database Password: *(Choose a strong password and save it!)*
   - Region: Choose the region closest to your users (e.g., *Mumbai / Singapore / Frankfurt*).
3. Once the database is provisioned (approx. 60 seconds), go to **Project Settings** -> **Database**.
4. Under **Connection String**, choose **URI** mode and copy your connection string:
   ```text
   postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   *(Or direct connection port `5432`)*.

---

### Step 2: Push Prisma Database Schema to Cloud DB
Run this once from your local terminal to create the tables in your cloud database:

```bash
# In your local project directory:
DATABASE_URL="your_copied_supabase_connection_string_here" npx prisma db push --schema=apps/server/prisma/schema.prisma
```
*(You will see: `🚀 Your database is now in sync with your Prisma schema`)*.

---

### Step 3: Deploy the Backend (Express + Socket.IO) on Render.com

1. Push your code to your GitHub repository:
   ```bash
   git push origin main
   ```
2. Go to [https://render.com](https://render.com) and sign in with GitHub.
3. Click **New +** -> **Web Service**.
4. Select your **Realtime-video-platform** repository.
5. Fill in the deployment details:
   - **Name**: `realtime-video-server`
   - **Region**: Same region as your database (e.g. *Singapore / Frankfurt*)
   - **Root Directory**: `apps/server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Instance Type**: **Free** ($0/month)
6. Scroll down to **Environment Variables** and add:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` *(Render default port)*
   - `DATABASE_URL` = *(Your Supabase connection string from Step 1)*
   - `JWT_SECRET` = `supercall-prod-jwt-secret-key-replace-me`
   - `JWT_REFRESH_SECRET` = `supercall-prod-refresh-secret-replace-me`
   - `JWT_EXPIRES_IN` = `15m`
   - `JWT_REFRESH_EXPIRES_IN` = `7d`
   - `CORS_ORIGIN` = `*` *(Or your Vercel URL once generated in Step 4)*
7. Click **Create Web Service**.
8. Once deployment is complete, Render will give you your free HTTPS URL:
   👉 Example: `https://realtime-video-server.onrender.com`

---

### Step 4: Deploy the Frontend (Next.js 16) on Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your **Realtime-video-platform** repository.
4. In the configuration screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select **`apps/web`**
5. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SOCKET_URL` = `https://realtime-video-server.onrender.com` *(Your Render backend URL from Step 3)*
   - `NEXT_PUBLIC_METERED_DOMAIN` = *(Optional: your-app.metered.live from Metered.ca)*
   - `NEXT_PUBLIC_METERED_API_KEY` = *(Optional: your key from Metered.ca)*
6. Click **Deploy**.
7. Vercel will build your Next.js application and provide your free live URL:
   👉 Example: `https://realtime-video-platform.vercel.app`

---

### Step 5: Update CORS on Backend
Go back to your Render dashboard -> `realtime-video-server` -> **Environment**:
Update `CORS_ORIGIN`:
```text
CORS_ORIGIN=https://realtime-video-platform.vercel.app
```
Render will automatically redeploy in 30 seconds.

---

## 🎯 Verification & Testing

1. Open your live Vercel URL on your laptop: `https://realtime-video-platform.vercel.app`.
2. Sign up and create a video room.
3. Open the same room link on your mobile phone or share it with a friend.
4. Test:
   - High-definition video and crisp audio.
   - Screen sharing (`🖥️`).
   - Host controls (`🔒 Lock`, `🔇 Mute All`, `❌ Kick`).
   - Hand raise (`✋`) and floating emoji reactions (`🚀 ❤️`).

---

## 💡 Important Free Tier Notes:
- **Render Free Web Service Sleep**: If no one visits your app for 15 minutes, Render spins down the backend container to save resources. When a new user opens the app, the first request takes ~30 seconds to wake up. Once awake, it runs at full speed with real-time WebSockets!
- **Supabase Free Database**: Active databases never sleep and have no monthly expiration.
- **Zero Cost**: This entire setup runs 24/7 at **$0.00 / month**.
