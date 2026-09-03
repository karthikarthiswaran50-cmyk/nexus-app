# Nexus - Real-Time Video, Audio Calling, Chat & Subscription Platform

A production-ready full-stack real-time web application built with **React 19**, **TypeScript**, **Tailwind CSS**, **Node.js**, **Express**, **Socket.IO**, native **WebRTC**, **PostgreSQL / Prisma**, and **Stripe**.

---

## 🌟 Production Architecture & Features

### 1. 🗄️ Database (PostgreSQL + Prisma ORM)
- Schema with migrations for Users, Subscriptions, Invoices, UserSettings, Conversations, Messages, and CallLogs.
- Production PostgreSQL connection pooling with automated SQLite fallback for local development.

### 2. 💳 Real Payment Gateway (Stripe)
- **Stripe Checkout Sessions**: Recurring subscriptions for Pro ($9.99/mo) and Ultra VIP ($24.99/mo).
- **Stripe Customer Portal**: Self-serve customer billing management (update cards, view official receipts, cancel renewal).
- **Stripe Webhooks**: Signature-verified endpoint handling `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_succeeded`.

### 3. 📹 WebRTC Audio & Video Calling + TURN/STUN Configuration
- **P2P Encrypted Calling**: 1-on-1 HD Video and Audio calls.
- **Dynamic ICE / TURN Discovery**: `/api/webrtc/config` endpoint providing STUN + configured Coturn / Metered / Twilio TURN servers for guaranteed firewall and mobile NAT traversal.
- **In-Call Controls**: Mic mute, Camera toggle, Screen sharing (`getDisplayMedia`), Fullscreen, floating PIP preview, and live In-Call Chat drawer.
- **Synthesized Ringtones**: Web Audio API ringback tones, harmonic incoming chimes, and call-end sounds.

### 4. 🔒 HTTPS & Security Setup
- Native Node.js HTTPS server mode (`HTTPS_ENABLED=true`).
- Automated local SSL generator script (`npm run ssl:generate`).
- **Helmet** security headers (HSTS, XSS protection, MIME sniffing protection).
- **Express Rate Limiting** against brute force on auth and API endpoints.

### 5. 🚀 Production Hosting & Cloud Blueprints
- **Docker Multi-Stage Build**: Optimized container running lightweight Alpine Node.js.
- **Docker Compose Stack**: `App` + `PostgreSQL 16` + `Coturn STUN/TURN` + `Nginx SSL Reverse Proxy`.
- **1-Click Blueprints**:
  - `render.yaml` for Render deployment with Managed PostgreSQL.
  - `railway.json` for Railway deployment.
  - `deploy.sh` automated deployment script for Ubuntu VPS.

---

## 🚀 Getting Started

### Local Development
```bash
# 1. Start Server
npm --prefix server run dev

# 2. Start Client (Vite)
npm --prefix client run dev
```

### Production Build & Run
```bash
# 1. Build both server and client
npm run build

# 2. Start single-port production server on http://localhost:5000
npm start
```

### Running with Docker Compose
```bash
docker-compose up -d --build
```

---

## 🔑 Environment Variables (`.env`)

Copy `.env.example` to `.env` and fill in your keys:
```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://nexus_user:nexus_secure_password_2026@localhost:5432/nexus_db
JWT_SECRET=your_jwt_secret_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
TURN_URL=turn:localhost:3478
TURN_USERNAME=nexus_user
TURN_CREDENTIAL=nexus_turn_password_2026
```
