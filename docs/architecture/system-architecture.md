# System Architecture Documentation

## Overview

The Enterprise Stability Management System (ESMS) is an enterprise-grade pharmaceutical stability management platform built on the MERN stack (MongoDB, Express.js, React, Node.js) with TypeScript across both frontend and backend.

```
+-----------------------------------------------------------------------+
|                               Client                                  |
|  React 18 + TypeScript + Vite + TailwindCSS + TanStack Query          |
|  (Single Page Application with RBAC / PBAC route guards)             |
+-----------------------------------+-----------------------------------+
                                    | HTTP / REST API (JWT Header)
                                    v
+-----------------------------------------------------------------------+
|                               Server                                  |
|  Node.js + Express.js + TypeScript                                    |
|  Middlewares: Auth (JWT), RBAC, Audit Logger, Rate Limiter, Helmet   |
+-----------------------------------+-----------------------------------+
                                    | Mongoose ODM (BSON)
                                    v
+-----------------------------------------------------------------------+
|                              Database                                 |
|  MongoDB (Document Store)                                            |
|  Collections: Users, Roles, Products, Sections, Batches, Samples, etc. |
+-----------------------------------------------------------------------+
```

## Monorepo Layout

The repository is structured as an `npm` workspace monorepo:
- `client/`: React single-page application built with Vite and TailwindCSS.
- `server/`: Express TypeScript REST API service interacting with MongoDB via Mongoose.
- `docs/`: Comprehensive technical, domain, and architecture documentation.

## Key Architectural Decisions

1. **Monorepo Design**: Simplifies code sharing, type safety alignment, and unified builds.
2. **Modular Backend Domain Architecture**: Feature modules (`auth`, `users`, `products`, `batches`, `samples`, `audit`, `backups`) encapsulate models, controllers/routes, validations, and services.
3. **Stateless JWT Authentication with Refresh Token Rotation**: Access tokens (15m expiry) accompanied by HTTP-only refresh tokens stored in MongoDB with token reuse detection.
4. **Audit Logging & Non-Destructive Data Policy**: Every write operation (Create, Update, Archive, Restore, Delete) logs structured audit events. Entities utilize soft deletion (`isDeleted` / `isArchived` flags) to preserve regulatory compliance history.
