import crypto from "node:crypto";
import { getSettings } from "./db";

function apiBase(privateKey: string) {
  return privateKey.startsWith("prv_test") ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
}

/** Crea un link de pago de un solo uso en Wompi. Devuelve id y URL del checkout. */
export async function createPaymentLink(p: { name: string; description: string; amount: number; redirectUrl?: string }) {
  const s = await getSettings();
  if (!s.wompi_private_key) throw new Error("Wompi no está configurado (falta la llave privada).");
  const res = await fetch(`${apiBase(s.wompi_private_key)}/payment_links`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.wompi_private_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: p.name.slice(0, 60),
      description: p.description.slice(0, 120),
      single_use: true,
      collect_shipping: false,
      currency: "COP",
      amount_in_cents: Math.round(p.amount) * 100,
      ...(p.redirectUrl ? { redirect_url: p.redirectUrl } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.id) throw new Error(`Wompi respondió ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return { id: String(data.data.id), url: `https://checkout.wompi.co/l/${data.data.id}` };
}

function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

/**
 * Verifica la firma de un evento de Wompi: se concatenan los valores de signature.properties (tomados de data),
 * luego el timestamp y el secreto de eventos, y se calcula SHA-256.
 */
export function verifyWompiEvent(event: Record<string, unknown>, secret: string): boolean {
  const sig = event.signature as { properties?: string[]; checksum?: string } | undefined;
  if (!sig?.properties || !sig.checksum || !secret) return false;
  const values = sig.properties.map((prop) => String(pick(event.data, prop) ?? "")).join("");
  const hash = crypto.createHash("sha256").update(values + String(event.timestamp) + secret).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(String(sig.checksum).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
