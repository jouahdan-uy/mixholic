import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { Resend } from "resend";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "./src/lib/prisma.ts";
import { findFriendship, friendshipStatusFor, streakInfoFor, bumpStreak, unreadCountFor } from "./src/lib/dm.ts";

// No insecure fallback: previously this defaulted to a hardcoded string, so
// a missing env var meant the server still booted fine but every JWT could
// be forged by anyone who knew the default. Fail loudly instead.
if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Add a long random value to server/.env before starting the server."
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ONLINE_THRESHOLD_MS = 90 * 1000; // no heartbeat in 90s = offline

// ---------------------------------------------------------------------
// Rate limiting — simple in-memory sliding window, keyed by client IP +
// bucket name. Good enough for a single-process deploy; if this ever runs
// as multiple instances behind a load balancer, swap this for a shared
// store (e.g. Redis) instead.
// ---------------------------------------------------------------------
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

// Periodic cleanup so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function clientIp(request: Request, server: { requestIP?: (req: Request) => { address: string } | null } | null) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return server?.requestIP?.(request)?.address || "unknown";
}

const resend = new Resend(process.env.RESEND_API_KEY);
const MAIL_FROM = process.env.MAIL_FROM || "Mixholic <onboarding@resend.dev>";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type PresenceFields = {
  lastSeenAt: Date | null;
  nowPlayingVideoId: string | null;
  nowPlayingTitle: string | null;
  nowPlayingArtist: string | null;
};

// No websockets here — "online" just means we got a heartbeat recently.
// Not real-time, but close enough for a little green dot.
function presenceOf(user: PresenceFields) {
  const isOnline = !!user.lastSeenAt && Date.now() - user.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
  return {
    isOnline,
    nowPlaying: isOnline && user.nowPlayingVideoId
      ? { videoId: user.nowPlayingVideoId, title: user.nowPlayingTitle, artist: user.nowPlayingArtist }
      : null,
  };
}

// Public shape of a user we're okay sending to the client (includes email —
// only ever returned to the account owner themselves).
function publicUser(user: { id: number; email: string; username: string; avatarUrl: string | null; bio: string | null; gender: string | null; createdAt: Date } & PresenceFields) {
  return {
    id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl,
    bio: user.bio, gender: user.gender, createdAt: user.createdAt, ...presenceOf(user),
  };
}

// Shape of a user shown on someone else's screen — no email.
function publicProfile(user: { id: number; username: string; avatarUrl: string | null; bio: string | null; gender: string | null; createdAt: Date } & PresenceFields) {
  return {
    id: user.id, username: user.username, avatarUrl: user.avatarUrl,
    bio: user.bio, gender: user.gender, createdAt: user.createdAt, ...presenceOf(user),
  };
}

const app = new Elysia()
  // Allow the Vite dev server (and anything else) to call this API with a
  // Bearer token in the Authorization header.
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET,
      exp: "30d",
    })
  )
  // Reads the "Authorization: Bearer <token>" header on every request and
  // resolves it to a userId (or null if missing/invalid). Individual routes
  // decide whether they require it.
  .derive(async ({ jwt, headers }) => {
    const header = headers.authorization;
    if (!header?.startsWith("Bearer ")) return { userId: null as number | null };
    try {
      const payload = await jwt.verify(header.slice(7));
      if (!payload || !payload.sub) return { userId: null as number | null };
      return { userId: Number(payload.sub) };
    } catch {
      return { userId: null as number | null };
    }
  })

  .get("/", () => ({ message: "Mixholic Backend is running 🎧" }))
  .get("/api/hello", () => ({ message: "Hello from Mixholic API!" }))

  // ---------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------
  .post(
    "/api/auth/signup",
    async ({ body, jwt, set, request, server }) => {
      if (!checkRateLimit(`signup:${clientIp(request, server)}`, 10, 15 * 60 * 1000)) {
        set.status = 429;
        return { error: "Terlalu banyak percobaan daftar. Coba lagi dalam beberapa menit." };
      }
      const email = body.email.trim().toLowerCase();
      const username = body.username.trim();

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        set.status = 409;
        return {
          error:
            existing.email === email
              ? "Email sudah terdaftar."
              : "Username sudah dipakai.",
        };
      }

      const hashed = await Bun.password.hash(body.password);
      const user = await prisma.user.create({
        data: { email, username, password: hashed, gender: body.gender },
      });

      const token = await jwt.sign({ sub: String(user.id) });
      set.status = 201;
      return { token, user: publicUser(user) };
    },
    {
      body: t.Object({
        email: t.String({ format: "email", error: "Email tidak valid." }),
        username: t.String({ minLength: 3, maxLength: 24, error: "Username 3-24 karakter." }),
        password: t.String({ minLength: 6, error: "Password minimal 6 karakter." }),
        gender: t.Optional(t.Union([t.Literal("MALE"), t.Literal("FEMALE"), t.Literal("OTHER")])),
      }),
    }
  )

  .post(
    "/api/auth/login",
    async ({ body, jwt, set, request, server }) => {
      if (!checkRateLimit(`login:${clientIp(request, server)}`, 10, 15 * 60 * 1000)) {
        set.status = 429;
        return { error: "Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit." };
      }
      const identifier = body.identifier.trim().toLowerCase();
      const user = await prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { username: body.identifier.trim() }] },
      });
      if (!user) {
        set.status = 401;
        return { error: "Email/username atau password salah." };
      }

      const valid = await Bun.password.verify(body.password, user.password);
      if (!valid) {
        set.status = 401;
        return { error: "Email/username atau password salah." };
      }

      const token = await jwt.sign({ sub: String(user.id) });
      return { token, user: publicUser(user) };
    },
    {
      body: t.Object({
        identifier: t.String(),
        password: t.String(),
      }),
    }
  )

  // Always responds the same way whether or not the email is registered,
  // so this can't be used to probe which emails have accounts.
  .post(
    "/api/auth/forgot-password",
    async ({ body, set, request, server }) => {
      if (!checkRateLimit(`forgot:${clientIp(request, server)}`, 5, 15 * 60 * 1000)) {
        // Same generic response as a normal request — don't leak that the
        // limit was hit, just stop actually sending more emails.
        set.status = 200;
        return { message: "Kalau email itu terdaftar, link reset password sudah dikirim." };
      }
      const email = body.email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        await prisma.passwordResetToken.create({
          data: { userId: user.id, token, expiresAt },
        });

        const resetUrl = `${FRONTEND_URL}/?resetToken=${token}`;
        try {
          await resend.emails.send({
            from: MAIL_FROM,
            to: user.email,
            subject: "Reset password Mixholic kamu",
            html: `<p>Klik link berikut untuk atur ulang password Mixholic kamu. Link ini berlaku 1 jam.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Kalau bukan kamu yang minta ini, abaikan saja email ini — password kamu masih aman.</p>`,
          });
        } catch (err) {
          // Don't fail the request just because the email provider hiccuped —
          // log it so it's visible in the server console during dev.
          console.error("Gagal mengirim email reset password:", err);
        }
      }

      set.status = 200;
      return { message: "Kalau email itu terdaftar, link reset password sudah dikirim." };
    },
    {
      body: t.Object({
        email: t.String(),
      }),
    }
  )

  .post(
    "/api/auth/reset-password",
    async ({ body, set, request, server }) => {
      if (!checkRateLimit(`reset:${clientIp(request, server)}`, 10, 15 * 60 * 1000)) {
        set.status = 429;
        return { error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." };
      }
      const record = await prisma.passwordResetToken.findUnique({
        where: { token: body.token },
      });
      if (!record || record.usedAt || record.expiresAt < new Date()) {
        set.status = 400;
        return { error: "Link reset sudah tidak valid atau kedaluwarsa. Minta link baru, ya." };
      }

      const hashed = await Bun.password.hash(body.password);
      await prisma.$transaction([
        prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
        prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      ]);

      return { success: true };
    },
    {
      body: t.Object({
        token: t.String(),
        password: t.String({ minLength: 6, error: "Password minimal 6 karakter." }),
      }),
    }
  )

  .get("/api/auth/me", async ({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    return { user: publicUser(user) };
  })

  // Update your own username, bio, and/or gender.
  .patch(
    "/api/auth/profile",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const data: { username?: string; bio?: string; gender?: "MALE" | "FEMALE" | "OTHER" } = {};

      if (body.username !== undefined) {
        const username = body.username.trim();
        const existing = await prisma.user.findFirst({
          where: { username, NOT: { id: userId } },
        });
        if (existing) {
          set.status = 409;
          return { error: "Username sudah dipakai." };
        }
        data.username = username;
      }

      if (body.bio !== undefined) {
        data.bio = body.bio.trim().slice(0, 160);
      }

      if (body.gender !== undefined) {
        data.gender = body.gender;
      }

      const user = await prisma.user.update({ where: { id: userId }, data });
      return { user: publicUser(user) };
    },
    {
      body: t.Object({
        username: t.Optional(t.String({ minLength: 3, maxLength: 24, error: "Username 3-24 karakter." })),
        bio: t.Optional(t.String({ maxLength: 160, error: "Bio maksimal 160 karakter." })),
        gender: t.Optional(t.Union([t.Literal("MALE"), t.Literal("FEMALE"), t.Literal("OTHER")])),
      }),
    }
  )

  // Uploads a profile picture to Cloudinary and saves the resulting URL.
  // Re-uploading overwrites the same public_id, so old avatars don't pile up.
  .post(
    "/api/auth/avatar",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const file = body.avatar;
      if (!file || file.size === 0) {
        set.status = 400;
        return { error: "Gak ada file yang diupload." };
      }
      if (!file.type?.startsWith("image/")) {
        set.status = 400;
        return { error: "File harus berupa gambar." };
      }
      if (file.size > MAX_AVATAR_BYTES) {
        set.status = 400;
        return { error: "Ukuran gambar maksimal 5MB." };
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

        const result = await cloudinary.uploader.upload(dataUri, {
          folder: "mixholic/avatars",
          public_id: `user_${userId}`,
          overwrite: true,
          resource_type: "image",
          transformation: [{ width: 256, height: 256, crop: "fill", gravity: "face" }],
        });

        const user = await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: result.secure_url },
        });
        return { user: publicUser(user) };
      } catch (err) {
        console.error("Gagal upload avatar ke Cloudinary:", err);
        set.status = 502;
        return { error: "Gagal upload gambar. Coba lagi." };
      }
    },
    {
      body: t.Object({
        avatar: t.File(),
      }),
    }
  )

  // Heartbeat — call this every ~25s while the app is open (and whenever
  // the current track changes) so other people can see you as online and,
  // optionally, what you're currently listening to.
  .post(
    "/api/presence/ping",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastSeenAt: new Date(),
          nowPlayingVideoId: body.videoId ?? null,
          nowPlayingTitle: body.title ?? null,
          nowPlayingArtist: body.artist ?? null,
        },
      });
      return { success: true };
    },
    {
      body: t.Object({
        videoId: t.Optional(t.Nullable(t.String())),
        title: t.Optional(t.Nullable(t.String())),
        artist: t.Optional(t.Nullable(t.String())),
      }),
    }
  )

  // ---------------------------------------------------------------------
  // Users — public profiles + search
  // ---------------------------------------------------------------------
  .get(
    "/api/users/search",
    async ({ userId, query, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const q = (query.q || "").trim();
      if (q.length < 2) return { users: [] };

      const users = await prisma.user.findMany({
        where: {
          username: { contains: q, mode: "insensitive" },
          NOT: { id: userId },
        },
        take: 15,
        orderBy: { username: "asc" },
      });

      const results = await Promise.all(
        users.map(async (u) => ({
          ...publicProfile(u),
          friendshipStatus: await friendshipStatusFor(userId, u.id),
        }))
      );
      return { users: results };
    },
    {
      query: t.Object({ q: t.Optional(t.String()) }),
    }
  )

  .get("/api/users/:username", async ({ userId, params, set }) => {
    const user = await prisma.user.findUnique({ where: { username: params.username } });
    if (!user) {
      set.status = 404;
      return { error: "User tidak ditemukan." };
    }
    const [favorites, playlists] = await Promise.all([
      prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.playlist.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { tracks: { take: 1, orderBy: { createdAt: "desc" } }, _count: { select: { tracks: true } } },
      }),
    ]);
    const friendshipStatus = await friendshipStatusFor(userId, user.id);
    return {
      user: {
        ...publicProfile(user),
        favorites,
        friendshipStatus,
        playlists: playlists.map((p) => ({
          id: p.id,
          name: p.name,
          trackCount: p._count.tracks,
          thumb: p.tracks[0]?.thumb || null,
        })),
      },
    };
  })

  // ---------------------------------------------------------------------
  // Friends
  // ---------------------------------------------------------------------
  .get("/api/friends", async ({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: { requester: true, addressee: true },
    });
    const friends = friendships.map((f) =>
      publicProfile(f.requesterId === userId ? f.addressee : f.requester)
    );
    return { friends };
  })

  .get("/api/friends/requests", async ({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const requests = await prisma.friendship.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      include: { requester: true },
      orderBy: { createdAt: "desc" },
    });
    return { requests: requests.map((r) => publicProfile(r.requester)) };
  })

  .post(
    "/api/friends/request",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const target = await prisma.user.findUnique({ where: { username: body.username } });
      if (!target) {
        set.status = 404;
        return { error: "User tidak ditemukan." };
      }
      if (target.id === userId) {
        set.status = 400;
        return { error: "Gak bisa nambahin diri sendiri." };
      }

      const existing = await findFriendship(userId, target.id);
      if (existing?.status === "ACCEPTED") {
        set.status = 409;
        return { error: "Kalian udah berteman." };
      }
      // If they already sent us a request, accept it instead of creating a
      // duplicate (mutual request = instant friendship).
      if (existing?.status === "PENDING" && existing.requesterId === target.id) {
        const friendship = await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: "ACCEPTED" },
        });
        return { status: "friends", friendship };
      }
      if (existing?.status === "PENDING") {
        set.status = 409;
        return { error: "Permintaan pertemanan udah dikirim." };
      }

      await prisma.friendship.create({
        data: { requesterId: userId, addresseeId: target.id, status: "PENDING" },
      });
      return { status: "outgoing" };
    },
    {
      body: t.Object({ username: t.String() }),
    }
  )

  .post("/api/friends/:username/accept", async ({ userId, params, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const requester = await prisma.user.findUnique({ where: { username: params.username } });
    if (!requester) {
      set.status = 404;
      return { error: "User tidak ditemukan." };
    }
    const friendship = await prisma.friendship.findUnique({
      where: { requesterId_addresseeId: { requesterId: requester.id, addresseeId: userId } },
    });
    if (!friendship || friendship.status !== "PENDING") {
      set.status = 404;
      return { error: "Gak ada permintaan pertemanan dari user ini." };
    }
    await prisma.friendship.update({ where: { id: friendship.id }, data: { status: "ACCEPTED" } });
    return { status: "friends" };
  })

  // Cancels an outgoing request, declines an incoming one, or unfriends —
  // whichever applies, since it's the same row either way.
  .delete("/api/friends/:username", async ({ userId, params, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const other = await prisma.user.findUnique({ where: { username: params.username } });
    if (!other) {
      set.status = 404;
      return { error: "User tidak ditemukan." };
    }
    const friendship = await findFriendship(userId, other.id);
    if (friendship) {
      await prisma.friendship.delete({ where: { id: friendship.id } });
    }
    return { status: "none" };
  })

  // ---------------------------------------------------------------------
  // Direct messages — only ever between ACCEPTED friends. One Friendship
  // row doubles as the "conversation", so no separate thread table.
  // ---------------------------------------------------------------------
  .get("/api/dm/threads", async ({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const friendships = await prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: true,
        addressee: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const threads = await Promise.all(friendships.map(async (f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      const last = f.messages[0] || null;
      return {
        username: friend.username,
        profile: publicProfile(friend),
        streak: streakInfoFor(f),
        unreadCount: await unreadCountFor(f, userId),
        lastMessage: last
          ? {
              type: last.type,
              text: last.text,
              videoTitle: last.videoTitle,
              isMine: last.senderId === userId,
              createdAt: last.createdAt,
            }
          : null,
      };
    }));

    // Most recently active conversation first.
    threads.sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });

    return { threads };
  })

  .get("/api/dm/:username/messages", async ({ userId, params, query, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const other = await prisma.user.findUnique({ where: { username: params.username } });
    if (!other) {
      set.status = 404;
      return { error: "User tidak ditemukan." };
    }
    const friendship = await findFriendship(userId, other.id);
    if (!friendship || friendship.status !== "ACCEPTED") {
      set.status = 403;
      return { error: "Kalian belum berteman." };
    }

    const since = query.since ? new Date(query.since) : null;
    const messages = await prisma.message.findMany({
      where: {
        friendshipId: friendship.id,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return {
      friend: publicProfile(other),
      streak: streakInfoFor(friendship),
      messages: messages.map((m) => ({
        id: m.id,
        type: m.type,
        text: m.text,
        videoId: m.videoId,
        videoTitle: m.videoTitle,
        videoArtist: m.videoArtist,
        videoThumb: m.videoThumb,
        isMine: m.senderId === userId,
        createdAt: m.createdAt,
      })),
    };
  })

  .post(
    "/api/dm/:username/messages",
    async ({ userId, params, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const other = await prisma.user.findUnique({ where: { username: params.username } });
      if (!other) {
        set.status = 404;
        return { error: "User tidak ditemukan." };
      }
      const friendship = await findFriendship(userId, other.id);
      if (!friendship || friendship.status !== "ACCEPTED") {
        set.status = 403;
        return { error: "Kalian belum berteman." };
      }
      if (body.type === "TEXT" && !body.text?.trim()) {
        set.status = 400;
        return { error: "Pesan gak boleh kosong." };
      }
      if (body.type === "SONG" && !body.videoId) {
        set.status = 400;
        return { error: "Lagu gak valid." };
      }

      const message = await prisma.message.create({
        data: {
          friendshipId: friendship.id,
          senderId: userId,
          type: body.type,
          text: body.type === "TEXT" ? body.text!.trim().slice(0, 2000) : null,
          videoId: body.type === "SONG" ? body.videoId : null,
          videoTitle: body.type === "SONG" ? body.videoTitle : null,
          videoArtist: body.type === "SONG" ? body.videoArtist : null,
          videoThumb: body.type === "SONG" ? body.videoThumb : null,
        },
      });

      const updated = await bumpStreak(friendship.id, friendship.requesterId, friendship.addresseeId, userId);

      return {
        message: {
          id: message.id,
          type: message.type,
          text: message.text,
          videoId: message.videoId,
          videoTitle: message.videoTitle,
          videoArtist: message.videoArtist,
          videoThumb: message.videoThumb,
          isMine: true,
          createdAt: message.createdAt,
        },
        streak: streakInfoFor(updated),
      };
    },
    {
      body: t.Object({
        type: t.Union([t.Literal("TEXT"), t.Literal("SONG")]),
        text: t.Optional(t.String()),
        videoId: t.Optional(t.String()),
        videoTitle: t.Optional(t.String()),
        videoArtist: t.Optional(t.String()),
        videoThumb: t.Optional(t.String()),
      }),
    }
  )

  // ---------------------------------------------------------------------
  // Playlists — owner-only to create/rename/delete/edit tracks; reading a
  // single playlist is public (same spirit as favorites being viewable).
  // ---------------------------------------------------------------------
  .get("/api/playlists", async ({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const playlists = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { tracks: { take: 1, orderBy: { createdAt: "desc" } }, _count: { select: { tracks: true } } },
    });
    return {
      playlists: playlists.map((p) => ({
        id: p.id,
        name: p.name,
        trackCount: p._count.tracks,
        thumb: p.tracks[0]?.thumb || null,
      })),
    };
  })

  .post(
    "/api/playlists",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const playlist = await prisma.playlist.create({
        data: { userId, name: body.name.trim() },
      });
      set.status = 201;
      return { playlist: { id: playlist.id, name: playlist.name, trackCount: 0, thumb: null } };
    },
    {
      body: t.Object({ name: t.String({ minLength: 1, maxLength: 60, error: "Nama playlist 1-60 karakter." }) }),
    }
  )

  .get("/api/playlists/:id", async ({ params, set }) => {
    const id = Number(params.id);
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: { tracks: { orderBy: { createdAt: "asc" } }, user: true },
    });
    if (!playlist) {
      set.status = 404;
      return { error: "Playlist tidak ditemukan." };
    }
    return {
      playlist: {
        id: playlist.id,
        name: playlist.name,
        owner: publicProfile(playlist.user),
        tracks: playlist.tracks,
      },
    };
  })

  .patch(
    "/api/playlists/:id",
    async ({ userId, params, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const id = Number(params.id);
      const playlist = await prisma.playlist.findUnique({ where: { id } });
      if (!playlist || playlist.userId !== userId) {
        set.status = 404;
        return { error: "Playlist tidak ditemukan." };
      }
      const updated = await prisma.playlist.update({ where: { id }, data: { name: body.name.trim() } });
      return { playlist: { id: updated.id, name: updated.name } };
    },
    {
      body: t.Object({ name: t.String({ minLength: 1, maxLength: 60, error: "Nama playlist 1-60 karakter." }) }),
    }
  )

  .delete("/api/playlists/:id", async ({ userId, params, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const id = Number(params.id);
    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist || playlist.userId !== userId) {
      set.status = 404;
      return { error: "Playlist tidak ditemukan." };
    }
    await prisma.playlist.delete({ where: { id } });
    return { success: true };
  })

  .post(
    "/api/playlists/:id/tracks",
    async ({ userId, params, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const id = Number(params.id);
      const playlist = await prisma.playlist.findUnique({ where: { id } });
      if (!playlist || playlist.userId !== userId) {
        set.status = 404;
        return { error: "Playlist tidak ditemukan." };
      }
      const track = await prisma.playlistTrack.upsert({
        where: { playlistId_videoId: { playlistId: id, videoId: body.videoId } },
        update: { title: body.title, artist: body.artist, thumb: body.thumb },
        create: {
          playlistId: id,
          videoId: body.videoId,
          title: body.title,
          artist: body.artist,
          thumb: body.thumb,
        },
      });
      set.status = 201;
      return { track };
    },
    {
      body: t.Object({
        videoId: t.String(),
        title: t.Optional(t.String()),
        artist: t.Optional(t.String()),
        thumb: t.Optional(t.String()),
      }),
    }
  )

  .delete("/api/playlists/:id/tracks/:videoId", async ({ userId, params, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const id = Number(params.id);
    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist || playlist.userId !== userId) {
      set.status = 404;
      return { error: "Playlist tidak ditemukan." };
    }
    await prisma.playlistTrack.deleteMany({ where: { playlistId: id, videoId: params.videoId } });
    return { success: true };
  })

  // ---------------------------------------------------------------------
  // Listening stats — logged automatically by the frontend while a track
  // plays, no manual "log this" action from the user.
  // ---------------------------------------------------------------------
  .post(
    "/api/stats/log",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      await prisma.listeningStat.upsert({
        where: { userId_videoId_yearMonth: { userId, videoId: body.videoId, yearMonth } },
        update: {
          seconds: { increment: Math.max(0, Math.round(body.secondsDelta || 0)) },
          playCount: { increment: body.isNewPlay ? 1 : 0 },
          ...(body.title ? { title: body.title } : {}),
          ...(body.artist ? { artist: body.artist } : {}),
        },
        create: {
          userId,
          videoId: body.videoId,
          yearMonth,
          seconds: Math.max(0, Math.round(body.secondsDelta || 0)),
          playCount: body.isNewPlay ? 1 : 0,
          title: body.title,
          artist: body.artist,
        },
      });
      return { success: true };
    },
    {
      body: t.Object({
        videoId: t.String(),
        title: t.Optional(t.String()),
        artist: t.Optional(t.String()),
        secondsDelta: t.Optional(t.Number()),
        isNewPlay: t.Optional(t.Boolean()),
      }),
    }
  )

  // Aggregated summary for either the current calendar month or year —
  // total minutes/plays, plus top tracks and top artists (our stand-in
  // for "vibe", since YouTube doesn't give us genre data to work with).
  .get(
    "/api/stats/summary",
    async ({ userId, query, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const now = new Date();
      const period = query.period === "year" ? "year" : "month";
      const defaultValue =
        period === "year"
          ? String(now.getFullYear())
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const value = query.value || defaultValue;

      const rows = await prisma.listeningStat.findMany({
        where:
          period === "year"
            ? { userId, yearMonth: { startsWith: value } }
            : { userId, yearMonth: value },
      });

      const totalSeconds = rows.reduce((sum, r) => sum + r.seconds, 0);
      const totalPlays = rows.reduce((sum, r) => sum + r.playCount, 0);

      const topTracks = [...rows]
        .sort((a, b) => b.playCount - a.playCount || b.seconds - a.seconds)
        .slice(0, 5)
        .map((r) => ({ videoId: r.videoId, title: r.title, artist: r.artist, playCount: r.playCount, seconds: r.seconds }));

      const artistMap = new Map<string, { artist: string; playCount: number; seconds: number }>();
      for (const r of rows) {
        const key = r.artist?.trim() || "Unknown artist";
        const cur = artistMap.get(key) || { artist: key, playCount: 0, seconds: 0 };
        cur.playCount += r.playCount;
        cur.seconds += r.seconds;
        artistMap.set(key, cur);
      }
      const topArtists = [...artistMap.values()].sort((a, b) => b.playCount - a.playCount || b.seconds - a.seconds).slice(0, 5);

      return {
        period,
        value,
        totalSeconds,
        totalMinutes: Math.round(totalSeconds / 60),
        totalPlays,
        uniqueTracks: rows.length,
        topTracks,
        topArtists,
      };
    },
    {
      query: t.Object({
        period: t.Optional(t.String()),
        value: t.Optional(t.String()),
      }),
    }
  )

  // ---------------------------------------------------------------------
  // Favorites — all routes below require a valid Bearer token
  // ---------------------------------------------------------------------
  .get("/api/favorites", async ({ userId, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return { favorites };
  })

  .post(
    "/api/favorites",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const favorite = await prisma.favorite.upsert({
        where: { userId_videoId: { userId, videoId: body.videoId } },
        update: {
          title: body.title,
          artist: body.artist,
          thumb: body.thumb,
        },
        create: {
          userId,
          videoId: body.videoId,
          title: body.title,
          artist: body.artist,
          thumb: body.thumb,
        },
      });
      set.status = 201;
      return { favorite };
    },
    {
      body: t.Object({
        videoId: t.String(),
        title: t.Optional(t.String()),
        artist: t.Optional(t.String()),
        thumb: t.Optional(t.String()),
      }),
    }
  )

  // Bulk-add favorites the user had saved locally before logging in, so
  // nothing gets lost the first time they sign in on a device.
  .post(
    "/api/favorites/sync",
    async ({ userId, body, set }) => {
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (body.videoIds.length === 0) return { favorites: [] };

      await prisma.$transaction(
        body.videoIds.map((videoId) =>
          prisma.favorite.upsert({
            where: { userId_videoId: { userId, videoId } },
            update: {},
            create: { userId, videoId },
          })
        )
      );
      const favorites = await prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return { favorites };
    },
    {
      body: t.Object({
        videoIds: t.Array(t.String()),
      }),
    }
  )

  .delete("/api/favorites/:videoId", async ({ userId, params, set }) => {
    if (!userId) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    await prisma.favorite.deleteMany({
      where: { userId, videoId: params.videoId },
    });
    return { success: true };
  })
export default app;

