-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "profileLocked" BOOLEAN NOT NULL DEFAULT false;
