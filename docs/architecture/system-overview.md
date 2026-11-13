# System overview

The platform is split into three runtime layers:

1. Web application: Next.js app router front-end for dealership operations and development status monitoring.
2. API layer: NestJS modular monolith exposing versioned APIs to the web application and future service adapters.
3. Data and infrastructure services: PostgreSQL for SaaS metadata and Redis for operational caching and orchestration support.

The architecture keeps dealership inventory access outside the application core and enforces isolation through backend authorization boundaries.
