-- AlterTable
ALTER TABLE "Friendship" ADD COLUMN     "requesterLastReadAt" TIMESTAMP(3),
ADD COLUMN     "addresseeLastReadAt" TIMESTAMP(3);
