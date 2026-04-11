import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "gringotts_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

function getExpectedPassword(): string {
  const pw = process.env.AUTH_PASSWORD;
  if (!pw) throw new Error("AUTH_PASSWORD is not set");
  return pw;
}

export function checkPassword(candidate: string): boolean {
  return candidate === getExpectedPassword();
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// Request-memoized auth check. Safe to call from multiple server
// components / repos within the same request — the cookie jar is
// read once and the result is cached.
export const isAuthenticated = cache(async (): Promise<boolean> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySessionToken(token);
});

/**
 * Throws if the request is not authenticated. Call this at the top of
 * every route handler and repo function. Pair with a try/catch in
 * route handlers that maps the thrown error to a 401 response.
 */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new UnauthorizedError();
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
