# System Context
This application attempts to search for product information by SKU, with filtering by Country, Channel, Brand, and Search.
The original application has two functions:
  1. Search and report with ui
  2. CSV export of filtered data
Both features use data from a PostgreSQL database instead of Snowflake.

## System Components
  - Frontend:
    - `UI`: filter form (Country, Channel, Brand, Search), report 
    - `Notification Bell`: polling (3s) that surfaces job completion/failure and triggers download: job listing, single job status, and file download (streamed from disk)
  - Application
    - `Export job`: Background processing: fire-and-forget async function (no separate process/queue) that streams rows from Postgres via keyset pagination and writes CSV to disk batch-by-batch
    - `Export API`: export runs after the response
    - `Report API`: response filter api
    - `Jobs API`: job listing, single job status, and file download (streamed from disk)
    - `PostgreSQL`: database product data and export job state/tracking
  
# Directory Structure
```
.
├── src/
│   ├── pages/
│   │   ├── _app.tsx
│   │   └── index.tsx                          ← UI: filters, report table, "Export" button, notification bell
│   ├── app/api/product-health/
│   │   ├── report/route.ts                    ← GET: aggregated, capped report (JSON)
│   │   └── export/
│   │       ├── route.ts                       ← POST: create job, kick off background run, 202 immediately
│   │       └── jobs/
│   │           ├── route.ts                   ← GET: list recent jobs (polled for notifications)
│   │           └── [id]/
│   │               ├── route.ts                ← GET: single job status
│   │               └── download/route.ts       ← GET: stream completed job's CSV file from disk
│   ├── components/
│   │   └── NotificationBell.tsx                ← polls jobs, surfaces completed/failed exports, triggers download
│   ├── hooks/
│   │   └── useExportJobs.ts                    ← client polling loop (3s) against GET .../export/jobs
│   └── lib/
│       ├── product-health.ts                  ← filter parsing, report SQL, health score, streamCalculatedCsvToFile
│       ├── product-health/
│       │   ├── report.ts                       ← client fetch helper for report.ts route
│       │   └── export.ts                       ← client fetch helpers: createExportJob, fetchExportJobs, downloadExportJob
│       ├── export-jobs/
│       │   ├── export-jobs.ts                  ← createExportJob/listExportJobs/getExportJob/runExportJob (DB-backed job lifecycle)
│       │   ├── type/export-job.type.ts
│       │   └── helpers/
│       │       ├── get-export-job.ts
│       │       └── get-export-job-file-path.ts
│       ├── enum/export-job-status.ts           ← ExportJobStatus, mirrors the Postgres enum
│       ├── csv.ts                              ← row[] → CSV string
│       └── db.ts                               ← single `pg` Pool
├── db/
│   ├── migrations/
│   │   ├── 001_product_health.sql              ← product_observations schema
│   │   └── 002_export_jobs.sql                 ← export_job_status enum + export_jobs table
│   └── seeds/001_product_health_seed.sql       ← ~500k fixture rows across SEA6 + Taiwan + China
├── docker-compose.yml                          ← app container: mem_limit 512m, 1 cpu, --max-old-space-size=256
└── Dockerfile
```

### Data Flow
- Client clicks Export.
  - API creates a Job ID and responds immediately `(< 1 second), no timeout`.
  - Background: Retrieving data 1,000 rows at a time, `using only ~30MB of RAM`.
  - Background: Writing CSV to /tmp immediately, `no storage, no OOM`.
  - Completed: Notifies the client that it's ready to download. `Users don't have to wait on a frozen page`.

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│  1. Click "Export"                                       │
│  2. Get jobId back → show "Generating file..."           │
│  3. Poll status every 2-3 seconds                        │
│  4. status = done → click Download                       │
└──────────┬──────────────────────────┬───────────────────┘
           │ POST /api/export         │ GET /api/export/status?id=xxx
           ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                     NEXT.JS API                         │
│                                                         │
│  POST /api/export                                       │
│    → create jobId (uuid)                                │
│    → save job to jobs store (status: "processing")       │
│    → start background task                               │
│    → return { jobId } immediately                        │
│                                                         │
│  GET /api/export/status?id=xxx                          │
│    → read status from jobs store                         │
│    → return { status, downloadUrl? }                    │
│                                                         │
│  GET /api/export/download?id=xxx                          │
│    → read file from /tmp/export-xxx.csv                  │
│    → stream back to Client                               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Background Task
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKGROUND WORKER                     │
│                                                         │
│  Loop 1,000 rows at a time:                              │
│    1. SELECT id, name, email                            │
│       FROM users                                        │
│       WHERE id > lastId                                 │
│       ORDER BY id LIMIT 1000                            │
│                                                         │
│    2. Write CSV to /tmp/export-xxx.csv immediately        │
│       (using fs.createWriteStream — not held in memory)  │
│                                                         │
│    3. Update lastId = last row's id                       │
│    4. Loop until no data left                            │
│                                                         │
│  Done → update job status = "done"                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                     DATABASE                            │
│                                                         │
│  Uses Cursor-based Pagination:                           │
│    WHERE id > lastId ORDER BY id LIMIT 1000             │
│                                                         │
│  ❌ Does not use OFFSET (very slow at high offsets)       │
│  ✅ Uses WHERE id > lastId (equally fast every batch)     │
└─────────────────────────────────────────────────────────┘
```

## API Architecture

All routes live under `src/app/api/product-health/` (Next.js App Router, Node runtime). There is no auth layer — every route is open.

| Method | Route | Handler | Purpose | Response |
|---|---|---|---|---|
| GET | `/api/product-health/report` | `report/route.ts` | Runs `parseFilters` + `getReport` — a `GROUP BY` SQL query with `ORDER BY ... LIMIT 100`. Always bounded. | `200` JSON report, or `400` on invalid filters |
| POST | `/api/product-health/export` | `export/route.ts` | Validates filters, inserts an `export_jobs` row via `createExportJob`, fires `runExportJob(job)` **without awaiting it**, returns immediately. | `202` `{ job }`, or `400` on invalid filters |
| GET | `/api/product-health/export/jobs` | `export/jobs/route.ts` | Lists recent jobs (`listExportJobs`) — polled by `useExportJobs` every 3s to drive `NotificationBell`. | `200` `{ jobs }` |
| GET | `/api/product-health/export/jobs/[id]` | `export/jobs/[id]/route.ts` | Looks up one job by numeric id (`getExportJob`). | `200` `{ job }`, `400` bad id, `404` not found |
| GET | `/api/product-health/export/jobs/[id]/download` | `export/jobs/[id]/download/route.ts` | Streams the finished CSV off disk via `fs.createReadStream` → `Readable.toWeb`, as `text/csv` with `Content-Disposition: attachment`. | `200` file stream, `400` bad id, `404` job not found, `409` job not completed, `410` file missing from disk |


## original Current Platform Shape
MeterCube is a Next.js monolith.
  - one repository
  - one app deployment
  - no autoscaling
  - no cache layer
  - no separate worker deployment
  - API routes and UI share the same Node.js runtime
  - PostgreSQL stores transactional product/app data
  - long-running requests can compete with normal page/API traffic

## Major Feature
  - Product search/report UI
  - CSV export of filtered data
  - Background export jobs with async processing
  - Job status notifications + download

### Authentication And Account
  - no login, registration, password reset, email verification
  - no two-factor setup and verification
  - no account settings and user preferences
  - no user registration

### Market Snapshot Module
  - country-level market overview
  - ecommerce shopper metrics
  - GMV and market-size views
  - market report access
  - Average price
  - The average popularity rating of each that product

### Category Insights Module
  - no category dashboards
  - no PowerBI-style dashboard access
  - accuracy reports
  - downloadable reports


### Digital Shelf Module
- Product Health
  - online availability
  - rating and reviews
  - price competitiveness
  - content quality
  - report table and export workflows
- Global Score Card
  - trend metrics
  - country/channel table metrics
  - weekly file export/download workflow
- Share of Search
  - keyword options
  - search insight metrics
  - ranking and position tables
  - keyword distribution
- Banner Presence
  - banner visibility analytics

### Subscriptions
- module subscription by
  - organization
  - countries
  - platforms
  - categories

### Support And Operations
  - support pages
  - dashboard guides
  - privacy and acceptable-use pages
  - maintenance status
  - health checks for Postgres, Snowflake, and export worker
  - user feedback

## Known Scaling Risks
  - one heavy analytics request can consume CPU/RAM needed by unrelated traffic
  - large exports can materialize too much data in memory
  - external warehouse queries can return wide results
  - repeated analytics queries can be expensive without caching
  - lack of autoscaling means one overloaded instance affects all users
  - lack of background isolation makes long-running work risky
