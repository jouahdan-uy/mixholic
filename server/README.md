# server

Mixholic's backend: accounts (sign up / login) and per-user favorite
tracks, built with Bun + Elysia + Prisma (Postgres).

To install dependencies:

```bash
bun install
```

Make sure `.env` has `DATABASE_URL` and `JWT_SECRET` set (both are already
filled in for this project — replace `JWT_SECRET` before deploying
anywhere real).

Apply the database schema (creates the `User` and `Favorite` tables):

```bash
bunx prisma migrate dev --name add_favorites
```

To run:

```bash
bun run index.ts
```

Routes: `POST /api/auth/signup`, `POST /api/auth/login`, `POST
/api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST
/api/auth/avatar`, `GET /api/auth/me`, `GET /api/favorites`, `POST
/api/favorites`, `DELETE /api/favorites/:videoId`, `POST
/api/favorites/sync`. All the `/api/favorites*` routes, `/api/auth/me`,
and `/api/auth/avatar` require an `Authorization: Bearer <token>` header.

Forgot-password emails go out through [Resend](https://resend.com) — set
`RESEND_API_KEY` in `.env` to actually send them (a key-less setup still
works for every other route, it just logs an error instead of emailing).

Avatar uploads (`POST /api/auth/avatar`, multipart form field `avatar`,
5MB max) go to [Cloudinary](https://console.cloudinary.com/settings/api-keys) —
set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` in `.env` for this route to work.

### Profiles & friends

`PATCH /api/auth/profile` updates your own username/bio. `GET
/api/users/:username` is a public route (no auth needed) that returns a
user's bio, avatar, and favorites — that's what powers both your own
profile page and other people's. `GET /api/users/search?q=` (needs auth)
finds accounts by username.

Friends use a single `Friendship` row per pair with a `PENDING` /
`ACCEPTED` status — `POST /api/friends/request`, `POST
/api/friends/:username/accept`, and `DELETE /api/friends/:username`
(covers cancel / decline / unfriend, since it's the same row either way).
Sending a request to someone who already requested you accepts it
instantly instead of creating a duplicate. `GET /api/friends` and `GET
/api/friends/requests` list your accepted friends and incoming requests.

Signup also accepts an optional `gender` (`MALE` / `FEMALE` / `OTHER`),
stored on the user and editable later via `PATCH /api/auth/profile`.

Playlists (`Playlist` + `PlaylistTrack`) are owner-only to create, rename,
delete, and add/remove tracks (`GET/POST /api/playlists`, `GET/PATCH/DELETE
/api/playlists/:id`, `POST /api/playlists/:id/tracks`, `DELETE
/api/playlists/:id/tracks/:videoId`) — but reading one (`GET
/api/playlists/:id`) is public, same as favorites. A user's own playlists
list also comes back (lightweight, with track counts) from `GET
/api/users/:username`.

### Presence (online status / now playing)

No websockets — `POST /api/presence/ping` (body: `{ videoId, title,
artist }`, all nullable) is a heartbeat the frontend calls every ~25s.
It stamps `lastSeenAt` and stores what's playing (or clears it if
`videoId` is null). Every response that includes a user — `publicUser`,
`publicProfile`, and therefore search results, friends, friend requests,
and `GET /api/users/:username` — adds `isOnline` (computed as `lastSeenAt`
within the last `ONLINE_THRESHOLD_MS`, currently 90s) and `nowPlaying`
(null unless online and actually playing something).

### Listening stats (monthly / yearly)

`ListeningStat` is one row per `(user, videoId, yearMonth)` — no raw
per-play event log, just running totals, so it stays cheap to query.
`POST /api/stats/log` (body: `{ videoId, title?, artist?, secondsDelta?,
isNewPlay? }`) upserts it: `secondsDelta` adds to `seconds`, `isNewPlay`
increments `playCount` by 1. The frontend calls this automatically — once
per track start (`isNewPlay: true`), and again every ~25s while actively
playing (`secondsDelta: 25`) — there's no manual "log this" action.

`GET /api/stats/summary?period=month|year&value=2026-09|2026` (own data
only) aggregates: `period=month` matches `yearMonth` exactly, `period=year`
does a `startsWith` filter across that year's months, then sums totals
and computes `topTracks` (by play count) and `topArtists` (grouped by
artist — this is the "vibe" the profile page shows, since YouTube doesn't
expose genre data to build a real one from).

This project was created using `bun init` in bun v1.4.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
