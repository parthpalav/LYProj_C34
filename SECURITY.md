# FINAURA Security Policy & Architecture

## 1. Educational & Research Purpose Notice

> [!IMPORTANT]
> **FINAURA is an educational and research financial-planning application and NOT a regulated financial institution, banking service, registered investment advisor, or custodial platform.** It does not execute monetary transactions, hold real deposits, or provide certified accounting advice.

---

## 2. Trust Boundaries & Architecture

```
┌────────────────────────────────────────────────────────┐
│               Client Applications                      │
│   • React Native Mobile App (Expo SecureStore)         │
│   • React / Vite Web Client (sessionStorage)          │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / Restricted CORS
                           ▼
┌────────────────────────────────────────────────────────┐
│            Express API Gateway (Port 4000)             │
│   • Helmet Security Headers (HSTS in production)       │
│   • Strict CORS Allowlist (Native / no-Origin allowed) │
│   • Scoped Body Parsing: 4.5MB avatar, 1MB API global  │
│   • Targeted Rate Limiters (Auth, Chat, Classify)      │
│   • JWT Authentication (HS256, 15m access token)       │
│   • Centralized Sanitized Error Boundary               │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
   Internal HTTP Network Isolation        │ Mongoose (TLS in prod)
               │                          │
               ▼                          ▼
┌──────────────────────────────┐ ┌──────────────────────┐
│  Python ML Service (Port 5001)│ │  MongoDB Database    │
│  • 1MB MAX_CONTENT_LENGTH     │ │  • Multi-tenant keys │
│  • Bounded Monte Carlo (50k)  │ │  • Hashed passwords  │
│  • Strict Finite Type Checks  │ │  • Hashed tokens     │
└──────────────────────────────┘ └──────────────────────┘
```

---

## 3. Authentication & Credential Hygiene

1. **Access Tokens**:
   - Short-lived JSON Web Tokens (15-minute expiration).
   - Signed using `HS256` with an explicit algorithm allowlist during verification.
   - Requires a dedicated `JWT_SECRET` with minimum 32 characters in all environments; startup fails fast on missing or placeholder values.

2. **Refresh Tokens**:
   - Stored in MongoDB solely as SHA-256 hashes (`tokenHash`).
   - 7-day expiration with single-use rotation and automatic reuse detection (invalidating all sessions if an expired/reused token is presented).

3. **Password Security**:
   - Salted and hashed using `bcryptjs` (cost factor 10).
   - Password and hash fields are configured with `select: false` in Mongoose schemas.
   - User serialization utilities (`stripUser`) never return credential fields.

4. **Account Lockout**:
   - Progressive lockout after 5 consecutive failed login attempts, locking the account for 15 minutes.

5. **Password Reset**:
   - Cryptographically random reset tokens stored as SHA-256 hashes with 15-minute TTL.
   - Generic response on password reset initiation to prevent user enumeration.

---

## 4. Input Validation & Defense-in-Depth

1. **Numeric Financial Values**:
   - Explicit finite checks (`Number.isFinite(value)`) across all balance, transaction, income, asset, and profile controllers.
   - Rejects `NaN`, `Infinity`, and `-Infinity`.

2. **Payload Size Controls**:
   - Scoped parser allocates up to 4.5 MB for `PUT /api/user/profile` to support valid base64 avatar photos (validated up to 4,000,000 characters).
   - General API body parser strictly limits all other JSON endpoints to 1 MB.
   - Payloads exceeding bounds receive standard HTTP 413 (`PayloadTooLargeError`).

3. **Rate Limiting**:
   - Auth endpoints: 20 attempts / 15 minutes.
   - Password reset: 10 requests / 1 hour.
   - AI Chat (`/api/agent/chat`): 30 requests / 15 minutes.
   - ML Classification (`/api/classify`): 60 requests / 15 minutes.
   - Predictability Scenario (`/api/predictability/scenario`): 30 requests / 15 minutes.
   - Higher headroom configured under `NODE_ENV=test` with environment variable overrides.

4. **Multi-Tenancy & Authorization**:
   - All financial mutations and queries derive the authoritative `userId` from verified JWT claims (`req.user.id`).
   - Route parameters (`:id`) cross-validate ownership; foreign records return 404/403.

---

## 5. Logging & Error Sanitization

1. **No Credentials in Logs**:
   - Custom logger automatically redacts sensitive keys: `password`, `token`, `secret`, `jwt`, `gemini`, `apiKey`, `authorization`, `cookie`.
   - MongoDB connection logs confirm success without printing the URI or credentials.

2. **Production Error Boundary**:
   - Uncaught route exceptions return a uniform `{ "message": "Internal server error" }` without leaking stack traces, file system paths, or Mongoose internals.

---

## 6. Known Architectural Limitations

The following items are recognized architectural characteristics of the current release:

1. **Web Client Token Storage**:
   - Web application tokens are stored in browser `sessionStorage` (isolated to the tab session) rather than `HttpOnly` / `SameSite=Strict` cookies. In production environments with shared domain cookies, migrating to server-set `HttpOnly` cookies provides enhanced defense against XSS.

2. **Process-Local Rate Limiting**:
   - Rate limiters use in-memory counters (`express-rate-limit`). In a horizontally scaled cluster behind a load balancer, a centralized store (e.g., Redis) is recommended to enforce cluster-wide quotas.

3. **Internal Microservice Isolation**:
   - The Flask ML microservice does not require mTLS or API keys from Express; it relies on network isolation (loopback or VPC container network).

4. **Development MongoDB Encryption**:
   - Local development MongoDB instances run unauthenticated without TLS. Production deployments require explicit authenticated `mongodb+srv://` connection strings with TLS.

5. **Multi-Factor Authentication (MFA)**:
   - MFA / 2FA is not currently implemented.

---

## 7. Reporting Security Vulnerabilities

To report a vulnerability or security defect, please open a private security advisory on GitHub or contact the maintainers directly. Do not disclose suspected vulnerabilities in public forums.
