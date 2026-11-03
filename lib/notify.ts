import nodemailer from "nodemailer";
import { dbx, getSettings } from "./db";
import { getOrder, totals, publicBaseUrl, type OrderWithCustomer } from "./orders";
import { statusInfo } from "./constants";
import { money } from "./format";

export function toE164(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) d = "57" + d;
  return d;
}

async function log(orderId: number | null, channel: string, recipient: string, status: "enviado" | "error" | "omitido", detail?: string) {
  (await dbx.run("INSERT INTO notifications (order_id, channel, recipient, status, detail) VALUES (?, ?, ?, ?, ?)", orderId, channel, recipient, status, detail?.slice(0, 500) ?? null));
}

export async function statusMessage(o: OrderWithCustomer, status: string, trackUrl: string, s: Record<string, string>): Promise<string> {
  const first = o.customer_name.split(" ")[0];
  const t = await totals(o.id, o);
  const base = `Hola ${first}, ${s.shop_name} te informa: ${statusInfo(status).client} (${o.model}, orden ${o.number}).`;
  let extra = "";
  if (status === "cotizado") extra = ` La reparación cuesta ${money(t.quoteTotal)}. Puedes aprobarla aquí:`;
  else if (status === "listo") extra = ` Recógelo con tu orden y tu cédula. Horario: ${s.shop_hours}.${t.balance > 0 ? ` Saldo: ${money(t.balance)}.` : ""}`;
  else if (status === "entregado")
    extra = ` Garantía de ${o.warranty_months} meses. ¡Gracias por confiar en nosotros!${s.google_review_url ? ` Nos ayudas mucho calificándonos: ${s.google_review_url}` : ""}`;
  return `${base}${extra} ${status === "entregado" ? "" : trackUrl}`.trim();
}

async function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Tiempo de espera agotado")), ms))]);
}

export async function sendWhatsApp(to: string, params: string[], settings?: Record<string, string>): Promise<void> {
  const s = settings ?? (await getSettings());
  if (!s.wa_phone_number_id || !s.wa_token || !s.wa_template) throw new Error("WhatsApp no está configurado");
  const res = await withTimeout(
    fetch(`https://graph.facebook.com/v21.0/${s.wa_phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.wa_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164(to),
        type: "template",
        template: {
          name: s.wa_template,
          language: { code: s.wa_lang || "es" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
    }),
  );
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
}

export async function sendSms(to: string, body: string, settings?: Record<string, string>): Promise<void> {
  const s = settings ?? (await getSettings());
  if (!s.twilio_sid || !s.twilio_token || !s.twilio_from) throw new Error("Twilio no está configurado");
  const res = await withTimeout(
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.twilio_sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${s.twilio_sid}:${s.twilio_token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: "+" + toE164(to), From: s.twilio_from, Body: body }),
    }),
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

export async function sendEmail(to: string, subject: string, text: string, settings?: Record<string, string>): Promise<void> {
  const s = settings ?? (await getSettings());
  if (!s.smtp_host || !s.smtp_from) throw new Error("El correo no está configurado");
  const transport = nodemailer.createTransport({
    host: s.smtp_host,
    port: parseInt(s.smtp_port || "587", 10),
    secure: s.smtp_port === "465",
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
  });
  await withTimeout(transport.sendMail({ from: s.smtp_from, to, subject, text }));
}

/** Envía el aviso de cambio de estado por los canales activos. Nunca lanza error: registra el resultado. */
export async function notifyOrderStatus(orderId: number, status: string): Promise<string[]> {
  const s = await getSettings();
  const enabled = (s.notify_statuses || "").split(",").map((x) => x.trim());
  if (!enabled.includes(status)) return [];
  const o = await getOrder(orderId);
  if (!o) return [];
  const trackUrl = `${await publicBaseUrl()}/s/${o.token}`;
  const text = await statusMessage(o, status, trackUrl, s);
  const results: string[] = [];

  if (s.wa_enabled === "1") {
    try {
      await sendWhatsApp(o.customer_phone, [o.customer_name.split(" ")[0], o.model, o.number, statusInfo(status).client, trackUrl], s);
      await log(orderId, "whatsapp", o.customer_phone, "enviado");
      results.push("WhatsApp");
    } catch (e) {
      await log(orderId, "whatsapp", o.customer_phone, "error", (e as Error).message);
    }
  }
  if (s.sms_enabled === "1") {
    try {
      await sendSms(o.customer_phone, text, s);
      await log(orderId, "sms", o.customer_phone, "enviado");
      results.push("SMS");
    } catch (e) {
      await log(orderId, "sms", o.customer_phone, "error", (e as Error).message);
    }
  }
  if (s.email_enabled === "1" && o.customer_email) {
    try {
      await sendEmail(o.customer_email, `${s.shop_name} · Orden ${o.number}: ${statusInfo(status).label}`, text, s);
      await log(orderId, "correo", o.customer_email, "enviado");
      results.push("correo");
    } catch (e) {
      await log(orderId, "correo", o.customer_email, "error", (e as Error).message);
    }
  }
  return results;
}

export async function getNotifications(orderId: number) {
  return (await dbx.all("SELECT * FROM notifications WHERE order_id = ? ORDER BY id DESC LIMIT 30", orderId)) as {
    id: number;
    channel: string;
    recipient: string;
    status: string;
    detail: string | null;
    created_at: string;
  }[];
}
