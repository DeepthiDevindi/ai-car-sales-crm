# Database schema

The API persists platform and dealership operational metadata in PostgreSQL through Prisma. Dealership inventory remains owned by each dealership's inventory system; this schema stores only tenant-scoped integration references and synchronization metadata. It does not add an inventory ingestion or write path.

## Entities

- **Dealership and settings**: tenant root, with one optional settings record and multiple branches.
- **User and dealership membership**: a user can belong to multiple dealerships. Membership carries dealership-local status, optional branch, and role assignments.
- **Roles and permissions**: dealership roles are assigned through `MembershipRole`; global roles are assigned through `UserRole`. Permissions are shared role capabilities.
- **Customer and lead**: customers and leads belong to one dealership. A lead must reference a customer in that same dealership.
- **Lead assignment and activity**: assignments are tied to the lead's dealership and an employee membership in that dealership. Activity is tied to a tenant lead and, when an actor user is recorded, to that user's dealership membership.
- **Integration and inventory metadata**: `IntegrationConnection`, `InventorySyncLog`, and `ExternalVehicleReference` record adapter configuration references and synchronization metadata, not dealership inventory ownership.
- **Audit log**: optional dealership and user references record platform activity. Access to these records must still be tenant-scoped by the application.

## Sensitive configuration

`IntegrationConnection.credentialReference` is an opaque reference to credentials managed outside this table. Do not store raw passwords, API keys, access tokens, or customer data in this field or in integration `configuration`, sync-log metadata, or error messages.

## Schema and migration source

The Prisma model definitions are in `apps/api/prisma/schema.prisma`. The historical applied migration `20261114044807_day3_database_foundation` was restored from the preserved repository snapshot without editing or reapplying it. The follow-up migration `20261114110000_day3_tenant_safe_crm` adds tenant constraints and membership-role persistence; it uses guarded backfills and aborts rather than guessing when existing references cannot be mapped.

See [database relationships](./database-relationships.md) for the relationship map and [tenant isolation](./tenant-isolation.md) for the enforcement boundaries.
