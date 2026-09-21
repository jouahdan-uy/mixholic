-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'SONG');

-- AlterTable
ALTER TABLE "Friendship" ADD COLUMN     "streakCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "streakLastDate" TIMESTAMP(3),
ADD COLUMN     "requesterLastMsgAt" TIMESTAMP(3),
ADD COLUMN     "addresseeLastMsgAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "friendshipId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "videoId" TEXT,
    "videoTitle" TEXT,
    "videoArtist" TEXT,
    "videoThumb" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_friendshipId_createdAt_idx" ON "Message"("friendshipId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_friendshipId_fkey" FOREIGN KEY ("friendshipId") REFERENCES "Friendship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
