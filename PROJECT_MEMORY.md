# ESMS Project Memory & Architectural Overview

> System memory document maintained and updated per development cycle requirements.

## 1. Project Purpose

The Enterprise Stability Management System (ESMS) is an enterprise pharmaceutical stability management platform designed for tracking drug stability protocols, pull schedules, testing intervals (3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36 months), batch lifecycle records, and regulatory compliance audit trails.

## 2. Tech Stack

- **Monorepo Architecture**: npm Workspaces (`client`, `server`)
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, TanStack Query v5, React Router v6, Lucide React, Recharts
- **Backend**: Node.js (>=20.19.0), Express.js, TypeScript, Mongoose ODM, Zod, JWT (Access/Refresh Tokens), bcrypt, Nodemailer
- **Database**: MongoDB (Document Store)
- **Tooling & Quality**: Vitest, Prettier, ESLint, Docker & Docker Compose

## 3. Directory & Folder Structure

```
├── client/                      # React Frontend Application
│   ├── src/
│   │   ├── components/          # AdminLayout, ProtectedRoute, RequirePermission, UI primitives
│   │   ├── features/            # Feature modules (admin, auth, catalog) with API calls & schemas
│   │   ├── pages/               # Page views (Dashboard, Products, Batches, Samples, Records, Admin)
│   │   └── lib/                 # Axios client instance (api.ts) with token refresh interceptors
├── server/                      # Express Backend REST API
│   ├── src/
│   │   ├── config/              # DB connection, env parsing, Swagger docs
│   │   ├── middlewares/         # Auth, RBAC authorization, Audit logging, Validation, Error handling
│   │   ├── modules/             # Domain modules (auth, users, roles, products, batches, samples, etc.)
│   │   └── app.ts & server.ts   # Application entrypoints
├── docs/                        # Project & Architecture Documentation
│   ├── architecture/            # Detailed system, frontend, backend, DB, data flow, Excel architecture
│   ├── admin.md                 # System administration documentation
│   ├── administration.md        # Core catalog management documentation
│   └── authentication.md       # Security and RBAC documentation
├── docker-compose.yml           # Local MongoDB & Node service containerization
├── package.json                 # Monorepo configuration
└── PROJECT_MEMORY.md            # System memory (this document)
```

## 4. Core Features

1. **Authentication & Security**:
   - Access tokens (15m) + HTTP-only Refresh tokens (7d) with automatic token rotation.
   - Account lockout after 5 consecutive failed login attempts.
   - Role-Based Access Control (RBAC) and Permission-Based Access Control (PBAC).
2. **Catalog Management**:
   - **Products**: Uppercase unique code, dosage form, strength, category.
   - **Sections**: Laboratory and manufacturing plant sections.
   - **Batches**: Per-product unique batch codes (`{ product, batchCode }` compound index), manufacture/expiry date validations.
   - **Stability Samples**: Protocol registration (`STB-<YEAR>-<SEQ>`), interval tracking, status lifecycle (`registered` -> `running` -> `completed`).
3. **Enterprise Dashboard**:
   - Dynamic interactive schedule calendar with **live current date highlighting**.
   - Operational schedules, KPI metrics cards, Recharts analytical breakdown, system health monitor.
4. **Excel & Reporting**:
   - Native Excel XML (`.xls`) and CSV export with horizontal interval pull matrix, explicit **Batch Code** field, and auto-fitted layout.
   - Excel/CSV import parser with batch code validation and entity resolution.
5. **System Administration**:
   - User management, role permission management, audit trail logs timeline, automated database backups.

## 5. Database Structure

- **`users`**: System accounts, password hashes, failed attempts, lockout status.
- **`roles`**: Assigned permission keys matrix (e.g. `products:read`, `samples:manage`).
- **`products`**: Product catalog (`code` unique, `storageConditions` preserved in DB).
- **`sections`**: Plant sections (`name` unique).
- **`batches`**: Batch records (compound unique index `{ product: 1, batchCode: 1 }`).
- **`stabilitysamples`**: Sample protocols (`sampleCode` unique, status/archive indexes).
- **`auditlogs`**: Immutable audit trails.
- **`refreshtokens`**: Active refresh token hashes with reuse detection.

## 6. Business Logic Rules

- **Batch Code Uniqueness**: Unique per product (`{ product, batchCode }`), allowing identical batch numbers across distinct products per pharmaceutical standards.
- **Interval Pull Date Logic**: Pull dates computed relative to `chargingDate` (`chargingDate + interval_months`).
- **Non-Destructive Field Policy**: Fields disabled from active UI (e.g. Storage Conditions / Chamber Conditions) remain intact in database models to safeguard historical records.

## 7. Known Dependencies & Integrations

- **MongoDB / Mongoose**: Primary persistence layer.
- **Nodemailer**: SMTP email notifications for system alerts.
- **Recharts**: Data visualization charts on the dashboard.
- **Vite & Vitest**: Fast compilation and unit/integration testing.

## 8. Important Implementation Decisions & Recent Updates

- **Storage / Chamber Conditions UI Disabling (2026-08-20)**: Safely hidden/commented out from active UI pages (Products, Records, Sample Detail, Dashboard) and Excel exports while preserving underlying DB columns.
- **Batch Code Excel Integration (2026-08-20)**: Explicitly exposed as a primary field/column across Excel XML and CSV exports/imports.
- **Dashboard Calendar Current Date Highlighting (2026-08-20)**: Dynamically highlights the current date based on system date/time.
