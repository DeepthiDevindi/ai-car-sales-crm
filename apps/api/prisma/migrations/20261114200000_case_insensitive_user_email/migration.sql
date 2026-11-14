DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    GROUP BY lower("email")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce case-insensitive user email uniqueness while duplicate addresses exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));
