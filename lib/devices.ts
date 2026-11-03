import { dbx, type Exec } from "./db";

export type Device = {
  id: number;
  customer_id: number | null;
  device_type: string;
  brand: string | null;
  model: string;
  color: string | null;
  capacity: string | null;
  imei: string | null;
  serial: string | null;
  created_at: string;
};

function clean(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t ? t : null;
}

export async function findDevice(imei?: string | null, serial?: string | null, ex: Exec = dbx): Promise<Device | undefined> {
  const i = clean(imei);
  const s = clean(serial);
  if (!i && !s) return undefined;
  return (await ex.get("SELECT * FROM devices WHERE (? IS NOT NULL AND imei = ?) OR (? IS NOT NULL AND upper(serial) = upper(?)) ORDER BY id DESC LIMIT 1", i, i, s, s)) as Device | undefined;
}

/** Busca el equipo por IMEI o serial; si no existe lo crea. Actualiza dueño y datos. */
export async function upsertDevice(d: {
  customerId: number;
  deviceType: string;
  brand?: string | null;
  model: string;
  color?: string | null;
  capacity?: string | null;
  imei?: string | null;
  serial?: string | null;
}, ex: Exec = dbx): Promise<number> {
  const existing = await findDevice(d.imei, d.serial, ex);
  if (existing) {
    (await ex.run("UPDATE devices SET customer_id = ?, device_type = ?, brand = COALESCE(?, brand), model = ?, color = COALESCE(?, color), capacity = COALESCE(?, capacity), imei = COALESCE(?, imei), serial = COALESCE(?, serial) WHERE id = ?", d.customerId, d.deviceType, clean(d.brand), d.model, clean(d.color), clean(d.capacity), clean(d.imei), clean(d.serial), existing.id));
    return existing.id;
  }
  return Number(
    (await ex.run("INSERT INTO devices (customer_id, device_type, brand, model, color, capacity, imei, serial) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", d.customerId, d.deviceType, clean(d.brand), d.model, clean(d.color), clean(d.capacity), clean(d.imei), clean(d.serial))).lastInsertRowid,
  );
}

export type HistoryRow = { id: number; number: string; status: string; services: string; problem: string | null; created_at: string; delivered_at: string | null; customer_name: string };

export async function deviceHistory(deviceId: number): Promise<HistoryRow[]> {
  return (await dbx.all(`SELECT o.id, o.number, o.status, o.services, o.problem, o.created_at, o.delivered_at, c.name AS customer_name
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.device_id = ? ORDER BY o.created_at DESC`, deviceId)) as HistoryRow[];
}
