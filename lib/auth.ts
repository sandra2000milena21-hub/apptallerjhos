import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { dbx } from "./db";
import { parsePermissions, type UserPermissions } from "./permissions";

export * from "./permissions";

const COOKIE = "taller_sesion";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

function secret() {
  const s = process.env.SESSION_SECRET || "solo-para-desarrollo-cambia-SESSION_SECRET-en-produccion";
  if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16)) {
    console.warn("⚠️ ALERTA DE SEGURIDAD: SESSION_SECRET no está configurada o es muy corta. Configúrala en variables de entorno.");
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  permissions: UserPermissions;
};

export async function login(identifier: string, password: string): Promise<boolean> {
  const clean = identifier.trim().toLowerCase();
  const user = (await dbx.get(
    "SELECT * FROM users WHERE (lower(email) = ? OR lower(name) = ?) AND active = 1",
    clean,
    clean,
  )) as (SessionUser & { password_hash: string; permissions?: string | null }) | undefined;
  
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return false;
  
  const token = await new SignJWT({ uid: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
    
  const isHttps = (process.env.PUBLIC_URL || "").startsWith("https") || process.env.VERCEL === "1";
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" ? isHttps : false,
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

// cache(): el layout, la página y sus componentes comparten una sola verificación de sesión por petición.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const rawUser = (await dbx.get(
      "SELECT id, name, email, role, phone, permissions FROM users WHERE id = ? AND active = 1",
      payload.uid as number,
    )) as { id: number; name: string; email: string; role: string; phone?: string | null; permissions?: string | null } | undefined;
    if (!rawUser) return null;
    return {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      role: rawUser.role,
      phone: rawUser.phone ?? null,
      permissions: parsePermissions(rawUser.permissions, rawUser.role),
    };
  } catch {
    return null;
  }
});

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

export function hasPermission(user: SessionUser | null | undefined, key: keyof UserPermissions): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(user.permissions?.[key]);
}

export async function requirePermission(key: keyof UserPermissions): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, key)) {
    redirect("/panel?error=denegado");
  }
  return user;
}
