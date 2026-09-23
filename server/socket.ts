// server/socket.ts
//
// Real-time layer for Direct Messages — runs as its OWN process/port
// (Elysia's REST API in index.ts stays on :3000 and is untouched by this
// file). Socket.IO needs a plain node:http server to attach to, which is
// why this can't just live inside index.ts.
//
// Responsibilities:
//   - authenticate each socket connection with the same JWT the REST API uses
//   - let a client send a DM ("message:send") — validated, saved, streak bumped
//   - push the new message to the recipient in real time ("message:new")
//   - track read receipts ("message:read") for the unread badge

import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { prisma } from "./src/lib/prisma.ts";
import { verifyToken } from "./src/lib/auth.ts";
import { findFriendship, bumpStreak, streakInfoFor, markRead, unreadCountFor } from "./src/lib/dm.ts";

const PORT = Number(process.env.PORT) || Number(process.env.SOCKET_PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://mixholic.vercel.app";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, credentials: true },
});

type AuthedSocket = Socket & { userId?: number };

// Every socket has to prove who it is before it's allowed to do anything.
// The client sends its JWT once, at connect time, as `auth.token`
// (see socket.io-client's `io(url, { auth: { token } })`).
io.use(async (socket: AuthedSocket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const userId = await verifyToken(token);
  if (!userId) {
    next(new Error("Unauthorized"));
    return;
  }
  socket.userId = userId;
  next();
});

io.on("connection", (socket: AuthedSocket) => {
  const userId = socket.userId!;

  // A private "mailbox" room — anything meant for this user gets sent
  // here, so we don't have to track individual socket ids (and it still
  // works fine if the same person has the app open in two tabs).
  socket.join(`user:${userId}`);

  socket.on(
    "message:send",
    async (
      payload: {
        to: string;
        type: "TEXT" | "SONG";
        text?: string;
        videoId?: string;
        videoTitle?: string;
        videoArtist?: string;
        videoThumb?: string;
      },
      ack?: (response: { ok: boolean; error?: string; message?: any; streak?: any }) => void
    ) => {
      try {
        const [sender, other] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
          prisma.user.findUnique({ where: { username: payload.to } }),
        ]);
        if (!other) return ack?.({ ok: false, error: "User tidak ditemukan." });

        const friendship = await findFriendship(userId, other.id);
        if (!friendship || friendship.status !== "ACCEPTED") {
          return ack?.({ ok: false, error: "Kalian belum berteman." });
        }
        if (payload.type === "TEXT" && !payload.text?.trim()) {
          return ack?.({ ok: false, error: "Pesan gak boleh kosong." });
        }
        if (payload.type === "SONG" && !payload.videoId) {
          return ack?.({ ok: false, error: "Lagu gak valid." });
        }

        const saved = await prisma.message.create({
          data: {
            friendshipId: friendship.id,
            senderId: userId,
            type: payload.type,
            text: payload.type === "TEXT" ? payload.text!.trim().slice(0, 2000) : null,
            videoId: payload.type === "SONG" ? payload.videoId : null,
            videoTitle: payload.type === "SONG" ? payload.videoTitle : null,
            videoArtist: payload.type === "SONG" ? payload.videoArtist : null,
            videoThumb: payload.type === "SONG" ? payload.videoThumb : null,
          },
        });

        const updatedFriendship = await bumpStreak(friendship.id, friendship.requesterId, friendship.addresseeId, userId);
        const streak = streakInfoFor(updatedFriendship);

        const base = {
          id: saved.id,
          type: saved.type,
          text: saved.text,
          videoId: saved.videoId,
          videoTitle: saved.videoTitle,
          videoArtist: saved.videoArtist,
          videoThumb: saved.videoThumb,
          createdAt: saved.createdAt,
        };

        // Push to the recipient — they see it appear instantly, no polling.
        io.to(`user:${other.id}`).emit("message:new", {
          ...base,
          isMine: false,
          fromUsername: sender?.username,
          streak,
        });

        // Echo to the sender's OTHER tabs/devices too (this tab already
        // gets the result via the ack callback below).
        socket.to(`user:${userId}`).emit("message:new", {
          ...base,
          isMine: true,
          fromUsername: payload.to,
          streak,
        });

        ack?.({
          ok: true,
          message: { ...base, isMine: true },
          streak,
        });
      } catch (err) {
        console.error("message:send failed:", err);
        ack?.({ ok: false, error: "Gagal ngirim pesan." });
      }
    }
  );

  // Client calls this when a thread is opened / becomes visible, so we can
  // clear the unread badge for it (and let other tabs know too).
  socket.on("message:read", async (payload: { withUsername: string }) => {
    try {
      const other = await prisma.user.findUnique({ where: { username: payload.withUsername } });
      if (!other) return;
      const friendship = await findFriendship(userId, other.id);
      if (!friendship) return;

      await markRead(friendship.id, friendship.requesterId, friendship.addresseeId, userId);

      // Sync the "seen" state to this user's other open tabs.
      io.to(`user:${userId}`).emit("thread:read", { username: payload.withUsername });
    } catch (err) {
      console.error("message:read failed:", err);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.IO (DM real-time) jalan di http://localhost:${PORT}`);
});
