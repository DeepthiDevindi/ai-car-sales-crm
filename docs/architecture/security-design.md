# Security design

- Secrets stay in local environment files and never in source control.
- CORS is limited to the development origin.
- The application does not expose database credentials or stack traces over HTTP.
- Tenant boundaries are enforced at the backend authorization layer.
- Prisma and Redis use secure connection configuration for the local development environment.
- Authentication sessions use opaque HttpOnly cookies, database-stored token hashes, CSRF protection, and Redis-backed fail-closed rate limits; details and limitations are in [authentication and RBAC](authentication-and-rbac.md) and [session management](session-management.md).
- Production MFA requires an externally managed base64-encoded 32-byte encryption key. Production email delivery, initial administrator bootstrap, and MFA recovery remain blocked until approved.
