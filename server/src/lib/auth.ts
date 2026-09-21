// server/src/lib/auth.ts
//
// Verifies the same JWT that index.ts issues (via @elysiajs/jwt, HS256,
// payload = { sub: "<userId>" }), but without needing Elysia — so
// socket.ts (plain Socket.IO, not an Elysia app) can check tokens too.

import { jwtVerify } from "jose";

// No insecure fallback: without a real secret in .env, both this file and
// index.ts would silently accept a well-known default, letting anyone
// forge a valid token. Fail loudly at boot instead.
if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Add a long random value to server/.env before starting the server."
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const secretKey = new TextEncoder().encode(JWT_SECRET);

// Returns the userId encoded in the token, or null if it's missing,
// expired, or doesn't check out.
export async function verifyToken(token: string | undefined | null): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    const id = Number(payload.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}
