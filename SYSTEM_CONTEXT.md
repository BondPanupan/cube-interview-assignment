# System Context

This is non-confidential context for architecture planning.

## Current Platform Shape

MeterCube is a Next.js monolith.

- one repository
- one app deployment
- no autoscaling
- no cache layer
- no queue service in the starter environment
- no separate worker deployment
- API routes and UI share the same Node.js runtime
- PostgreSQL stores transactional product/app data
- analytics features may read large external datasets
- long-running requests can compete with normal page/API traffic

## Major Feature Areas

You may assume things, but explain cleary on what you did assume.

### Authentication And Account

- login, registration, password reset, email verification
- two-factor setup and verification
- account settings and user preferences
- user activity and notification APIs
- user registration

### Market Snapshot Module

- country-level market overview
- ecommerce shopper metrics
- GMV and market-size views
- market report access

### Category Insights Module

- category dashboards
- accuracy reports
- downloadable reports
- PowerBI-style dashboard access

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
