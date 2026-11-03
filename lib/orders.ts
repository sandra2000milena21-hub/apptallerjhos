import { customAlphabet } from "nanoid";
import { dbx, type Exec } from "./db";
import { headers } from "next/headers";

export type Order = {
  id: number;
  number: string;
  token: string;
  customer_id: number;
  status: string;
  device_type: string;
  device_id: number | null;
  priority: string;
  brand: string | null;
  model: string;
  color: string | null;
  capacity: string | null;
  imei: string | null;
  serial: string | null;
  passcode: string | null;
  services: string;
  problem: string | null;
  accessories: string | null;
  condition_notes: string | null;
  entered_off: number;
  battery_health: string | null;
  checklist_in: string;
  checklist_out: string;
  diagnostic_fee: number;
  estimate: number | null;
  warranty_months: number;
  due_date: string | null;
  terms_text: string | null;
  data_consent: number;
  intake_signature: string | null;
  delivery_signature: string | null;
  delivered_to: string | null;
  quote_status: string;
  quote_decided_at: string | null;
  quote_decided_by: string | null;
  received_by: number | null;
  technician_id: number | null;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
  delivered_at: string | null;
};

export type OrderWithCustomer = Order & {
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_doc: string | null;
  technician_name?: string | null;
  received_by_name?: string | null;
};

export type Media = {
  id: string;
  order_id: number | null;
  kind: string;
  category: string;
  filename: string;
  mime: string;
  size: number;
  public: number;
  caption: string | null;
  created_at: string;
};

export type EventRow = {
  id: number;
  order_id: number;
  type: string;
  status: string | null;
  body: string | null;
  public: number;
  author: string | null;
  user_name: string | null;
  created_at: string;
};

export const newToken = customAlphabet("abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", 24);
export const newMediaId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

const ORDER_SELECT = `
  SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.doc_id AS customer_doc,
         t.name AS technician_name, r.name AS received_by_name
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  LEFT JOIN users t ON t.id = o.technician_id
  LEFT JOIN users r ON r.id = o.received_by
`;

export async function getOrder(id: number, ex: Exec = dbx): Promise<OrderWithCustomer | undefined> {
  return (await ex.get(`${ORDER_SELECT} WHERE o.id = ?`, id)) as OrderWithCustomer | undefined;
}

export async function getOrderByToken(token: string): Promise<OrderWithCustomer | undefined> {
  return (await dbx.get(`${ORDER_SELECT} WHERE o.token = ?`, token)) as OrderWithCustomer | undefined;
}

export async function listOrders(opts: { q?: string; includeDelivered?: boolean } = {}): Promise<OrderWithCustomer[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.q) {
    const like = `%${opts.q.trim()}%`;
    where.push("(o.number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR o.imei LIKE ? OR o.serial LIKE ? OR o.model LIKE ? OR c.doc_id LIKE ?)");
    params.push(like, like, like, like, like, like, like);
  } else if (!opts.includeDelivered) {
    where.push("(o.status != 'entregado' OR o.delivered_at >= datetime('now', '-3 days'))");
  }
  const sql = `${ORDER_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY CASE o.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END, o.created_at DESC LIMIT 500`;
  return (await dbx.all(sql, ...params)) as OrderWithCustomer[];
}

export async function getMedia(orderId: number): Promise<Media[]> {
  return (await dbx.all("SELECT * FROM media WHERE order_id = ? ORDER BY created_at ASC", orderId)) as Media[];
}

export async function getEvents(orderId: number, onlyPublic = false): Promise<EventRow[]> {
  return (await dbx.all(
    `SELECT e.*, u.name AS user_name FROM events e LEFT JOIN users u ON u.id = e.user_id
     WHERE e.order_id = ? ${onlyPublic ? "AND e.public = 1" : ""} ORDER BY e.created_at DESC, e.id DESC`,
    orderId,
  )) as EventRow[];
}

export type QuoteItem = { id: number; description: string; amount: number; product_id: number | null; qty: number; unit_cost: number };

export async function getQuoteItems(orderId: number, ex: Exec = dbx): Promise<QuoteItem[]> {
  return (await ex.all("SELECT * FROM quote_items WHERE order_id = ? ORDER BY id", orderId)) as QuoteItem[];
}

export type PaymentRow = { id: number; amount: number; method: string; note: string | null; created_at: string; user_name: string | null };

export async function getPayments(orderId: number, ex: Exec = dbx): Promise<PaymentRow[]> {
  return (await ex.all(
    "SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.user_id WHERE order_id = ? ORDER BY p.created_at",
    orderId,
  )) as PaymentRow[];
}

export async function totals(orderId: number, order: Pick<Order, "diagnostic_fee" | "estimate" | "quote_status">, ex: Exec = dbx) {
  const items = await getQuoteItems(orderId, ex);
  const quoteTotal = items.reduce((s, i) => s + i.amount, 0);
  const paid = (await getPayments(orderId, ex)).reduce((s, p) => s + p.amount, 0);
  // Si la cotización fue rechazada, solo se cobra el diagnóstico.
  let total: number;
  if (order.quote_status === "rechazada") total = order.diagnostic_fee;
  else if (items.length) total = quoteTotal;
  else total = order.estimate ?? order.diagnostic_fee;
  return { items, quoteTotal, paid, total, balance: Math.max(total - paid, 0) };
}

export async function addEvent(
  e: {
    orderId: number;
    type: string;
    body?: string | null;
    status?: string | null;
    isPublic?: boolean;
    userId?: number | null;
    author?: string | null;
  },
  ex: Exec = dbx,
) {
  await ex.run(
    "INSERT INTO events (order_id, type, status, body, public, user_id, author) VALUES (?, ?, ?, ?, ?, ?, ?)",
    e.orderId, e.type, e.status ?? null, e.body ?? null, e.isPublic ? 1 : 0, e.userId ?? null, e.author ?? null,
  );
  await ex.run("UPDATE orders SET updated_at = datetime('now') WHERE id = ?", e.orderId);
}

/** Consecutivo atómico (R-0001, V-0001, C-0001). */
export async function nextNumber(prefixKey: string, counterKey: string, fallbackPrefix: string, ex: Exec = dbx): Promise<string> {
  await ex.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, '1')", counterKey);
  const row = (await ex.get(
    "UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = ? RETURNING CAST(value AS INTEGER) - 1 AS n",
    counterKey,
  )) as { n: number };
  const prefix = ((await ex.get("SELECT value FROM settings WHERE key = ?", prefixKey)) as { value: string } | undefined)?.value;
  return `${prefix || fallbackPrefix}${String(row.n).padStart(4, "0")}`;
}

export async function nextOrderNumber(ex: Exec = dbx): Promise<string> {
  return nextNumber("order_prefix", "next_number", "R-", ex);
}

export async function publicBaseUrl(): Promise<string> {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export function parseJSON<T>(s: string | null | undefined, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
