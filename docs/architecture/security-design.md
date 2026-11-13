# Security design

- Secrets stay in local environment files and never in source control.
- CORS is limited to the development origin.
- The application does not expose database credentials or stack traces over HTTP.
- Tenant boundaries are enforced at the backend authorization layer.
- Prisma and Redis use secure connection configuration for the local development environment.
