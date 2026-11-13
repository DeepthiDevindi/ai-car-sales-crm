# Decision log

- Chosen stack: Next.js, NestJS, PostgreSQL, Redis, Prisma, and pnpm workspaces.
- Local database and Redis are included in Docker Compose for a consistent developer environment.
- Shared TypeScript contracts live in a workspace package to keep the web app and backend aligned.
- Initial implementation focuses on the working foundation and health verification, not business logic.
