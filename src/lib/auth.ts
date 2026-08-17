import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { findSession, findUserById, getUser, touchUserLogin, createSession, deleteSession, enforceSessionLimit } from "./db";

export const SESSION_COOKIE = "pdftool_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export async function getCurrentUser() {
  const token = getSessionToken();
  if (!token) return null;
  const session = await findSession(token);
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  return getUser(user);
}

export async function loginUser(userId: number) {
  await enforceSessionLimit(userId);
  const token = generateSessionToken();
  await createSession(userId, token);
  setSessionCookie(token);
  await touchUserLogin(userId);
  return token;
}

export async function logout() {
  const token = getSessionToken();
  if (token) await deleteSession(token);
  clearSessionCookie();
}
