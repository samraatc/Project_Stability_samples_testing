# ESMS Architecture

## Overview

The ESMS is an npm-workspaces monorepo with two applications:

| Workspace | Stack                                     | Purpose      |
| --------- | ----------------------------------------- | ------------ |
| `client/` | React 19, Vite, TypeScript, Tailwind CSS  | SPA frontend |
| `server/` | Express 5, TypeScript, MongoDB (Mongoose) | REST API     |

## Backend layering

Requests flow through the layers in one direction only:

```
Route → Middleware → Controller → Service → Repository → Model (Mongoose)
```

- **Routes** (`src/modules/<feature>/<feature>.routes.ts`) — URL wiring and
  OpenAPI annotations only.
- **Controllers** — translate HTTP to service calls; no business logic.
- **Services** — business logic; throw `AppError` for operational failures.
- **Repositories** — data access; the only layer that touches Mongoose
  models (introduced from Phase 2 onward with the first domain models).
- **Middlewares** (`src/middlewares/`) — cross-cutting concerns: request
  logging, error handling, and (from Phase 2) authentication/authorization.

Feature code is grouped by module under `src/modules/<feature>/`, keeping
controller, service, repository, validation, and tests colocated.

## Cross-cutting infrastructure

- **Configuration** — `src/config/env.ts` validates all environment
  variables with Zod at startup; the process exits on invalid config.
- **Logging** — Winston (`src/utils/logger.ts`); human-readable in
  development, JSON in production, silent in tests.
- **Error handling** — `AppError` for expected failures; the global error
  handler hides internals in production and logs everything.
- **API docs** — swagger-jsdoc annotations on routes, served at
  `/api/docs`.
- **Security baseline** — Helmet, CORS restricted to the client origin,
  rate limiting on `/api`, JSON body size limits.

## Frontend conventions

- Path alias `@/` → `client/src/`.
- Dev server proxies `/api` to the backend (no CORS friction locally).
- TanStack Query for server state, React Router for navigation, Axios as
  the HTTP client (wired into feature code from Phase 2 onward).

## Runtime topology (Docker Compose)

```
client (nginx :8080) ── /api/* ──> server (node :5000) ──> mongo (:27017)
                                                      └──> redis (:6379)
```

Nginx serves the built SPA and proxies `/api/` to the server container, so
the browser talks to a single origin in production.
