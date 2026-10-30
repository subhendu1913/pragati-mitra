import { cookies } from "next/headers";
import crypto from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, businesses } from "@/db/schema";
import type { BusinessRow, UserRow } from "@/db/schema";

export const SESSION_COOKIE = "pm_session";
export const GUEST_COOKIE = "pm_guest";
export const DEFAULT_GUEST_BIZ = "odisha-metal-works";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface SessionContext {
  user: UserRow;
  business: BusinessRow | null;
  isDemo: boolean;
}

export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (rows.length === 0) return null;
  const { user } = rows[0];
  let business: BusinessRow | null = null;
  if (user.businessId) {
    const b = await db.select().from(businesses).where(eq(businesses.id, user.businessId)).limit(1);
    business = b[0] ?? null;
  }
  return { user, business, isDemo: user.isDemo };
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function setGuestCookie(value: string) {
  const store = await cookies();
  store.set(GUEST_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });
}

export async function clearGuestCookie() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
}

// Guest (no-login) demo context: always a fictional demo user, never real business data.
export async function guestContext(): Promise<SessionContext> {
  const store = await cookies();
  const slug = store.get(GUEST_COOKIE)?.value;
  if (slug === "cluster") {
    const u = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "cluster"), eq(users.isDemo, true)))
      .limit(1);
    if (u[0]) return { user: u[0], business: null, isDemo: true };
  }
  const bizSlug = slug && slug !== "cluster" ? slug : DEFAULT_GUEST_BIZ;
  let b = (
    await db.select().from(businesses).where(and(eq(businesses.slug, bizSlug), eq(businesses.isDemo, true))).limit(1)
  )[0];
  if (!b) {
    b = (await db.select().from(businesses).where(eq(businesses.isDemo, true)).limit(1))[0];
  }
  if (!b) throw new Error("No demo business available");
  const u = await db
    .select()
    .from(users)
    .where(and(eq(users.businessId, b.id), eq(users.role, "owner"), eq(users.isDemo, true)))
    .limit(1);
  return { user: u[0], business: b, isDemo: true };
}

// Session if present, otherwise the open guest demo context.
export async function getContext(): Promise<SessionContext> {
  const s = await getSession();
  return s ?? (await guestContext());
}
