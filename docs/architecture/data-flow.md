# Data Flow & API Integration Architecture

## Request Lifecycle

```
[User Action / UI Event]
       │
       ▼
[React Component / Custom Hook]
       │
       ▼
[TanStack Query (Cache / Mutation)]
       │
       ▼
[Axios API Client (lib/api.ts)]
       ├── Inject Bearer Token
       └── Intercept 410/401 -> Refresh Token Flow
       │
       ▼
[Express Server Middleware Stack]
       ├── CORS & Helmet
       ├── Request Logger
       ├── Authenticate (Verify Access Token)
       ├── Authorize (Check Permission Keys)
       └── Validate (Zod Schema Validation)
       │
       ▼
[Domain Controller / Route Handler]
       │
       ▼
[Mongoose ODM Query / Transaction]
       │
       ▼
[MongoDB Storage Engine]
```

## Authentication & Token Rotation Flow

1. User submits credentials to `POST /api/v1/auth/login`.
2. Server validates credentials, generates a short-lived Access Token (15m) and a long-lived Refresh Token (7d).
3. Refresh token hash stored in `refreshtokens` collection; HTTP-only cookie set.
4. Client stores access token in memory/state and includes `Authorization: Bearer <token>` header on requests.
5. On access token expiry (401 response), client interceptor calls `POST /api/v1/auth/refresh-token` to exchange refresh token for a new access token.

## Stability Sample Data Flow

1. **Registration**: User selects Product, Batch, Section, Charging Date, and Pull Intervals (e.g. 3, 6, 9, 12 months).
2. **Auto-Coding**: Server generates sequential code `STB-<YEAR>-<SEQ>` and initializes sample status as `registered`.
3. **Execution**: Sample transitions to `running`. The dashboard calendar calculates upcoming pull dates dynamically (`chargingDate` + `interval months`).
4. **Reporting**: Sample protocol records are exported to Excel XML or CSV format with populated product, batch code, and interval pull schedules.
