# API conventions

- All APIs live under `/api/v1`.
- Health checks are exposed via `GET /api/v1/health`.
- Successful health response includes application status and dependency health for database and Redis.
- Failures return HTTP 503 when required dependencies are unavailable.
- Structured logging and safe error handling are applied consistently.
