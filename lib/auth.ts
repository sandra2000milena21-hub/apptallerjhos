import { cache } from "react";
import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { dbx } from "./db";
import { parsePermissions, type UserPermissions } from "./permissions";
import { clearLimit, clientIp, hit, isLimited } from "./ratelimit";

export * from "./permissions";

const COOKIE = "taller_sesion";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

const DEV_SECRET = "solo-para-desarrollo-cambia-SESSION_SECRET-en-produccion";

function secret() {
  const s = process.env.SESSION_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    // En producción no se arranca con una clave ausente, corta o de ejemplo: cualquiera podría falsificar sesiones.
    if (s.length < 32 || /cambia-esto/i.test(s)) {
      throw new Error("SESSION_SECRET no está configurada o es insegura. Define una clave aleatoria de 32+ caracteres en el archivo .env.");
    }
    return new TextEncoder().encode(s);
  }
  return new TextEncoder().encode(s || DEV_SECRET);
}

/** Huella de la contraseña: va dentro de la sesión, así al cambiar la clave las sesiones viejas dejan de servir. */
function pwdMark(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

// Hash de relleno: si el usuario no existe se compara igual, para que el tiempo de respuesta no delate qué usuarios existen.
const DUMMY_HASH = bcrypt.hashSync("clave-de-relleno-sin-uso", 10);

const LOGIN_WINDOW = 15 * 60_000;
const LOGIN_MAX_PER_USER = 8;
const LOGIN_MAX_PER_IP = 30;

export type LoginResult = "ok" | "invalid" | "limited";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  permissions: UserPermissions;
};

export async function login(identifier: string, password: string): Promise<LoginResult> {
  const clean = identifier.trim().toLowerCase().slice(0, 200);
  const ip = await clientIp();
  const ipKey = `login:ip:${ip}`;
  const userKey = `login:user:${clean}`;
  if (isLimited(ipKey, LOGIN_MAX_PER_IP, LOGIN_WINDOW) || isLimited(userKey, LOGIN_MAX_PER_USER, LOGIN_WINDOW)) return "limited";
  if (!clean || !password || password.length > 200) return "invalid";
  const user = (await dbx.get(
    "SELECT * FROM users WHERE (lower(email) = ? OR lower(name) = ?) AND active = 1",
    clean,
    clean,
  )) as (SessionUser & { password_hash: string; permissions?: string | null }) | undefined;
  
  const okPassword = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !okPassword) {
    hit(ipKey, LOGIN_WINDOW);
    hit(userKey, LOGIN_WINDOW);
    return "invalid";
  }
  clearLimit(userKey);

  const token = await new SignJWT({ uid: user.id, pm: pwdMark(user.password_hash) })
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
  return "ok";
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
      "SELECT id, name, email, role, phone, permissions, password_hash FROM users WHERE id = ? AND active = 1",
      payload.uid as number,
    )) as { id: number; name: string; email: string; role: string; phone?: string | null; permissions?: string | null; password_hash: string } | undefined;
    if (!rawUser) return null;
    // Sesión emitida con otra contraseña (o antes de este control): ya no es válida.
    if (payload.pm !== pwdMark(rawUser.password_hash)) return null;
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

/** Igual que requirePermission, pero basta con tener uno de los permisos. */
export async function requireAnyPermission(...keys: (keyof UserPermissions)[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!keys.some((k) => hasPermission(user, k))) {
    redirect("/panel?error=denegado");
  }
  return user;
}

export const NO_PERMISSION = "No tienes permiso para hacer esto. Pídele al administrador que lo active en Ajustes → Usuarios.";
