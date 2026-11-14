import { headers } from "next/headers";

/**
 * Límite de intentos en memoria (por proceso). Suficiente para un solo servidor (VPS o computador del local).
 * Cada "cubeta" guarda las marcas de tiempo de los intentos recientes de una clave (IP, usuario, etc.).
 */
declare global {
  // eslint-disable-next-line no-var
  var __rateBuckets: Map<string, number[]> | undefined;
}

const buckets = (global.__rateBuckets ??= new Map<string, number[]>());
const MAX_KEYS = 5000;

function prune(now: number, windowMs: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, v] of buckets) {
    if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
  // Si aun así está lleno (ataque con muchas claves), se vacía: es preferible a quedarse sin memoria.
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

/** ¿La clave ya llegó al máximo de intentos en la ventana? No registra nada. */
export function isLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length) buckets.set(key, recent);
  else buckets.delete(key);
  return recent.length >= max;
}

/** Registra un intento para la clave. */
export function hit(key: string, windowMs: number) {
  const now = Date.now();
  prune(now, windowMs);
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
}

export function clearLimit(key: string) {
  buckets.delete(key);
}

/**
 * IP del visitante. Detrás de Caddy/Vercel el proxy escribe X-Forwarded-For con la IP real
 * (Caddy descarta el valor que mande el visitante), por eso se toma el primer elemento.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
