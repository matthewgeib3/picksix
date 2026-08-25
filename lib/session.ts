import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Session handling.
 *
 * A logged-in member carries a signed cookie. The signature is made with
 * SESSION_SECRET, so the browser can read the cookie but cannot forge or
 * alter one -- changing a single character invalidates it.
 */

const COOKIE = "picksix_session";
const MAX_AGE_DAYS = 200; // comfortably covers a full season

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing from .env.local");
  return new TextEncoder().encode(secret);
}

export type Session = { memberId: string };

export async function createSession(memberId: string) {
  const token = await new SignJWT({ memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(key());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
  });
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.memberId !== "string") return null;
    return { memberId: payload.memberId };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
