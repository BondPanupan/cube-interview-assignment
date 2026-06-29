# Candidate Brief

## Scenario

You are working in a single-deployment Next.js monolith.

There is no autoscaling, no cache layer, no separate worker deployment, and no queue service in the starter environment.

Digital Shelf exports normally read large private Snowflake datasets. This take-home uses PostgreSQL fixture data so it can run locally. PostgreSQL itself is not the problem. The problem is app CPU/RAM pressure during export.

## Starter Behavior

- filtered exports for smaller datasets should complete
- full dataset export should crash/restart the app container
- export uses selected filters
- app container has constrained resources

## Task 1

Make the app survive a full-dataset export attempt.

The full export does not need to complete. It must not take down the app completely.

Smaller filtered exports should still work.

Extra credit: make full dataset export complete, or explain how you would do it safely.

## Task 2

Write `ARCHITECTURE.md` for the whole system using `SYSTEM_CONTEXT.md`.

## Deliverables

- working code in a GitHub repository replying back to the original email thread
- `ARCHITECTURE.md`
- `AI_USAGE.md`
- README notes explaining what you did, why, and how you verified it

## Time Box

Submit within 7 calendar days.
