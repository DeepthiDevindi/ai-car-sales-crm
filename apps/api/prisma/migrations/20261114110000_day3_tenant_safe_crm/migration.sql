-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('ENGLISH', 'SINHALA', 'SINGLISH');

-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "DealershipSettings" DROP CONSTRAINT "DealershipSettings_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "ExternalVehicleReference" DROP CONSTRAINT "ExternalVehicleReference_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "IntegrationConnection" DROP CONSTRAINT "IntegrationConnection_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "InventorySyncLog" DROP CONSTRAINT "InventorySyncLog_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "InventorySyncLog" DROP CONSTRAINT "InventorySyncLog_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "LeadActivity" DROP CONSTRAINT "LeadActivity_leadId_fkey";

-- DropForeignKey
ALTER TABLE "LeadAssignment" DROP CONSTRAINT "LeadAssignment_leadId_fkey";

-- DropForeignKey
ALTER TABLE "LeadAssignment" DROP CONSTRAINT "LeadAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "UserDealership" DROP CONSTRAINT "UserDealership_dealershipId_fkey";

-- DropForeignKey
ALTER TABLE "UserDealership" DROP CONSTRAINT "UserDealership_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_userId_fkey";

-- DropIndex
DROP INDEX "LeadActivity_leadId_createdAt_idx";

-- DropIndex
DROP INDEX "LeadAssignment_leadId_userId_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "preferredLanguage" "PreferredLanguage" NOT NULL DEFAULT 'ENGLISH',
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ExternalVehicleReference" ADD COLUMN     "connectionId" UUID;

-- AlterTable
ALTER TABLE "IntegrationConnection" ADD COLUMN     "credentialReference" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "customerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "actorMembershipId" UUID,
ADD COLUMN     "dealershipId" UUID;

-- AlterTable
ALTER TABLE "LeadAssignment" ADD COLUMN     "assignedByMembershipId" UUID,
ADD COLUMN     "dealershipId" UUID,
ADD COLUMN     "membershipId" UUID;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'INVITED';

-- AlterTable
ALTER TABLE "UserDealership" ADD COLUMN     "branchId" UUID,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "roleScope" "RoleScope" NOT NULL DEFAULT 'GLOBAL';

-- CreateTable
CREATE TABLE "MembershipRole" (
    "dealershipId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipRole_pkey" PRIMARY KEY ("membershipId","roleId")
);

UPDATE "UserDealership"
SET "status" = 'ACTIVE'
WHERE "joinedAt" IS NOT NULL AND "status" = 'INVITED';

UPDATE "LeadActivity" AS activity
SET "dealershipId" = lead."dealershipId"
FROM "Lead" AS lead
WHERE activity."leadId" = lead."id";

UPDATE "LeadActivity" AS activity
SET "actorMembershipId" = membership."id"
FROM "UserDealership" AS membership
WHERE activity."dealershipId" = membership."dealershipId"
  AND activity."userId" = membership."userId";

UPDATE "LeadAssignment" AS assignment
SET "dealershipId" = lead."dealershipId"
FROM "Lead" AS lead
WHERE assignment."leadId" = lead."id";

UPDATE "LeadAssignment" AS assignment
SET "membershipId" = membership."id"
FROM "UserDealership" AS membership
WHERE assignment."dealershipId" = membership."dealershipId"
  AND assignment."userId" = membership."userId";

UPDATE "UserRole" AS user_role
SET "roleScope" = role."scope"
FROM "Role" AS role
WHERE user_role."roleId" = role."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Lead" WHERE "customerId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require a customer for existing leads until every lead has a valid customer.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "LeadAssignment"
    WHERE "dealershipId" IS NULL OR "membershipId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant-scoped assignments until each assignment maps to a dealership membership.';
  END IF;
  IF EXISTS (SELECT 1 FROM "LeadActivity" WHERE "dealershipId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce tenant-scoped activity until every activity maps to a lead dealership.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "LeadActivity"
    WHERE "userId" IS NOT NULL AND "actorMembershipId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant-scoped activity actors until each actor maps to a dealership membership.';
  END IF;
  IF EXISTS (SELECT 1 FROM "ExternalVehicleReference" WHERE "connectionId" IS NULL) THEN
    RAISE EXCEPTION 'Map existing external vehicle references to their dealership integration before applying this migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Role"
    WHERE ("scope" = 'GLOBAL' AND "dealershipId" IS NOT NULL)
       OR ("scope" = 'DEALERSHIP' AND "dealershipId" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Correct role scope and dealership associations before applying this migration.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "UserRole" AS user_role
    JOIN "Role" AS role ON role."id" = user_role."roleId"
    WHERE role."scope" = 'DEALERSHIP'
      AND NOT EXISTS (
        SELECT 1 FROM "UserDealership" AS membership
        WHERE membership."userId" = user_role."userId"
          AND membership."dealershipId" = role."dealershipId"
      )
  ) THEN
    RAISE EXCEPTION 'A dealership role assignment has no matching user membership; resolve it before migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Role" WHERE "dealershipId" IS NULL
    GROUP BY "key" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate global role keys before applying this migration.';
  END IF;
END $$;

INSERT INTO "MembershipRole" ("dealershipId", "membershipId", "roleId", "assignedAt")
SELECT role."dealershipId", membership."id", user_role."roleId", user_role."assignedAt"
FROM "UserRole" AS user_role
JOIN "Role" AS role ON role."id" = user_role."roleId"
JOIN "UserDealership" AS membership
  ON membership."userId" = user_role."userId"
 AND membership."dealershipId" = role."dealershipId"
WHERE role."scope" = 'DEALERSHIP'
ON CONFLICT ("membershipId", "roleId") DO NOTHING;

DELETE FROM "UserRole" AS user_role
USING "Role" AS role
WHERE role."id" = user_role."roleId"
  AND role."scope" = 'DEALERSHIP';

ALTER TABLE "Lead" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "LeadActivity" ALTER COLUMN "dealershipId" SET NOT NULL;
ALTER TABLE "LeadAssignment"
  ALTER COLUMN "dealershipId" SET NOT NULL,
  ALTER COLUMN "membershipId" SET NOT NULL;
ALTER TABLE "ExternalVehicleReference" ALTER COLUMN "connectionId" SET NOT NULL;

ALTER TABLE "Role"
  ADD CONSTRAINT "Role_scope_matches_dealership_check"
  CHECK (
    ("scope" = 'GLOBAL' AND "dealershipId" IS NULL)
    OR ("scope" = 'DEALERSHIP' AND "dealershipId" IS NOT NULL)
  );
ALTER TABLE "UserRole"
  ADD CONSTRAINT "UserRole_platform_scope_only_check"
  CHECK ("roleScope" = 'GLOBAL');
ALTER TABLE "LeadActivity"
  ADD CONSTRAINT "LeadActivity_actor_membership_required_check"
  CHECK ("userId" IS NULL OR "actorMembershipId" IS NOT NULL);

CREATE UNIQUE INDEX "Role_global_key_key"
ON "Role"("key")
WHERE "dealershipId" IS NULL;

-- CreateIndex
CREATE INDEX "MembershipRole_dealershipId_roleId_idx" ON "MembershipRole"("dealershipId", "roleId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Branch_dealershipId_status_idx" ON "Branch"("dealershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_dealershipId_id_key" ON "Branch"("dealershipId", "id");

-- CreateIndex
CREATE INDEX "Customer_dealershipId_createdAt_idx" ON "Customer"("dealershipId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_dealershipId_phone_idx" ON "Customer"("dealershipId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_dealershipId_id_key" ON "Customer"("dealershipId", "id");

-- CreateIndex
CREATE INDEX "ExternalVehicleReference_dealershipId_connectionId_idx" ON "ExternalVehicleReference"("dealershipId", "connectionId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_dealershipId_status_idx" ON "IntegrationConnection"("dealershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_dealershipId_id_key" ON "IntegrationConnection"("dealershipId", "id");

-- CreateIndex
CREATE INDEX "InventorySyncLog_dealershipId_status_startedAt_idx" ON "InventorySyncLog"("dealershipId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "InventorySyncLog_dealershipId_connectionId_startedAt_idx" ON "InventorySyncLog"("dealershipId", "connectionId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySyncLog_dealershipId_id_key" ON "InventorySyncLog"("dealershipId", "id");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_status_createdAt_idx" ON "Lead"("dealershipId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_customerId_idx" ON "Lead"("dealershipId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_dealershipId_id_key" ON "Lead"("dealershipId", "id");

-- CreateIndex
CREATE INDEX "LeadActivity_dealershipId_leadId_createdAt_idx" ON "LeadActivity"("dealershipId", "leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadAssignment_dealershipId_leadId_unassignedAt_idx" ON "LeadAssignment"("dealershipId", "leadId", "unassignedAt");

-- CreateIndex
CREATE INDEX "LeadAssignment_dealershipId_membershipId_unassignedAt_idx" ON "LeadAssignment"("dealershipId", "membershipId", "unassignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAssignment_dealershipId_id_key" ON "LeadAssignment"("dealershipId", "id");

-- CreateIndex
CREATE INDEX "Role_scope_idx" ON "Role"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "Role_dealershipId_id_key" ON "Role"("dealershipId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Role_id_scope_key" ON "Role"("id", "scope");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "UserDealership_userId_status_idx" ON "UserDealership"("userId", "status");

-- CreateIndex
CREATE INDEX "UserDealership_dealershipId_status_idx" ON "UserDealership"("dealershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserDealership_dealershipId_id_key" ON "UserDealership"("dealershipId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UserDealership_dealershipId_id_userId_key" ON "UserDealership"("dealershipId", "id", "userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_roleScope_idx" ON "UserRole"("roleId", "roleScope");

-- AddForeignKey
ALTER TABLE "DealershipSettings" ADD CONSTRAINT "DealershipSettings_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDealership" ADD CONSTRAINT "UserDealership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDealership" ADD CONSTRAINT "UserDealership_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDealership" ADD CONSTRAINT "UserDealership_dealershipId_branchId_fkey" FOREIGN KEY ("dealershipId", "branchId") REFERENCES "Branch"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_dealershipId_membershipId_fkey" FOREIGN KEY ("dealershipId", "membershipId") REFERENCES "UserDealership"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_dealershipId_roleId_fkey" FOREIGN KEY ("dealershipId", "roleId") REFERENCES "Role"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_roleScope_fkey" FOREIGN KEY ("roleId", "roleScope") REFERENCES "Role"("id", "scope") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_dealershipId_customerId_fkey" FOREIGN KEY ("dealershipId", "customerId") REFERENCES "Customer"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_dealershipId_leadId_fkey" FOREIGN KEY ("dealershipId", "leadId") REFERENCES "Lead"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_dealershipId_membershipId_userId_fkey" FOREIGN KEY ("dealershipId", "membershipId", "userId") REFERENCES "UserDealership"("dealershipId", "id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_dealershipId_assignedByMembershipId_fkey" FOREIGN KEY ("dealershipId", "assignedByMembershipId") REFERENCES "UserDealership"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_dealershipId_leadId_fkey" FOREIGN KEY ("dealershipId", "leadId") REFERENCES "Lead"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_dealershipId_actorMembershipId_userId_fkey" FOREIGN KEY ("dealershipId", "actorMembershipId", "userId") REFERENCES "UserDealership"("dealershipId", "id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySyncLog" ADD CONSTRAINT "InventorySyncLog_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySyncLog" ADD CONSTRAINT "InventorySyncLog_dealershipId_connectionId_fkey" FOREIGN KEY ("dealershipId", "connectionId") REFERENCES "IntegrationConnection"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVehicleReference" ADD CONSTRAINT "ExternalVehicleReference_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVehicleReference" ADD CONSTRAINT "ExternalVehicleReference_dealershipId_connectionId_fkey" FOREIGN KEY ("dealershipId", "connectionId") REFERENCES "IntegrationConnection"("dealershipId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
