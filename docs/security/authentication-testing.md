# Authentication security testing

## Automated coverage

Focused unit tests cover:

- Scrypt hash format, correct/wrong password verification, dummy-hash behavior, and policy rejection.
- An RFC 6238 SHA-1 TOTP vector, invalid codes, AES-GCM round-trip, tamper rejection, and MFA key validation.
- Redis fixed-window counting, 429 behavior, and fail-closed 503 behavior.
- Production MFA key startup validation.
- Browser login submission, credentialed requests, and navigation to the protected dashboard.

Opt-in local PostgreSQL/Redis integration tests cover:

- Unverified-account login rejection, email verification, session token hashing, authenticated membership retrieval, logout/revocation, password reset, and reset-token single use.
- Single-use employee invitation acceptance and active membership creation.
- Case-insensitive duplicate email rejection.
- The existing tenant isolation and composite foreign-key checks.

Run unit tests:

```powershell
pnpm --filter @ai-car-sales-crm/api test
pnpm --filter @ai-car-sales-crm/web test
```

Run integration tests only against the local PostgreSQL and Redis configured in `apps/api/.env`:

```powershell
$env:RUN_DB_INTEGRATION_TESTS = '1'
pnpm --dir apps/api test:integration
Remove-Item Env:\RUN_DB_INTEGRATION_TESTS
```

The integration suites create synthetic `example.test` fixtures and delete their database rows after execution. They do not reset the database or containers. Redis rate-limit counters use unique test identifiers and expire automatically.

## Local development account bootstrap

When invitation-based provisioning is unavailable in a fresh local database, add the intended sign-in email to `DEV_BOOTSTRAP_EMAIL_ALLOWLIST` in the untracked `apps/api/.env` file, then run:

```powershell
pnpm --dir apps/api auth:bootstrap:local
```

The command requires `NODE_ENV=development` or `test` and a PostgreSQL URL pointing to this computer. It also requires typing the explicit confirmation phrase, entering an allowlisted email, and entering a new password twice in hidden terminal prompts. The password follows the normal password policy. The command refuses existing users and uses one transaction to create the account, its verified local-development membership, and a dealership-scoped staff role with no permissions. The role is not a platform or dealership administrator. Email verification is pre-marked only for this local/test bootstrap because no verification email is sent. Production MFA policy and normal login/session checks are unchanged.

The command does not create an account until it is explicitly run and all checks pass. Never put passwords in command arguments, source files, or this documentation.

## Not yet verified or not implemented

- No full HTTP/browser end-to-end test currently exercises Nest middleware, CORS preflight, cookie attributes, CSRF rejection, and frontend-to-API operation together.
- No production mail provider, administrator bootstrap, account recovery policy, recovery codes, or password-change flow has been implemented.
- No external penetration test, threat-model approval, dependency audit, production deployment test, or SRS/SAD traceability review has been performed.

Passing local tests is implementation evidence only; it is not a production security certification.
