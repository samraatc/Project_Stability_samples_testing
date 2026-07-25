# Enterprise Stability Management System (ESMS)

## Final Master Document — Specification + Execution Prompts

> **Purpose**
>
> This is the single consolidated source of truth for building the ESMS.
> It merges the Master Development Guide (full specification) with the
> Claude Code Master Prompts (phase-by-phase execution prompts) into one
> operational document. Work through the phases in order. After every
> completed phase, update `PROJECT_MEMORY.md`.

---

# Part I — Global Context

## Global System Prompt

> You are the lead enterprise software architect responsible for building a
> production-ready Enterprise Stability Management System (ESMS) using the
> MERN stack. Follow Clean Architecture, MVC, Repository + Service Pattern,
> SOLID principles, strict TypeScript, enterprise security, and
> pharmaceutical best practices. Never skip testing, documentation, linting,
> or refactoring. Complete one milestone at a time and update project memory
> before moving to the next.

## Vision

Build an enterprise-grade Stability Management System that replaces
spreadsheet-based workflows with a secure, scalable, modular web platform.

**Objectives:** GMP/GxP-inspired architecture · Enterprise security ·
Modular development · Role-based access · Automatic stability scheduling ·
Reporting & analytics · AI-ready architecture · Docker & CI/CD ready.

## Technology Stack

| Layer    | Technologies                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Axios, React Hook Form, Zod, Recharts, Framer Motion      |
| Backend  | Node.js, Express.js, TypeScript, MongoDB, Mongoose, JWT + Refresh Tokens, Multer, Cloudinary, Nodemailer, Winston, Swagger, Redis, Node Cron |

## Project Structure

```text
enterprise-stability-management-system/
├── client/
├── server/
├── docker/
├── scripts/
├── docs/
└── README.md
```

Layered architecture: **Controller → Service → Repository → Model**, plus
Validation, Middleware, and Utility layers. Follow SOLID principles and
dependency inversion.

## User Hierarchy

1. Super Admin
2. Administrator
3. QA Manager
4. QC Manager
5. Laboratory Analyst
6. Data Entry Operator
7. Viewer

Authorization combines **RBAC and PBAC** through a configurable permission
matrix.

## Database Models

User, Role, Permission, Product, Section, Batch, StabilitySample,
StabilitySchedule, TestResult, Report, Notification, AuditLog, ActivityLog,
Attachment, Company, Backup, SystemSettings.

Every model includes: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`,
`status`, `softDelete`.

## Coding Standards

- Strict TypeScript
- Repository Pattern + Service Layer + MVC
- REST APIs with Swagger documentation
- Modular folders, reusable components, consistent naming conventions
- 90%+ test coverage target
- Structured logging (Winston)

## Definition of Done (applies to every feature)

Functional implementation · Validation · Authorization · Tests ·
Documentation · Logging · Error handling · Responsive UI ·
Accessibility review · Security review.

---

# Part II — Development Phases (Roadmap + Execution Prompts)

Execute the phases in order. Each phase lists its **scope** (from the
specification) and its **execution prompt** (verbatim intent from the
prompt playbook).

## Phase 1 — Project Bootstrap

**Roadmap steps:** 1. Repository Setup · 2. Backend Architecture · 3. Frontend Architecture

**Execution prompt:**

> Create the complete folder structure, configure React (Vite), Express,
> MongoDB, TypeScript, Docker, ESLint, Prettier, Husky, environment
> variables, logging, Swagger, and shared coding standards.

## Phase 2 — Authentication & Authorization

**Roadmap steps:** 4. Authentication · 5. RBAC/PBAC

**Scope:** JWT, Refresh Tokens, Secure Cookies, Remember Me, Session
Timeout, Password Policy, MFA (2FA), Forgot/Reset Password, Login History,
Account Lock, Audit Logs, Protected Routes.

**Execution prompt:**

> Implement JWT authentication, refresh tokens, RBAC, PBAC, password
> policy, 2FA hooks, audit logging, secure cookies, login history, account
> lockout, and protected routes.

## Phase 3 — Super Admin Module

**Roadmap step:** 6. Super Admin

**Scope:** Company Management, Site Management, Users, Roles, Permissions,
SMTP, API Keys, Security Policies, Backups, Audit Logs, Monitoring.

**Execution prompt:**

> Build the Super Admin module including company management, users, roles,
> permissions, laboratories, SMTP, settings, backups, audit logs,
> monitoring, and dashboards.

## Phase 4 — Administration Module

**Roadmap step:** 7. Admin

**Scope:**

- **Products:** CRUD with Categories, Dosage Forms, Strength, Storage
  Conditions, Archive/Restore, Search, Pagination, Import/Export.
- **Batches:** Batch Code, QR, Barcode, Duplicate Validation, Excel
  Import/Export.
- **Stability Samples:** Product, Batch, Section, Manufacturing Date,
  Expiry Date, Charging Date, Stability Type, Quantity, Interval, Status,
  Attachments — with CRUD, Clone, Archive, Restore, Bulk Import/Export.

**Execution prompt:**

> Implement Product, Section, Batch, Stability Sample, Import/Export,
> Notifications, Reports, and analytics.

## Phase 5 — QA / QC Modules

**Roadmap steps:** 8. QA · 9. QC

**Scope:** QA — Review, Approvals, Scheduling, Reports, Workflow.
QC — Assign Tests, Review Results, Instruments, Batch Monitoring.

**Execution prompt:**

> Implement QA approvals, QC assignment workflow, laboratory scheduling,
> review process, and stability status tracking.

## Phase 6 — Analyst & Data Entry Modules

**Roadmap steps:** 10. Analyst · 11. Data Entry · 12. Viewer

**Scope:** Analyst — Assigned Samples, Results, Upload Reports, Remarks.
Data Entry — Products, Batches, Samples, Excel Import.
Viewer — read-only dashboards and reports.

**Execution prompt:**

> Create analyst dashboards, assigned samples, result entry, uploads,
> remarks, completion workflow, and validations.

## Phase 7 — Automatic Scheduler

**Roadmap step:** 13. Scheduler

**Scope:** Generate intervals at **3, 6, 9, 12, 15, 18, 21, 24, 27, 30,
33, 36 months**. Daily cron jobs compute Due Date, Remaining Days,
Overdue, Completed, and Notifications.

**Execution prompt:**

> Implement the automatic stability scheduler with cron jobs, due dates,
> reminders, overdue detection, and notification generation.

## Phase 8 — Reporting & Dashboard

**Roadmap step:** 14. Reports

**Scope:**

- Reports: Daily, Weekly, Monthly, Quarterly, Yearly, Product, Batch,
  Pending, Completed, Upcoming, Overdue. Export to PDF, Excel, CSV, Print.
- Dashboard KPIs: Total Samples, Running, Pending, Completed, Upcoming,
  Overdue, Product Distribution, Section Distribution, Trends, User
  Activity.

**Execution prompt:**

> Generate PDF, Excel, CSV, print-ready reports with filtering and
> dashboards.

## Phase 9 — Notifications, Audit Logs & Search

**Roadmap steps:** 15. Notifications · 16. Audit Logs · 17. Search

**Scope:**

- **Notifications** — Channels: Email, In-App, Scheduled. Triggers:
  Upcoming Tests, Overdue, Approvals, Expired Batch, Failed Login, System
  Alerts.
- **Audit Logs** — Track CRUD, Login/Logout, Import/Export, Permissions,
  Password Changes, Browser, Device, IP, Timestamp.
- **Search** — Global search over Products, Batches, Samples, Reports,
  Users, Audit Logs with Exact, Partial, Fuzzy, Date Range, and Filters.
- **File Management** — Store PDF, Images, Word, Excel, Certificates via
  Cloudinary with metadata in MongoDB.

## Phase 10 — Optimization

**Roadmap step:** 18. Optimization

**Execution prompt:**

> Optimize APIs using indexing, aggregation, pagination, caching,
> compression, lazy loading, and background jobs.

## Phase 11 — Testing

**Roadmap step:** 20. Testing

**Execution prompt:**

> Write unit, integration, and end-to-end tests. Ensure enterprise-quality
> coverage and CI compatibility.

## Phase 12 — Deployment & Production

**Roadmap steps:** 19. Docker · 21. CI/CD · 22. Production

**Execution prompt:**

> Prepare Docker, Docker Compose, GitHub Actions, production environment
> variables, monitoring, backups, health checks, and deployment
> documentation.

**Production checklist:** Docker Compose · Environment variables · HTTPS ·
Redis · Mongo indexes · Backups · Monitoring · Health checks · CI/CD ·
Swagger · Versioning · Performance testing.

---

# Part III — Cross-Cutting Requirements

## Security (every phase)

Helmet, CORS, XSS Protection, CSRF Protection, Rate Limiting, Input
Validation, Password Hashing, Secure Cookies, Audit Logging.

## AI Roadmap (future modules)

Natural Language Search · Stability Prediction · OCR · Report Summaries ·
Risk Detection · AI Chat Assistant. Keep the architecture ready for these.

---

# Part IV — Execution Loop & Project Memory

## Continuous Execution Loop

For every iteration:

1. Read this document.
2. Read `PROJECT_MEMORY.md`.
3. Review completed work.
4. Select the next unfinished milestone.
5. Implement one feature.
6. Write unit tests.
7. Update documentation.
8. Run linting and type checks.
9. Refactor for SOLID principles.
10. Update `PROJECT_MEMORY.md`.
11. Commit changes.
12. Repeat until roadmap completion.

**Never skip testing, documentation, or refactoring.**

## Project Memory Template

Maintain in `PROJECT_MEMORY.md`, updated after every completed task:

- Current Milestone
- Completed Modules
- Pending Tasks
- Known Issues / Bugs
- Technical Debt
- Database Changes
- API Changes
- UI Changes
- Decision Log
- Next Priority

---

# End Goal

Deliver a scalable, secure, enterprise-grade pharmaceutical Stability
Management System suitable for production deployments, designed for future
AI capabilities while adhering to clean architecture, maintainability, and
enterprise engineering best practices.
