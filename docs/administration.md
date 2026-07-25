# Administration Module (Domain Catalog)

The stability domain chain: **Product → Batch → Stability Sample**, with
**Sections** as organizational subdivisions. All endpoints require
authentication; reads need `<entity>:read`, mutations need
`<entity>:manage`. Every mutation is audit-logged.

## Products (`/api/v1/products`)

- `GET /` — search (name/code/category), pagination, `archived` filter.
- `POST /` — codes are uppercased and globally unique (409 on duplicate).
- `PATCH /:id`, `POST /:id/archive`, `POST /:id/restore`, `DELETE /:id`
  (soft delete).
- Fields: name, code, category, dosage form, strength, storage
  conditions, description.

## Sections (`/api/v1/sections`)

- `GET /`, `POST /` (unique name), `PATCH /:id`, archive/restore.

## Batches (`/api/v1/batches`)

- `GET /` — search by batch code, `productId` filter, product populated.
- `POST /` — **duplicate validation**: batch code unique per product
  (compound index + 409). Expiry must be after manufacturing date.
- `DELETE /:id` (soft delete).

## Stability samples (`/api/v1/samples`)

- `POST /` — registers a sample. `sampleCode` is auto-generated
  (`STB-<year>-<seq>`) unless provided. Validation: batch must belong to
  the selected product; expiry after manufacture; charging date not
  before manufacture; intervals restricted to the standard pull points
  (3–36 months, step 3; defaults to all twelve).
- `GET /` — filters: search, `productId`, `status`
  (registered/running/completed), `stabilityType`
  (long-term/accelerated/intermediate), `archived`. Product, batch, and
  section are populated.
- `POST /:id/clone` — copies the sample with a fresh code and
  `registered` status.
- `PATCH /:id` — quantity, remarks, status.
- Archive / restore / soft delete.

The `intervals` field feeds the automatic scheduler (Phase 7), which will
generate `StabilitySchedule` entries per pull point.

## Role access (seeded defaults)

| Role                           | Access                                      |
| ------------------------------ | ------------------------------------------- |
| super-admin, administrator     | read + manage everything                    |
| data-entry                     | read all; manage products, batches, samples |
| qa-manager, qc-manager, viewer | read only                                   |
| analyst                        | read products, batches, samples             |

## UI

`/products`, `/sections`, `/batches`, `/samples` — permission-gated pages
with search/filter/pagination, inline create forms (React Hook Form +
Zod), archive/restore, sample cloning, and status updates. The sample
form cascades product → batch selection.

## Deferred (tracked in PROJECT_MEMORY)

Excel import/export, QR/barcode generation, and sample attachments
(depend on the file-management phase).
