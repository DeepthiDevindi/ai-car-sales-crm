# Northstar Dealer CRM

A React, TypeScript, and Vite starter for the AI Car Sales Assistant & Customer Relationship Management platform.

## Run locally

```sh
npm install
npm run dev
```

## Current prototype

The initial dashboard-first prototype follows the R1 scope in SRS-AICRM-001:

- Dealership dashboard with lead activity, lead temperature, appointments, and pipeline summaries.
- Lead list with temperature filters, global search, CSV export, and a working add-lead form.
- Read-only vehicle inventory view, reflecting the dealership inventory ownership boundary.
- Unified conversation inbox with seeded example conversations, message composition, and AI/human handover state.
- Appointment, analytics, and workspace settings views.

The UI currently uses seeded in-memory sample data. Authentication, tenant isolation, persistent storage, live AI responses, inventory synchronization, WhatsApp, and backend authorization are not implemented yet; they require the backend and integrations described in the Software Architecture Document. Do not use the sample data as real customer or inventory information.

The SAD proposes a Next.js web dashboard. This frontend instead uses the requested React + TypeScript + Vite stack.

## Available scripts

- `npm run dev` — start the local development server.
- `npm run build` — type-check and create a production build.
- `npm run lint` — run Oxlint.
- `npm run preview` — preview the production build locally.
