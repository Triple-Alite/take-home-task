CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "ownerUid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userCount" INTEGER NOT NULL,
    "productCount" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Company_userCount_check" CHECK ("userCount" >= 0),
    CONSTRAINT "Company_productCount_check" CHECK ("productCount" >= 0)
);

CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Image_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Image_sizeBytes_check" CHECK ("sizeBytes" > 0)
);

CREATE UNIQUE INDEX "Company_ownerUid_key" ON "Company"("ownerUid");
CREATE UNIQUE INDEX "Image_objectKey_key" ON "Image"("objectKey");
CREATE INDEX "Image_companyId_createdAt_idx" ON "Image"("companyId", "createdAt" DESC);

ALTER TABLE "Image" ADD CONSTRAINT "Image_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
