-- AlterTable
ALTER TABLE "User" ADD COLUMN     "admissionCategory" TEXT,
ADD COLUMN     "admissionSemester" TEXT,
ADD COLUMN     "admissionYear" TEXT,
ADD COLUMN     "discipline" TEXT,
ADD COLUMN     "natureOfAdmission" TEXT,
ADD COLUMN     "scholarData" JSONB;
