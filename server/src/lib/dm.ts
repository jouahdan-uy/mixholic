// server/src/lib/dm.ts
//
// Shared logic for friendships, DM streaks, and read-tracking — used by
// BOTH server/index.ts (REST, Elysia) and server/socket.ts (real-time,
// Socket.IO). Keeping it here means the two servers never disagree about
// how a streak is counted or what "unread" means.

import { prisma } from "./prisma.ts";

// Finds the (single, direction-agnostic) friendship row between two users, if any.
export function findFriendship(userAId: number, userBId: number) {
  return prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userAId, addresseeId: userBId },
        { requesterId: userBId, addresseeId: userAId },
      ],
    },
  });
}

// Friendship status of `viewerId` relative to `targetId`, from the viewer's
// point of view — used to decide which button/label to show on a profile.
export async function friendshipStatusFor(viewerId: number | null, targetId: number) {
  if (!viewerId) return "guest";
  if (viewerId === targetId) return "self";
  const friendship = await findFriendship(viewerId, targetId);
  if (!friendship) return "none";
  if (friendship.status === "ACCEPTED") return "friends";
  return friendship.requesterId === viewerId ? "outgoing" : "incoming";
}

// --- Direct message streaks (TikTok-style) ---------------------------------
// UTC midnight of the given date, used as a plain "which calendar day"
// marker so we never have to worry about time-of-day, only date equality.
export function dayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
export function sameDay(a: Date | null, b: Date) {
  return !!a && dayStart(a).getTime() === dayStart(b).getTime();
}
export function isYesterdayOf(a: Date | null, b: Date) {
  if (!a) return false;
  const prev = new Date(dayStart(b));
  prev.setUTCDate(prev.getUTCDate() - 1);
  return dayStart(a).getTime() === prev.getTime();
}

type StreakFields = {
  streakCount: number;
  streakLastDate: Date | null;
};

// The number to actually show the user: once a full day goes by with no
// mutual check-in, the streak has "died" — we don't wait for a write to
// tell them, we just stop showing it.
export function streakInfoFor(friendship: StreakFields, now = new Date()) {
  const alive = sameDay(friendship.streakLastDate, now) || isYesterdayOf(friendship.streakLastDate, now);
  const count = alive ? friendship.streakCount : 0;
  return {
    count,
    // Only shown once it's actually a "streak", same threshold TikTok uses.
    isActive: count >= 5,
    updatedToday: sameDay(friendship.streakLastDate, now),
  };
}

// Call after saving a new message. Marks `senderId`'s side as having
// checked in today; if that means BOTH sides have now messaged today (and
// today hasn't already been counted), advances — or starts — the streak.
export async function bumpStreak(friendshipId: number, requesterId: number, addresseeId: number, senderId: number) {
  const friendship = await prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  const now = new Date();
  const isRequester = senderId === requesterId;

  const requesterLastMsgAt = isRequester ? now : friendship.requesterLastMsgAt;
  const addresseeLastMsgAt = isRequester ? friendship.addresseeLastMsgAt : now;

  const bothToday = sameDay(requesterLastMsgAt, now) && sameDay(addresseeLastMsgAt, now);
  let { streakCount, streakLastDate } = friendship;

  if (bothToday && !sameDay(streakLastDate, now)) {
    streakCount = isYesterdayOf(streakLastDate, now) ? streakCount + 1 : 1;
    streakLastDate = now;
  } else if (!sameDay(streakLastDate, now) && !isYesterdayOf(streakLastDate, now)) {
    // Gap of 2+ days since the last counted day — the old streak is dead,
    // even if it hasn't been "seen" as dead yet.
    streakCount = 0;
  }

  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { requesterLastMsgAt, addresseeLastMsgAt, streakCount, streakLastDate },
  });
}

// --- Read tracking / unread badges ------------------------------------------
type ReadFields = {
  requesterId: number;
  addresseeId: number;
  requesterLastReadAt: Date | null;
  addresseeLastReadAt: Date | null;
};

// The timestamp "userId"'s side of this friendship last marked as read.
export function lastReadAtFor(friendship: ReadFields, userId: number) {
  return friendship.requesterId === userId ? friendship.requesterLastReadAt : friendship.addresseeLastReadAt;
}

// How many messages in this thread `userId` hasn't seen yet — messages
// from the OTHER person, sent after userId's own last-read mark.
export async function unreadCountFor(friendship: ReadFields, userId: number) {
  const since = lastReadAtFor(friendship, userId);
  return prisma.message.count({
    where: {
      friendshipId: (friendship as any).id,
      senderId: { not: userId },
      ...(since ? { createdAt: { gt: since } } : {}),
    },
  });
}

// Marks everything in this thread as read, from userId's side, up to now.
export async function markRead(friendshipId: number, requesterId: number, addresseeId: number, userId: number) {
  const isRequester = userId === requesterId;
  return prisma.friendship.update({
    where: { id: friendshipId },
    data: isRequester ? { requesterLastReadAt: new Date() } : { addresseeLastReadAt: new Date() },
  });
}
