# Mixholic — a turntable for your YouTube playlists

An immersive, vinyl-lounge-styled web music player built on top of the
YouTube IFrame API. Paste any YouTube / YouTube Music playlist link and get
a spinning-vinyl, glass-console player with search, favorites, a seek bar,
volume, shuffle, repeat, resume-on-reload, keyboard shortcuts and an
immersive full-screen mode.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. For production:

```bash
npm run build
npm run preview
```

> This project talks to YouTube's IFrame Player API and its public oEmbed
> endpoint over the network, so an internet connection is required at
> runtime — both for `npm install` (the original bundled `node_modules` was
> platform-specific and has been excluded) and for playback/metadata itself.

## What's inside

- **`src/hooks/usePlayerEngine.js`** — all YouTube IFrame API wiring:
  load playlist, play/pause, seek, volume, shuffle, repeat (off/all/one),
  favorites, resume-last-position, autoplay-blocked detection, toast
  notifications, and localStorage persistence of your preferences.
- **`src/hooks/useLibraryMetadata.js`** — prefetches real title/artist/
  thumbnail for every track in the loaded playlist via YouTube's public,
  keyless `oembed` endpoint (rate-limited to 4 concurrent requests, cached
  per session), so the library and search have real data to work with
  instead of only "Track N" placeholders.
- **`src/hooks/useTilt.js`** / **`useMagnetic.js`** — the pointer-driven 3D
  tilt on the console and the magnetic pull on the transport buttons.
- **`src/components/AmbientField.jsx`** — a canvas field of drifting light
  motes that part gently around the cursor.
- **`src/components/Visualizer.jsx`** — a procedural equalizer (see
  "Known limitations" below for why it isn't a true FFT).
- **`src/components/VinylDisc.jsx`** — the spinning record, tonearm, and
  album art pulled from `i.ytimg.com` thumbnails.
- **`src/components/ProgressBar.jsx`**, **`VolumeControl.jsx`**,
  **`TransportControls.jsx`** — draggable seek/volume, shuffle / prev /
  play / next / repeat / favorite with magnetic hover. Click the duration
  label to toggle between total duration and remaining time.
- **`src/components/LibraryPanel.jsx`** — a searchable, favoritable track
  list with thumbnails, a loading skeleton per row while metadata streams
  in, and empty states for "no results" and "no favorites yet."
- **`src/components/PlaylistLoader.jsx`**, **`ToastStack.jsx`**,
  **`ShortcutsHint.jsx`** — the playlist-loading overlay (with recent
  playlists), toasts, and the keyboard-shortcut cheat sheet.

## Keyboard shortcuts

| Key      | Action                          |
| -------- | -------------------------------- |
| `Space`  | Play / pause                     |
| `← / →`  | Previous / next track            |
| `↑ / ↓`  | Volume                           |
| `M`      | Mute                             |
| `S`      | Shuffle                          |
| `R`      | Cycle repeat mode                |
| `F`      | Favorite the current track       |
| `L`      | Toggle the library panel         |
| `/`      | Focus search (opens the library) |
| `I`      | Immersive / full-screen mode     |
| `?`      | Show this cheat sheet            |
| `Esc`    | Close any open panel             |

## Known limitations (and why)

This player is built on the YouTube IFrame API rather than local audio
files, which makes some things impossible to fake honestly rather than
just hard to build:

- **The visualizer is stylised, not a real FFT.** YouTube's embed does not
  expose raw PCM/frequency data to the Web Audio API across origins —
  there is no legitimate way to analyze the actual audio signal from an
  embedded YouTube player in-browser. The bars still respond to play/pause
  state so they don't feel static, but they are not reacting to the real
  waveform. Building a true analyzer would require self-hosted audio
  files, which this project doesn't have.
- **"Album" is really the channel/uploader name.** YouTube doesn't model
  a multi-track album the way a music library does, so the artist field
  is the video's `author_name`. Nothing fabricates a fake album title.
- **The queue can't be freely reordered or have arbitrary tracks queued.**
  The IFrame API only supports jumping to an index within the loaded
  playlist (`playVideoAt`) — it doesn't expose playlist mutation. The
  library lets you jump anywhere in the playlist and favorite tracks, but
  "queue" here means "this playlist," not an ad-hoc, reorderable list.
- **Track titles/artwork for the whole playlist load progressively.**
  They come from YouTube's public oEmbed endpoint, fetched a few at a time
  after the playlist loads — on a very large playlist, the bottom of the
  list may show loading skeletons for a moment before scrolling to it.
- **Autoplay may be blocked by the browser** on first load until you
  interact with the page; when detected, a toast tells you to press play
  rather than leaving the interface silently stuck.

## Persisted locally

Volume, mute state, shuffle/repeat mode, recent playlists, and your last
playback position (per playlist) are saved to `localStorage` and restored
on your next visit — none of that is sent anywhere. Favorites are saved to
`localStorage` too, and also synced to the backend (see below) whenever
you're signed in.

Everything respects `prefers-reduced-motion` and is keyboard-navigable.

## Accounts & favorites sync

The `server/` folder is a small [Bun](https://bun.com) + [Elysia](https://elysiajs.com)
+ [Prisma](https://prisma.io) API that adds real accounts:

- `POST /api/auth/signup`, `POST /api/auth/login` — email/username +
  password (hashed with `Bun.password`), returns a JWT.
- `GET /api/auth/me` — resolves the current user from the `Authorization:
  Bearer <token>` header.
- `GET /api/favorites`, `POST /api/favorites`, `DELETE
  /api/favorites/:videoId`, `POST /api/favorites/sync` — per-user favorites,
  keyed by YouTube video ID.

**Run it:**

```bash
cd server
bun install
bunx prisma migrate dev --name add_favorites   # applies the Favorite table
bun run index.ts                                 # http://localhost:3000
```

Make sure `server/.env` has `DATABASE_URL` (a Postgres connection string)
and `JWT_SECRET` (a long random string — one has already been generated
for you, but replace it before shipping this anywhere real).

In the frontend, `src/hooks/useAuth.js` talks to that API and
`src/components/AuthModal.jsx` is the sign up / login form (the "Masuk"
button in the top bar). Favorites work fully offline via `localStorage`
whether you're signed in or not; the moment you log in, local favorites
are merged with whatever's already saved on the server, and every
favorite/unfavorite after that is mirrored to your account. Point the
frontend at a different API URL with `VITE_API_URL` in `.env` if the
backend isn't on `localhost:3000`.

### Forgot password

"Lupa password?" on the login form calls `POST /api/auth/forgot-password`,
which emails a reset link via [Resend](https://resend.com) (the response
is intentionally the same whether or not the email is registered, so it
can't be used to check which emails have accounts). The link is
`FRONTEND_URL/?resetToken=<token>`; the app picks that query param up on
load, opens the reset form automatically, and strips it from the URL.
Tokens expire after 1 hour and can only be used once.

To actually send emails, set `RESEND_API_KEY` in `server/.env` (get one
at [resend.com/api-keys](https://resend.com/api-keys)) — `MAIL_FROM`
already defaults to Resend's `onboarding@resend.dev`, which works without
verifying your own domain. Without an API key the endpoint still runs (so
signup/login/etc keep working) but logs an error instead of sending mail.

### Profile picture

Once logged in, the user menu (click your name in the top bar) has a
"Ganti foto profil" option. It uploads straight to
[Cloudinary](https://cloudinary.com) via `POST /api/auth/avatar`
(multipart, 5MB max, images only), which crops it to a 256×256 face-centered
square and saves the resulting URL on the user. Set
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
in `server/.env` (from your [Cloudinary console](https://console.cloudinary.com/settings/api-keys))
for this to work — without them the upload will fail with an error toast.

### Profile page & friends

"Lihat profil" in the user menu opens `src/components/ProfileView.jsx` —
your own profile shows an editable username/bio/gender, all your saved
favorites (playable from there, each with a quick "+ playlist" dropdown
to file it into one of your playlists), your playlists, a username search
box, incoming friend requests, and your friends list. Visiting someone
else's profile shows the same layout read-only, plus a friend/unfriend
button and a "Mix bareng <name>" button. Anyone's favorites and playlists
are publicly viewable by username (`GET /api/users/:username`) — there's
no privacy toggle for that yet.

### Playlists

Custom playlists (`src/components/PlaylistDetailView.jsx`, opened by
clicking a playlist card) are separate from favorites — create one from
your profile, add tracks to it from your favorites list, rename or
delete it, and hit "Putar semua" to queue every track in order.
Playlists use the same public-by-username model as favorites.

### Mix

The "Mix bareng <name>" button on someone else's profile combines your
favorites with theirs, dedupes by video ID, shuffles the result, and
queues it up with `engine.playQueue` — it's a quick combined-listening
shuffle, not a real recommendation engine (it only looks at favorites,
not playlists, to keep it fast).

### Online status & "now playing"

There's no websocket server here, so presence is a heartbeat: while
someone's logged in, the app pings `POST /api/presence/ping` every ~25s
(and immediately on play/pause/track-change) with what they're currently
playing, if anything. The backend just checks "was the last ping under
90 seconds ago?" to decide online/offline — good enough for a little
green dot, but it's not instant (logging out, for instance, doesn't
flip you offline immediately; it just fades out over the next 90s once
pings stop). Shows up as a dot on avatars and a "Lagi dengerin: …" line
on profiles, friend lists, and search results.

### Listening stats & sharing

The profile page has a "Statistik dengerin" section (own profile only —
it's personal data, not shown on other people's profiles) with a
Bulan/Tahun toggle. It's all recorded automatically: `src/App.jsx` pings
`POST /api/stats/log` once when a track starts and again every ~25s while
it's actually playing, so minutes/plays/top-artists/top-tracks build up
in the background with nothing for the person to do. "Vibe kamu" is just
the most-played artists for that period — YouTube doesn't give genre
data, so this is the closest honest substitute rather than a real
mood/genre classifier.

"Bagikan statistik" opens `StatsShareModal.jsx`, which draws the numbers
onto a `<canvas>` (same technique as the song ShareModal) and exports a
PNG in Square (1:1, 1080×1080) or Story (9:16, 1080×1920) — no server
round-trip, it's rendered entirely client-side then downloaded.

### Design pass: matching the rest of the app's motion language

Mixholic's original screens (Home, the player, the vinyl loader) already
had a distinct "late-night listening lounge" motion vocabulary — staggered
entrances (`.reveal` / `.stagger-in`, both keyed off an inline `--i` set
per item), the 3-bar `<LiveEqualizer />`, a pulsing `.live-dot`, and a
brass shine-sweep on the primary CTA. The newer screens (Profile,
Playlist, Artist dashboard, Auth) now lean on the same primitives instead
of inventing new ones: list rows stagger in with `.stagger-in`, the
online presence dot gets the same soft pulse ring as the rest of the
app's "live" indicators, the "Lagi dengerin" line reuses
`<LiveEqualizer />`, and the Mix CTA's headline picks up the same
brass-to-lilac shimmer-text treatment already used elsewhere. Emoji
placeholders (🎵 🎧 👁 🙈) were swapped for small inline SVGs to match
the icon language used everywhere else in the app — emoji render
inconsistently across OS/browsers and read as a placeholder, not a
finished icon.

## Mixholic v2 features

- Home / Explore / Player navigation.
- Universal YouTube search for songs/videos and public playlists.
- Paste a YouTube or YouTube Music playlist URL directly from Explore or Cue playlist.
- Synchronized lyrics with click-to-seek and smooth active-line scrolling.
- Desktop lyrics live inside the same unified player card; on small screens lyrics become a bottom sheet.
- Share Song Card composer with Cinematic, Minimal and Visualizer templates.
- Share card export in Square (1080x1080), Story (1080x1920) and Landscape (1200x630).
- Media Session metadata and playback actions where the browser supports them.
- Artist dashboard (`src/components/ArtistView.jsx`): channel stats, a
  "Terbaru" section (2 most recently uploaded videos, `order=date`), a
  "Terpopuler" section (actually sorted `order=viewCount`, not just search
  relevance), an "Album" section (the channel's own public playlists —
  falls back to a broader `type=playlist` search if the channel doesn't
  publish any), and a related-artists discovery row. Clicking an album
  card loads it as a real queued playlist via `onLoadPlaylist`.

### Enable YouTube search

Copy `.env.example` to `.env` and set:

`VITE_YOUTUBE_API_KEY=your_key_here`

Enable **YouTube Data API v3** in Google Cloud. For a client-side Vite app, restrict the browser key by HTTP referrer/origin. The key is intentionally read through `import.meta.env` and should not be committed to source control.

Without a key, the Explore UI still works and gives a setup message, while direct playlist URL loading remains available.
