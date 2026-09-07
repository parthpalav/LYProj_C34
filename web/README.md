# FINAURA Web Application (Intelligence & Analytics Portal)

This is the secondary web frontend for the FINAURA platform, focused on deep financial analytics, historical tracking, FMI explainability, spending analysis, behavioural insights, income analysis, assets and liabilities, net worth, financial planning, FIRE projections, and reports.

---

## 1. Product Role: Web vs Mobile

| Dimension | Mobile App (`/client`) | Web Application (`/web`) |
| :--- | :--- | :--- |
| **Primary Focus** | Everyday money management ("Manage your money") | Deep financial analytics ("Understand your money") |
| **Core Tasks** | Daily transaction logging, quick FMI glance, liability reminders, on-the-go nudges | Time-series trends, FMI factor explainability, FIRE projections, net worth tracking, exports |
| **Platform** | React Native (Expo) on iOS/Android | React 19 + TypeScript + Vite on desktop/tablet/mobile browsers |
| **Backend Integration** | Express REST API (`:4000`) | Express REST API (`:4000`) — exact same backend & data models |

---

## 2. Prerequisites

* Node.js >= 18 (Tested on Node 26)
* npm >= 9
* Running FINAURA Express backend on port `4000` (default)
* Running Python ML microservice on port `5001` (optional for classification & Monte Carlo)

---

## 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default contents:
```env
# Backend Express REST API base URL
VITE_API_URL=http://localhost:4000
```

> **Security Rule**: Only environment variables prefixed with `VITE_` are exposed to the client bundle. Never store server secrets, database credentials, or JWT signing keys in the web package.

---

## 4. How to Run

### Development
```bash
cd web
npm install
npm run dev
```
The Vite dev server starts on `http://localhost:5173`.

### Typecheck & Lint
```bash
npm run typecheck    # Runs tsc -b
npm run lint         # Runs oxlint
```

### Production Build
```bash
npm run build        # Typechecks and builds to dist/
npm run preview      # Serves the production build locally
```

### Running Backend API
```bash
cd ../server
npm start            # Starts Express server on port 4000
```

---

## 5. Authentication Architecture & Storage Strategy

* **Token Types**:
  * **Access Token**: Short-lived JWT (15-minute expiry) carrying identity payload `{ id, _id, email }`. Attached as `Authorization: Bearer <token>` on all authenticated requests.
  * **Refresh Token**: 32-byte cryptographic random string with rotating SHA-256 hash tracking (7-day expiry) and automatic reuse detection.
* **Storage Location (Interim Strategy)**:
  * Stored in `sessionStorage` (`finaura_web_access_token` and `finaura_web_refresh_token`).
  * Tokens survive in-tab page reloads within the same session.
  * Closing the browser tab/session clears the session.
  * Tokens are **never** stored in persistent `localStorage`.
* **Automatic Refresh & Rotation**:
  * On a `401 TOKEN_EXPIRED` response, the Axios interceptor halts and queues concurrent requests, calls `/api/auth/refresh` once, saves the newly rotated token pair in `sessionStorage`, and retries the original requests.
* **Production Hardening Note**:
  * This `sessionStorage` Bearer strategy is an interim academic compromise maintaining exact compatibility with the existing Express API and mobile app contract.
  * For production hardening, the web client should preferably be migrated to secure, HTTP-only, `SameSite=Strict` refresh cookies with CSRF mitigation to fully isolate refresh tokens from client-side script contexts.

---

## 6. Route Architecture

### Public Routes
* `/` — Public Landing Page (Product overview, 3 pillars, mobile+web positioning, account isolation note)
* `/login` — Account Sign In (Show/hide password, error handling, session bootstrap)
* `/register` — Account Registration (Name, email, password complexity validation matching Zod schema)
* `/forgot-password` — Password Reset Request
* `/reset-password` — Password Reset Confirmation (Token + new password)

### Protected Routes (Under `/app`)
* `/app` — Overview Dashboard (Part 3 destination)
* `/app/activity` — Money / Activity Ledger (Transactions, income, recurring liabilities)
* `/app/insights` — Understand / Insights (Spending trends, FMI factor explainability, behavior patterns)
* `/app/plan` — Future / Plan (Net worth, assets, liabilities, goals, FIRE projections)
* `/app/reports` — Documents / Reports (Weekly pacing, monthly summaries, yearly heatmaps, CSV exports)
* `/app/profile` — User Profile & Modeling Assumptions
* `/app/settings` — Web Settings & Session State

Unauthenticated requests to `/app/*` redirect automatically to `/login`. Authenticated visits to `/login` or `/register` redirect automatically to `/app`. Unknown paths route to the `/404` Not Found screen.
