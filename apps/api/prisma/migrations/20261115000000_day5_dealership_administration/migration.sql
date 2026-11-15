-- Day 5 administration fields are additive; existing dealership, membership,
-- branch, invitation, and CRM records are preserved.
ALTER TABLE "Dealership"
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "openingHours" JSONB;

ALTER TABLE "UserDealership"
  ADD COLUMN "availability" JSONB;

ALTER TABLE "EmployeeInvitation"
  ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE INDEX "EmployeeInvitation_dealershipId_revokedAt_expiresAt_idx"
  ON "EmployeeInvitation"("dealershipId", "revokedAt", "expiresAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Branch"
    GROUP BY "dealershipId", lower("code")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce case-insensitive branch codes until duplicate codes within each dealership are resolved.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "EmployeeInvitation"
    WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL
    GROUP BY "dealershipId", lower("email")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one pending invitation per dealership and email until existing duplicates are resolved.';
  END IF;
END $$;

CREATE UNIQUE INDEX "Branch_dealershipId_lower_code_key"
  ON "Branch"("dealershipId", lower("code"));

CREATE UNIQUE INDEX "EmployeeInvitation_active_dealership_email_key"
  ON "EmployeeInvitation"("dealershipId", lower("email"))
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
