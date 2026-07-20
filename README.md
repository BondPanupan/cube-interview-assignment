# Product Health Take-Home

Public-safe Next.js monolith slice for a developer take-home.

Real Digital Shelf exports read private Snowflake data. This repo uses PostgreSQL fixture data instead. PostgreSQL should work locally; the intended problem is Node.js CPU/RAM pressure during export.

## Context

The app has:

- 500k product observation records
- SEA6 countries, Taiwan, and China
- report filters
- one-click CSV export based on selected filters
- wide raw snapshot data to mimic warehouse export payloads
- one app container with constrained CPU/RAM

Read [SYSTEM_CONTEXT.md](./SYSTEM_CONTEXT.md) before writing architecture notes.

Read [CANDIDATE_BRIEF.md](./CANDIDATE_BRIEF.md) for more context.

## Expected Starter Behavior

- Smaller filtered exports should complete.
- Full dataset export is expected to exhaust app resources and restart the app container.
- The first task is not to make the full export complete. It is to keep the app from fully breaking when the full export is attempted.
- Extra credit: make full dataset export complete, or explain how you would complete it safely without building the whole solution.

## Setup

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Postgres:

```text
localhost:5433
postgres://postgres:postgres@localhost:5433/product_health_take_home
```

Reset DB:

```bash
docker compose down -v
docker compose up --build
```

## Commands

```bash
docker compose exec app pnpm typecheck
docker compose exec app pnpm build
```

## Tasks

### Task 1

Change the implementation so a full-dataset export failure does not crash or make the whole app unusable. Smaller filtered exports should still work.

### Task 2

Write `ARCHITECTURE.md` for the whole system, using [SYSTEM_CONTEXT.md](./SYSTEM_CONTEXT.md).

## Deliverables

- working code
- `ARCHITECTURE.md`
- `AI_USAGE.md`
- README notes explaining what you changed, why, and how you verified it

## AI Usage

AI is allowed. Explain what you used it for and what you manually reviewed.

<br/><br/>

# Changes Made

## Task 1
  - [ `DONE` ] Make the app survive a full-dataset export attempt.
  - [ `DONE` ] The full export does not need to complete. It must not take down the app completely.
  - [ `DONE` ] Smaller filtered exports should still work.
  - [ `DONE` ] Extra credit: make full dataset export complete, or explain how you would do it safely.

## Task 2
  - [ `DONE` ] Write `ARCHITECTURE.md` for the whole system using `SYSTEM_CONTEXT.md`.

## Deliverables
### Explain what I did step by step.
  - forked from Card-Nattanon-Card-Card-Card-Card-Card/cube-interview-assignment
  - clone the repository
  - read: `README.md`, `SYSTEM_CONTEXT.md`, `CANDIDATE_BRIEF.md`
    - Understand the documents received.
  - Configure and install the repository on a Docker container, configuring it according to the markdown file.
  - Try to open frontend 
  - Try clicking on everything on the webpage to understand the features I have.(include report/export)
  - Explore the entire structure of the application.
    - file structure, database design, application design, components of applicaiton, api,
  - reproduced the problem make it crash/restart the app container
  - Analyze and find solutions.
    - Choose to create a notification system.
    - Export to Background Job, `Fire and forget`: the export streams to disk
    - Client → Click Export → API creates Job → Processes in Background → Once complete, a notification will appear with a download link.
  - fix(project structure): separate the api of application, Manage the structure of module and domain
  - new feature export: CSV Stream + Cursor Pagination + Batch 1000 and Background Job
  - refactor export: back export job status with a Postgres + TS enum
  - refactor export: share type helper function and app structure
  - add ARCHITECTURE.md

### how verified
  - 500,000 rows is a volume that makes it difficult to verify.
  - Row count check
  - Column count consistency
  - Sample row inspection
  - File size sanity check, with 500K If it's unusually small or large, there's a problem.

<br/>

## This is what I instructed the AI ​​to do. for agents on Cli
```
CSV Stream + Cursor Pagination + Batch 1000
Export to Background Job
Client → Click Export → API creates Job → Processes in Background → Notifies and provides Download link when finished
On frontend, I need a notification UI.
Click on the notification menu to show a popup modal listing notifications.
Click each notification to download a file.

Client clicks Export
  - API creates Job (responds immediately, no waiting)
  - Background retrieves data 1000 rows at a time
  - Stream writes CSV to /tmp/export-xxx.csv
  - Notifies Client when finished → Click Download
```

## Notifications ui
![Warehouses](ex-images/01-notifications.png)

## Notifications Export list ui
![Warehouses](ex-images/02-list-of-notifications.png)