-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "empNo" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "nonInstituteEmail" TEXT,
ADD COLUMN     "phCategory" TEXT,
ADD COLUMN     "rollNo" TEXT;
