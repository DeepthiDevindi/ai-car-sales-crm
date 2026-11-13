# AGENTS

This repository implements the AI Car Sales Assistant & CRM Platform foundation for Day 2.

## Core rules

- Maintain a multi-tenant SaaS architecture and keep each dealership data boundary isolated.
- Keep the backend as a modular monolith and do not implement unauthorized business logic.
- Treat dealership inventory as a read-only source of truth managed by an authorized adapter layer.
- Keep secrets out of source control and use `.env` files only for local development.
- Use Docker for PostgreSQL and Redis local infrastructure.
- Prefer pnpm workspaces and keep the frontend/backend packages aligned on shared types.

## Execution notes

- Use the root workspace scripts for local dev, testing, and build validation.
- The API lives at `http://localhost:4000/api/v1` and the web app at `http://localhost:3000`.
- The health endpoint validates actual PostgreSQL and Redis connectivity.
- Do not implement unapproved CRM or AI business features in this phase.
