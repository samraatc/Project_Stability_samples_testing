# Enterprise Stability Management System (ESMS)

A pharmaceutical stability management platform replacing spreadsheet-based
workflows with a secure, scalable, modular web platform. MERN stack, strict
TypeScript, Clean Architecture.

> **Start here:** [ESMS_FINAL_MASTER_DOCUMENT.md](ESMS_FINAL_MASTER_DOCUMENT.md)
> is the single source of truth. [PROJECT_MEMORY.md](PROJECT_MEMORY.md)
> tracks the current milestone.

## Repository layout

```text
├── client/    React 19 + Vite + TypeScript + Tailwind CSS
├── server/    Express 5 + TypeScript + MongoDB (Mongoose)
├── docker/    Dockerfiles and nginx config
├── scripts/   Operational scripts (seeding, backups)
├── docs/      Architecture and design documentation
└── docker-compose.yml
```

## Prerequisites

- Node.js >= 20.19 (developed on Node 24)
- npm >= 10
- Docker (for MongoDB/Redis and containerized runs)

## Getting started

```bash
# Install all workspace dependencies
npm install

# Start MongoDB + Redis only (local development)
docker compose up -d mongo redis

# Configure the server environment
cp server/.env.example server/.env

# Seed system roles and the initial super admin
npm run seed --workspace server

# Run backend (http://localhost:5000) and frontend (http://localhost:5173)
npm run dev:server
npm run dev:client
```

Sign in with the seeded super admin (`admin@esms.local` /
`ChangeMe!2026#Admin` by default — change it immediately). Authentication
details: [docs/authentication.md](docs/authentication.md).

- API base: `http://localhost:5000/api/v1`
- Health check: `GET /api/v1/health`
- Swagger docs: `http://localhost:5000/api/docs`
- The Vite dev server proxies `/api` to the backend.

## Scripts (run from repo root)

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `npm run dev:server` | Start API in watch mode (tsx) |
| `npm run dev:client` | Start Vite dev server         |
| `npm run build`      | Build all workspaces          |
| `npm run lint`       | Lint all workspaces           |
| `npm run typecheck`  | Type-check all workspaces     |
| `npm test`           | Run all workspace test suites |
| `npm run format`     | Format the repo with Prettier |

## Full containerized stack

```bash
docker compose up --build
```

Serves the SPA at `http://localhost:8080` (nginx, proxying `/api` to the
server container) with MongoDB and Redis.

## Development rules

- One milestone at a time, in the order defined in the master document.
- Every feature must meet the Definition of Done (implementation,
  validation, authorization, tests, docs, logging, error handling).
- Update `PROJECT_MEMORY.md` after every completed task, then commit.
