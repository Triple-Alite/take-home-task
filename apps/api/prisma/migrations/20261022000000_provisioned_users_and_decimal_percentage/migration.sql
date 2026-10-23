CREATE TYPE "UserRole" AS ENUM ('USER_A', 'USER_B');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Company"
  ALTER COLUMN "percentage" TYPE DECIMAL(5,1)
  USING ROUND("percentage"::numeric, 1);

UPDATE "Company"
SET "percentage" = CASE
  WHEN "userCount" + "productCount" = 0 THEN 0
  ELSE ROUND(("userCount"::numeric / ("userCount" + "productCount")) * 100, 1)
END;

ALTER TABLE "Company"
  ADD COLUMN "ownerId" UUID,
  ADD COLUMN "collaboratorId" UUID;

CREATE UNIQUE INDEX "Company_ownerId_key" ON "Company"("ownerId");
CREATE UNIQUE INDEX "Company_collaboratorId_key" ON "Company"("collaboratorId");

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Company_collaboratorId_fkey"
    FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Image"
  ADD COLUMN "uploadedById" UUID;

CREATE INDEX "Image_uploadedById_idx" ON "Image"("uploadedById");

ALTER TABLE "Image"
  ADD CONSTRAINT "Image_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
