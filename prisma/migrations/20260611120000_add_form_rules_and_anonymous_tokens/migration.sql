-- CreateEnum
CREATE TYPE "DuplicateProtection" AS ENUM ('NONE', 'BROWSER', 'LOGIN');

-- AlterTable
ALTER TABLE "Form" ADD COLUMN "requireLogin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Form" ADD COLUMN "allowMultipleSubmissions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Form" ADD COLUMN "duplicateProtection" "DuplicateProtection" NOT NULL DEFAULT 'BROWSER';

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN "anonymousTokenHash" TEXT;

-- CreateIndex
CREATE INDEX "FormSubmission_anonymousTokenHash_idx" ON "FormSubmission"("anonymousTokenHash");
