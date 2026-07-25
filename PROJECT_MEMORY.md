# ESMS Project Memory

> Updated after every completed task, per the Continuous Execution Loop in
> `ESMS_FINAL_MASTER_DOCUMENT.md`.

## Current Milestone

Phase 8 — Reporting & Dashboard (MERN Enterprise Dashboard & Navigation complete)

## Completed Modules

- **MERN Enterprise Dashboard & Navigation (2026-07-19)**:
  - **Collapsible Navigation Sidebar**: Left-aligned navigation panel with persist-to-localstorage collapsed state, Lucide icons, and nested accordion-style group menus for System Administration routes (Users, Roles, Audit Logs, Backups).
  - **Sticky Header Navigation**: Dynamic breadcrumbs, global search bar, dark/light theme toggler applying CSS dark variables, live notification bell showing upcoming/overdue pulls, and profile details drop-down.
  - **Dynamic Dashboard Page**: 10 KPI Cards (running filter redirects on click), 8 Recharts charts (monthly trends, product bar codes, status donuts, radial gauges, and operations charts), and 9 widgets (interactive calendar, operational schedules, audit logs timeline, system health pings, backup creators, and reports).
  - **Data Export & Toast Alerts**: Client-side CSV/Excel export for filtered data grids, and floating glassmorphic slide-up toast notices.

- **Phase 1 — Bootstrap (2026-07-13)**: monorepo, tooling, Docker, health
  module, docs.
- **Phase 2 — Auth (2026-07-13)**: JWT + rotating refresh tokens,
  lockout, login history, audit, RBAC/PBAC, seed, client auth flows.
- **Phase 3 — Super Admin core (2026-07-13)**: user/role management with
  escalation + last-super-admin guards, audit & login-history APIs, SMTP
  settings (Nodemailer live when enabled), admin UI.
- **Phase 4 — Administration core (2026-07-13)**:
  - **Products**: CRUD + archive/restore + soft delete, unique uppercase
    codes, search/pagination.
  - **Sections**: CRUD + archive/restore, unique names.
  - **Batches**: create/list/delete, per-product duplicate validation
    (compound unique index), expiry-after-manufacture validation,
    product populated in listings.
  - **Stability samples**: register (auto code `STB-<year>-<seq>`),
    validation (batch-belongs-to-product, date ordering, standard
    3–36-month intervals), clone, archive/restore, status transitions
    (registered/running/completed), filtered listings with populated
    refs.
  - **Permissions**: 8 new keys (`products|sections|batches|samples` ×
    `read|manage`) with role assignments (data-entry manages
    products/batches/samples; QA/QC/viewer read-only; analyst reads
    products/batches/samples).
  - **Client**: `/products`, `/sections`, `/batches`, `/samples` pages
    (search/filters/pagination, create forms, archive/restore, clone,
    status select; product→batch cascading selects); shared UI helpers
    (`components/ui.tsx`).
  - **Tests**: 75 passing (63 server / 12 client); 14 new server domain
    integration tests + client schema tests.
  - **Docs**: `docs/administration.md`.

## Pending Tasks

- Phase 4 deferred: Excel import/export, QR/barcode for batches, sample
  attachments (needs file management/Cloudinary), product bulk ops.
- Phase 3 remainder: company/site management, API keys, backups,
  monitoring; SMTP settings UI page.
- 2FA (TOTP).
- Phase 5 (QA/QC workflows) and Phase 7 (scheduler) are the next roadmap
  milestones; scheduler consumes `samples.intervals`.

## Known Issues / Bugs

- None.

## Technical Debt

- Sample code generation is count-based (`countDocuments + 1`) — fine at
  current volume, race-prone under concurrent bulk import; switch to a
  counter collection when import lands.
- SMTP password unencrypted at rest (from Phase 3).
- Domain routes use inline handlers (roles/settings pattern) rather than
  separate controller files; consistent but revisit if handlers grow.
- Client fetches product/section dropdowns with `limit: 100` — needs a
  typeahead once catalogs grow.

## Database Changes

- New collections: `products` (unique `code`), `sections` (unique
  `name`), `batches` (compound unique `{product, batchCode}`),
  `stabilitysamples` (unique `sampleCode`; status/archive indexes).

## API Changes

- `/api/v1/products` (GET/POST/PATCH/archive/restore/DELETE),
  `/api/v1/sections` (GET/POST/PATCH/archive/restore),
  `/api/v1/batches` (GET/POST/DELETE),
  `/api/v1/samples` (GET/POST/PATCH/clone/archive/restore/DELETE).

## UI Changes

- Four new catalog pages wired into the sidebar with permission gating.

## Decision Log

- (Earlier decisions: see git history of this file.)
- 2026-07-13: Domain permissions use two keys per entity
  (`read`/`manage`) instead of four CRUD keys — smaller matrix, adequate
  granularity for the role model.
- 2026-07-13: Batch codes unique **per product** (compound index), not
  globally — matches pharma practice where different products can share
  batch numbering schemes.
- 2026-07-13: Sample `intervals` stored on the sample (validated against
  the standard 3–36 month pull points) so the Phase 7 scheduler can
  generate per-interval schedules without schema changes.
- 2026-07-13: Sample statuses limited to registered/running/completed for
  now; QA approval states arrive with Phase 5 workflow.

## Next Priority

Phase 7 — Automatic Scheduler is recommended next (generates
`StabilitySchedule` entries from `samples.intervals`, daily cron for
due/overdue computation, notifications) since it delivers the system's
core value; Phase 5 (QA/QC workflow) can follow with approval states
layered onto samples and schedules.
