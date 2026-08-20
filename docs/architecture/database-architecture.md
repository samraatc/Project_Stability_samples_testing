# Database Architecture Documentation

## Overview

The database uses MongoDB with Mongoose ODM in TypeScript. Entity integrity and soft deletes are maintained across all collections.

## Collections & Schemas

### 1. `users`
- Stores system user credentials, status (`active`/`inactive`), role reference, force password change flag, failed login attempts, and lockout timestamps.

### 2. `roles`
- Defines roles (e.g. `Super Admin`, `QA Manager`, `QC Analyst`, `Data Entry Operator`) and assigned permission keys.

### 3. `products`
- Stores product catalog records: `name`, `code` (uppercase unique), `category`, `dosageForm`, `strength`, `storageConditions` (preserved in schema).

### 4. `sections`
- Stores plant/laboratory sections with unique `name`.

### 5. `batches`
- Stores product manufacturing batches: `product` (ObjectId ref), `batchCode` (String), `manufacturingDate`, `expiryDate`, `size`, `unit`.
- Compound Unique Index: `{ product: 1, batchCode: 1 }` (per-product unique batch codes).

### 6. `stabilitysamples`
- Core stability protocol collection:
  - `sampleCode` (Unique auto-generated code, e.g. `STB-2026-0001`)
  - `product` (ObjectId ref to Product)
  - `batch` (ObjectId ref to Batch)
  - `section` (ObjectId ref to Section)
  - `stabilityType` (e.g. `Accelerated`, `Real Time`, `Intermediate`)
  - `chargingDate`, `manufacturingDate`, `expiryDate`
  - `quantity`, `intervals` (Array of month numbers: e.g. `[3, 6, 9, 12, 18, 24, 36]`)
  - `status` (`registered`, `running`, `completed`)
  - `remarks`, `isArchived`, `isDeleted`

### 7. `auditlogs` & `loginhistories`
- Stores append-only audit trail and user login attempt records.

## Data Preservation Policy

- No collections or fields are dropped or cleared during feature updates or UI field disabling.
- Database records utilize `isDeleted: false` soft-delete filtering so historical compliance data is preserved indefinitely.
