# Tenant isolation

## Persistence enforcement

The tenant-safe migration adds composite foreign keys for relationships that must remain inside a dealership. These constraints prevent a lead from referencing another dealership's customer, an assignment from referencing another dealership's lead or employee, and a membership role from referencing a role owned by another dealership. Integration references and sync logs are similarly constrained to their dealership's connection.

Dealership identity is derived from the caller's active membership in `TenantScopedCrmRepository`; callers do not provide a `dealershipId` for repository operations. The repository verifies that the supplied user and membership identify an active membership and that the user is active. Reads, writes, and assignments then include the resolved dealership in their predicates and execute in serializable transactions.

The repository is an internal persistence provider, not a public CRUD controller. Authentication and request identity must be established by the application layer before passing a membership context to it.

## Migration safety

The follow-up migration backfills tenant IDs from existing parent leads and resolves actor/employee memberships only when a matching dealership membership exists. It raises an error for unmappable legacy leads, assignments, activities, role assignments, or external vehicle references instead of inventing relationships. Existing external vehicle references require an authorized mapping to an integration connection before migration can proceed.

## Operational boundaries

- Always scope dealership-owned queries by the membership-derived dealership.
- Keep authorization decisions in the backend; a client-supplied tenant ID is not an authorization boundary.
- Do not write to dealership-owned inventory. Inventory access remains behind an approved adapter.
- Store only opaque credential references; secrets and customer personal data must not be copied into integration metadata, audit details, or sync logs.
- Audit-log records include optional dealership and user references; application reads and writes must enforce tenant authorization.
