# SuperCall Mobile App (React Native & Expo)

Cross-platform mobile application for **SuperCall Realtime Video Platform**, built with **React Native**, **Expo**, **TypeScript**, and **Socket.IO**.

---

## 📱 Features Included

1. **Authentication Flow**
   - **Signup with 6-Digit Email OTP Verification**: Simple 2-step registration. Enter Name, Email, and Password -> receive OTP -> verify and sign in.
   - **Login**: Email and password authentication with automatic JWT access and refresh token rotation.
   - **Persistent Session**: Uses `@react-native-async-storage/async-storage` to keep users signed in.

2. **Dashboard & Meeting Actions**
   - **Start Instant Meeting**: One-tap instant room creation and immediate join.
   - **Join by Code**: Join any meeting using a room code or shared meeting URL.
   - **Meeting Overview Stats**: Track rooms hosted, call minutes, and activity metrics.
   - **Upcoming Meetings**: Quick preview of upcoming scheduled calls with direct join buttons.

3. **Schedule Meetings & Send Email Invites**
   - Create scheduled calls with Title, Description, Date/Time, and Duration (15m, 30m, 45m, 60m).
   - **Invite by Email**: Add multiple participant emails with chip tags.
   - **Auto-add typed email**: Even if you submit without pressing "+ Add", the typed email is automatically included.
   - **Email Invitations**: Automatically triggers invitations through the backend email relay.
   - **Dispatch Reminders**: One-tap notification dispatch to all invitees.
   - **Cancel/Delete**: Hosts can cancel scheduled meetings.

4. **Live Video Call Room**
   - Real-time signaling via **Socket.IO**.
   - **Participant Grid**: Dynamic avatar and video cards for all attendees with active speaker indicators.
   - **Host & Status Badges**: Host crown, audio muted status, video off status, and hand-raise badges.
   - **In-Call Real-Time Chat**: Dedicated modal with chat history, instant messaging, and unread count badges.
   - **Hand Raising (✋)**: Toggle raised hand to notify the host and attendees.
   - **Floating Emoji Reactions (👏, 👍, ❤️, 🎉, 🔥, 😂, 🚀, 💡)**: Animated floating popover with smooth fade-and-rise animations.
   - **Audio / Video Controls**: Toggle microphone, toggle camera, and end/leave call.

5. **Meeting History**
   - Call history logs with room codes, dates, duration in minutes, participant counts, and host indicator.
   - One-tap room re-open button.

6. **Settings & Profile**
   - Update display name.
   - Change account password.
   - **Configurable Backend Endpoint**: Easily switch between local development (`http://<LAN_IP>:5000/api/v1`), local tunnel, or production Render cloud backend (`https://realtime-video-server-401y.onrender.com/api/v1`).
   - Secure Sign Out.

---

## 🚀 How to Run the Mobile App

### Prerequisites
Make sure dependencies are installed:
```bash
pnpm install
```

### 1. Start the Expo Development Server
From the root directory:
```bash
pnpm --filter mobile start
```
Or navigate into `apps/mobile`:
```bash
cd apps/mobile
npm start
```

### 2. Run on a Physical Device (Easiest)
1. Install **Expo Go** from Google Play Store (Android) or App Store (iOS).
2. Scan the QR code displayed in the terminal:
   - On Android: Scan with the Expo Go app.
   - On iOS: Scan with the default Camera app.

### 3. Run on an Android Emulator
```bash
pnpm --filter mobile android
```

### 4. Run on an iOS Simulator (macOS required)
```bash
pnpm --filter mobile ios
```

### 5. Run in Web Browser
```bash
pnpm --filter mobile web
```

---

## ⚙️ Connecting to Backend

The mobile app defaults to the production Render server:
`https://realtime-video-server-401y.onrender.com/api/v1`

If you are running the backend locally on your computer and testing on a physical phone on the same Wi-Fi:
1. Open the app -> tap **⚙️ Server** on the sign-in screen (or navigate to **Profile -> Backend Connection**).
2. Change the API Base URL to your computer's local IP (e.g. `http://192.168.1.100:5000/api/v1`).
3. Tap **Apply Server URL**.

---

## 📁 Directory Structure

```
apps/mobile/
├── assets/                  # App icons and splash screens
├── src/
│   ├── components/          # Reusable UI (Button, Input, Header, StatCard, ChatModal, ReactionOverlay)
│   ├── config/              # API client, AsyncStorage auth tokens, server endpoints
│   ├── context/             # AuthContext (state, login, signup, OTP, profile)
│   ├── screens/
│   │   ├── LoginScreen.tsx       # Sign in
│   │   ├── SignupScreen.tsx      # Registration + 6-digit OTP verification
│   │   ├── DashboardScreen.tsx   # Home overview, instant meeting, join code, stats
│   │   ├── ScheduleScreen.tsx    # Scheduled calls, invitees, reminders, calendar
│   │   ├── HistoryScreen.tsx     # Meeting history logs and durations
│   │   ├── RoomScreen.tsx        # Live video meeting, chat, controls, reactions, hand-raise
│   │   └── SettingsScreen.tsx    # Profile edit, change password, server URL config
│   ├── services/            # auth.service, room.service, schedule.service
│   ├── theme/               # Colors matching SuperCall web dark theme
│   └── types/               # TypeScript interfaces
├── App.tsx                  # Main entry point & screen navigator
├── app.json                 # Expo project configuration & permissions
├── package.json
└── tsconfig.json
```
