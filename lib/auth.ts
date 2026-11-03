import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { dbx } from "./db";

const COOKIE = "taller_sesion";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

function secret() {
  const s = process.env.SESSION_SECRET || "solo-para-desarrollo-cambia-SESSION_SECRET-en-produccion";
  return new TextEncoder().encode(s);
}

export type SessionUser = { id: number; name: string; email: string; role: string };

export async function login(email: string, password: string): Promise<boolean> {
  const user = (await dbx.get("SELECT * FROM users WHERE email = ? AND active = 1", email.trim().toLowerCase())) as (SessionUser & { password_hash: string }) | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return false;
  const token = await new SignJWT({ uid: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.PUBLIC_URL || "").startsWith("https"),
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = (await dbx.get("SELECT id, name, email, role FROM users WHERE id = ? AND active = 1", payload.uid as number)) as SessionUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/panel");
  return user;
}
