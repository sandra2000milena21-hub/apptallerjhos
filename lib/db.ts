import bcrypt from "bcryptjs";
import path from "node:path";
import type { Client, InStatement, Transaction } from "@libsql/client";
import { DEFAULT_TERMS } from "./constants";

/**
 * Base de datos: SQLite vía libSQL.
 * - En Vercel/producción: Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN).
 * - En tu computador: un archivo local (DATA_DIR/taller.db), sin configurar nada.
 */
function resolveDataDir(): string {
  const envDir = process.env.DATA_DIR;
  if (envDir && path.isAbsolute(envDir)) return envDir;
  const base = process.cwd().replace(/[\\/]\.next[\\/]standalone[\\/]?$/, "");
  return path.resolve(base, envDir || "data");
}

export const DATA_DIR = resolveDataDir();
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const SCHEMA_VERSION = "5";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'asesor',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  doc_id TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  store_credit INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  device_type TEXT NOT NULL DEFAULT 'celular',
  brand TEXT,
  model TEXT NOT NULL,
  color TEXT,
  capacity TEXT,
  imei TEXT,
  serial TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'recibido',
  device_type TEXT NOT NULL DEFAULT 'celular',
  device_id INTEGER REFERENCES devices(id),
  priority TEXT NOT NULL DEFAULT 'normal',
  brand TEXT,
  model TEXT NOT NULL,
  color TEXT,
  capacity TEXT,
  imei TEXT,
  serial TEXT,
  passcode TEXT,
  services TEXT NOT NULL DEFAULT '[]',
  problem TEXT,
  accessories TEXT,
  condition_notes TEXT,
  entered_off INTEGER NOT NULL DEFAULT 0,
  battery_health TEXT,
  checklist_in TEXT NOT NULL DEFAULT '{}',
  checklist_out TEXT NOT NULL DEFAULT '{}',
  diagnostic_fee INTEGER NOT NULL DEFAULT 0,
  estimate INTEGER,
  warranty_months INTEGER NOT NULL DEFAULT 3,
  due_date TEXT,
  terms_text TEXT,
  data_consent INTEGER NOT NULL DEFAULT 0,
  intake_signature TEXT,
  delivery_signature TEXT,
  delivered_to TEXT,
  quote_status TEXT NOT NULL DEFAULT 'ninguna',
  quote_decided_at TEXT,
  quote_decided_by TEXT,
  received_by INTEGER REFERENCES users(id),
  technician_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  ready_at TEXT,
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  product_id INTEGER REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quote_items_order ON quote_items(order_id);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  method TEXT,
  note TEXT,
  sale_id INTEGER,
  external_ref TEXT,
  user_id REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT,
  body TEXT,
  public INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  author TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_order ON events(order_id);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ingreso',
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  public INTEGER NOT NULL DEFAULT 1,
  caption TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_order ON media(order_id);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'repuesto',
  device_type TEXT,
  compatible TEXT,
  cost INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  supplier TEXT,
  imei TEXT,
  grade TEXT,
  track_stock INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  unit_cost INTEGER,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_moves_product ON stock_moves(product_id);
CREATE TABLE IF NOT EXISTS repair_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_type TEXT NOT NULL DEFAULT 'celular',
  name TEXT NOT NULL,
  model TEXT,
  service TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  product_id INTEGER REFERENCES products(id),
  minutes INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pagada',
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  order_id INTEGER REFERENCES orders(id),
  description TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
CREATE TABLE IF NOT EXISTS buybacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  device_type TEXT NOT NULL DEFAULT 'celular',
  brand TEXT,
  model TEXT NOT NULL,
  color TEXT,
  capacity TEXT,
  imei TEXT,
  serial TEXT,
  checks TEXT NOT NULL DEFAULT '{}',
  grade TEXT NOT NULL,
  notes TEXT,
  price INTEGER NOT NULL,
  payout TEXT NOT NULL DEFAULT 'Efectivo',
  sale_price INTEGER,
  product_id INTEGER REFERENCES products(id),
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pagada',
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_buybacks_created ON buybacks(created_at);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  device_type TEXT NOT NULL DEFAULT 'celular',
  model TEXT,
  problem TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  source TEXT NOT NULL DEFAULT 'web',
  order_id INTEGER REFERENCES orders(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  category TEXT,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'Efectivo',
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierto',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Columnas agregadas después de la primera versión: se crean si la base de datos ya existía.
const MIGRATIONS: [string, string, string][] = [
  ["orders", "device_type", "TEXT NOT NULL DEFAULT 'celular'"],
  ["orders", "device_id", "INTEGER"],
  ["orders", "priority", "TEXT NOT NULL DEFAULT 'normal'"],
  ["customers", "store_credit", "INTEGER NOT NULL DEFAULT 0"],
  ["customers", "points", "INTEGER NOT NULL DEFAULT 0"],
  ["customers", "notes", "TEXT"],
  ["quote_items", "product_id", "INTEGER"],
  ["quote_items", "qty", "INTEGER NOT NULL DEFAULT 1"],
  ["quote_items", "unit_cost", "INTEGER NOT NULL DEFAULT 0"],
  ["payments", "sale_id", "INTEGER"],
  ["payments", "external_ref", "TEXT"],
  ["sales", "points_earned", "INTEGER NOT NULL DEFAULT 0"],
  ["sales", "points_redeemed", "INTEGER NOT NULL DEFAULT 0"],
];

const DEFAULT_SETTINGS: Record<string, string> = {
  shop_name: "Mi Taller",
  shop_address: "Pereira, Risaralda",
  shop_phone: "",
  shop_whatsapp: "",
  shop_hours: "Lunes a sábado, 9:00 a. m. a 7:00 p. m.",
  order_prefix: "R-",
  next_number: "1",
  default_warranty_months: "3",
  default_diagnostic_fee: "0",
  storage_fee_per_day: "0",
  loyalty_enabled: "1",
  loyalty_pts_per_1000: "1",
  loyalty_val_per_pt: "20",
  terms: DEFAULT_TERMS,
  sale_prefix: "V-",
  next_sale: "1",
  buyback_prefix: "C-",
  next_buyback: "1",
  booking_enabled: "1",
  booking_days: "1,2,3,4,5,6",
  booking_hours: "09:00,10:00,11:00,12:00,14:00,15:00,16:00,17:00,18:00",
  google_review_url: "",
  notify_statuses: "recibido,cotizado,esperando_repuesto,listo,entregado",
  wa_enabled: "0",
  wa_phone_number_id: "",
  wa_token: "",
  wa_template: "",
  wa_lang: "es",
  sms_enabled: "0",
  twilio_sid: "",
  twilio_token: "",
  twilio_from: "",
  email_enabled: "0",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_pass: "",
  smtp_from: "",
  wompi_private_key: "",
  wompi_events_secret: "",
  ai_key: "",
  ai_model: "claude-haiku-5-5",
};

type Args = unknown[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/** Lo que se puede usar para consultar: la conexión normal o una transacción abierta. */
export type Exec = {
  all(sql: string, ...args: Args): Promise<AnyRow[]>;
  get(sql: string, ...args: Args): Promise<AnyRow | undefined>;
  run(sql: string, ...args: Args): Promise<{ lastInsertRowid: number; changes: number }>;
};

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: Promise<Client> | undefined;
}

function clean(args: Args) {
  return args.map((a) => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a)) as InStatement extends { args?: infer A } ? A : never;
}

function wrap(target: Pick<Client, "execute"> | Transaction): Exec {
  const exec = async (sql: string, args: Args) => target.execute({ sql, args: clean(args) as never });
  const toObjects = (rs: Awaited<ReturnType<typeof exec>>) =>
    rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
  return {
    all: async (sql, ...args) => toObjects(await exec(sql, args)),
    get: async (sql, ...args) => toObjects(await exec(sql, args))[0],
    run: async (sql, ...args) => {
      const rs = await exec(sql, args);
      return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0), changes: rs.rowsAffected };
    },
  };
}

async function connect(): Promise<Client> {
  const remote = process.env.TURSO_DATABASE_URL;
  let client: Client;
  if (remote) {
    const { createClient } = await import("@libsql/client/web");
    client = createClient({ url: remote, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    if (process.env.VERCEL) throw new Error("Falta configurar TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en Vercel.");
    const fs = await import("node:fs");
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const { createClient } = await import("@libsql/client");
    client = createClient({ url: "file:" + path.join(DATA_DIR, "taller.db") });
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  await client.execute("PRAGMA foreign_keys = ON");
  await migrate(client);
  return client;
}

async function migrate(client: Client) {
  const current = await client
    .execute("SELECT value FROM settings WHERE key = 'schema_version'")
    .then((r) => (r.rows[0]?.[0] as string | undefined) ?? null)
    .catch(() => null);
  if (current === SCHEMA_VERSION) return;

  const tables = new Set((await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map((r) => String(r[0])));
  if (tables.has("orders")) {
    for (const [table, col, def] of MIGRATIONS) {
      if (!tables.has(table)) continue;
      const cols = (await client.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r[1]));
      if (!cols.includes(col)) await client.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    }
  }
  const statements = SCHEMA.split(";").map((x) => x.trim()).filter(Boolean);
  await client.batch(statements, "write");
  await client.batch(
    Object.entries(DEFAULT_SETTINGS).map(([k, v]) => ({ sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", args: [k, v] })),
    "write",
  );
  const users = Number((await client.execute("SELECT COUNT(*) FROM users")).rows[0][0]);
  if (users === 0) {
    const email = (process.env.ADMIN_EMAIL || "admin@mitaller.co").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "admin1234";
    const name = process.env.ADMIN_NAME || "Administrador";
    await client.execute({
      sql: "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      args: [name, email, bcrypt.hashSync(password, 10)],
    });
  }
  await client.execute({
    sql: "INSERT INTO settings (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [SCHEMA_VERSION],
  });
}

async function client(): Promise<Client> {
  if (!global.__dbClient) {
    global.__dbClient = connect().catch((e) => {
      global.__dbClient = undefined;
      throw e;
    });
  }
  return global.__dbClient;
}

/** Conexión normal (cada sentencia se confirma sola). */
export const dbx: Exec = {
  all: async (sql, ...args) => wrap(await client()).all(sql, ...args),
  get: async (sql, ...args) => wrap(await client()).get(sql, ...args),
  run: async (sql, ...args) => wrap(await client()).run(sql, ...args),
};

/** Ejecuta varias escrituras como una sola: si algo falla, no queda nada a medias. */
export async function tx<T>(fn: (t: Exec) => Promise<T>): Promise<T> {
  const t = await (await client()).transaction("write");
  try {
    const out = await fn(wrap(t));
    await t.commit();
    return out;
  } catch (e) {
    await t.rollback().catch(() => {});
    throw e;
  } finally {
    t.close();
  }
}

export async function getSettings(ex: Exec = dbx): Promise<Record<string, string>> {
  const rows = (await ex.all("SELECT key, value FROM settings")) as { key: string; value: string }[];
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string, ex: Exec = dbx) {
  await ex.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}
