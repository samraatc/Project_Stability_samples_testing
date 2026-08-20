# Backend Architecture Documentation

## Technology Stack

- **Runtime**: Node.js (>=20.19.0)
- **Framework**: Express.js with TypeScript
- **Database ODM**: Mongoose (MongoDB ODM)
- **Validation**: Zod schema validation middleware
- **Authentication**: JWT (JSON Web Tokens) with bcrypt password hashing
- **Documentation**: Swagger UI / OpenAPI specification (`/api-docs`)

## Core Directory Structure

```
server/src/
├── config/          # Database, Environment, Swagger configuration
├── constants/       # Permissions definitions, domain constants
├── middlewares/     # Auth, Authorize, Request Logger, Error Handler, Validation
├── modules/         # Feature modules
│   ├── audit/       # Audit log model, service, and routes
│   ├── auth/        # Auth controller, service, token models, routes, seed data
│   ├── backups/     # Backup model, scheduler, routes, export/import service
│   ├── batches/     # Batch model and routes
│   ├── categories/  # Category model and routes
│   ├── health/      # Service health check controller and routes
│   ├── products/    # Product model and routes
│   ├── roles/       # Role model, repository, routes
│   ├── samples/     # Stability Sample model, validation, service, routes
│   ├── sections/    # Section model and routes
│   ├── settings/    # System settings model and routes
│   └── users/       # User model, repository, service, routes
├── app.ts           # Express app setup and middleware configuration
└── server.ts        # Server entrypoint and DB connection lifecycle
```

## Middleware Pipeline

1. **Helmet & CORS**: Protects headers and enables configured cross-origin requests.
2. **Request Logger & Rate Limiter**: Logs HTTP calls and prevents brute-force attempts.
3. **Authentication Middleware**: Verifies Bearer JWT access tokens and populates `req.user`.
4. **Authorization Middleware**: Checks user permissions against required keys (e.g. `products:read`, `samples:manage`).
5. **Zod Validation Middleware**: Validates incoming request params, query strings, and body payloads.
6. **Error Handler Middleware**: Standardizes error responses into clean JSON formats.
