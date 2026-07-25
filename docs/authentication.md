# Authentication & Authorization

## Session model

- **Access token** — short-lived JWT (default 15 min, `ACCESS_TOKEN_TTL_MINUTES`),
  returned in the response body and sent as `Authorization: Bearer <token>`.
  The client keeps it in memory only.
- **Refresh token** — opaque random value in an `httpOnly`, `SameSite=Strict`
  cookie scoped to `/api/v1/auth`. Only its SHA-256 hash is stored. Default
  lifetime 7 days, or 30 days with **Remember me**
  (`REFRESH_TOKEN_TTL_DAYS` / `REFRESH_TOKEN_REMEMBER_TTL_DAYS`).
- **Rotation** — every `/auth/refresh` revokes the presented token and issues
  a new one. Replaying a revoked token is treated as theft: all of the
  user's sessions are revoked and an `auth.token.reuse-detected` audit entry
  is written.
- `authenticate` middleware loads the user fresh from MongoDB on every
  request, so deactivation, deletion, role changes, and lockouts apply
  immediately. Tokens issued before the last password change are rejected.

## Endpoints (`/api/v1/auth`)

| Method | Path               | Auth   | Purpose                                                      |
| ------ | ------------------ | ------ | ------------------------------------------------------------ |
| POST   | `/login`           | —      | Email + password (+ `rememberMe`); sets refresh cookie       |
| POST   | `/refresh`         | cookie | Rotate refresh token, new access token                       |
| POST   | `/logout`          | cookie | Revoke session, clear cookie                                 |
| GET    | `/me`              | Bearer | Current user with role and permissions                       |
| POST   | `/change-password` | Bearer | Change password; revokes all sessions                        |
| POST   | `/forgot-password` | —      | Request reset link (never reveals account existence)         |
| POST   | `/reset-password`  | —      | Set new password with emailed token (30 min TTL, single use) |

Login, forgot-password, and reset-password share a stricter rate limit
(20 requests / 15 min) on top of the global API limiter.

## Account protection

- **Password policy** — minimum 10 characters with lower, upper, digit, and
  special character (`passwordSchema`, enforced by Zod on every
  password-accepting endpoint). Hashing: bcrypt, 12 rounds.
- **Lockout** — 5 consecutive failed logins lock the account for 15 minutes
  (HTTP 423). Successful login resets the counter.
- **Login history** — every attempt (success or failure, including unknown
  emails) is recorded with IP, user agent, and reason.
- **Audit log** — login, logout, password change/reset, reset requests, and
  token-reuse detections are written to the `AuditLog` collection.
- **2FA** — `twoFactorEnabled` field and API surface are in place as hooks;
  TOTP enrollment/verification ships in a later phase.

## RBAC / PBAC

Roles and their permissions are defined in
[`server/src/constants/permissions.ts`](../server/src/constants/permissions.ts)
and seeded idempotently (`npm run seed --workspace server`). Guards:

```ts
router.get('/users', authenticate, requirePermission(PERMISSIONS.USERS_READ), handler);
router.post('/backups', authenticate, authorize(ROLE_NAMES.SUPER_ADMIN), handler);
```

`requirePermission` (PBAC) is preferred for feature access; `authorize`
(RBAC) is for role-exclusive areas. Role permission sets for QA, QC,
Analyst, Data Entry, and Viewer are populated as their modules land.

## Seeding the first user

```bash
npm run seed --workspace server
```

Creates the seven system roles and a super admin
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, defaults in `.env.example`).
Change the password immediately after first login.

## Client integration

- `client/src/lib/api.ts` — Axios instance; attaches the in-memory access
  token, transparently refreshes once on 401, deduplicates concurrent
  refreshes.
- `AuthProvider` bootstraps the session from the refresh cookie on page
  load; `ProtectedRoute` gates authenticated pages and redirects to
  `/login`.
