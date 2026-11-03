import { dbx, type Exec } from "./db";

export type Product = {
  id: number;
  sku: string | null;
  barcode: string | null;
  name: string;
  kind: string;
  device_type: string | null;
  compatible: string | null;
  cost: number;
  price: number;
  stock: number;
  min_stock: number;
  supplier: string | null;
  imei: string | null;
  grade: string | null;
  track_stock: number;
  active: number;
  created_at: string;
};

export async function getProduct(id: number, ex: Exec = dbx): Promise<Product | undefined> {
  return (await ex.get("SELECT * FROM products WHERE id = ?", id)) as Product | undefined;
}

export async function findProductByCode(code: string): Promise<Product | undefined> {
  const c = code.trim();
  if (!c) return undefined;
  return (await dbx.get("SELECT * FROM products WHERE active = 1 AND (barcode = ? OR sku = ? OR imei = ?) LIMIT 1", c, c, c)) as Product | undefined;
}

export async function searchProducts(q: string, opts: { kind?: string; lowOnly?: boolean; limit?: number } = {}): Promise<Product[]> {
  const where = ["active = 1"];
  const params: unknown[] = [];
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    where.push("(name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR compatible LIKE ? OR imei LIKE ?)");
    params.push(like, like, like, like, like);
  }
  if (opts.kind) {
    where.push("kind = ?");
    params.push(opts.kind);
  }
  if (opts.lowOnly) where.push("track_stock = 1 AND stock <= min_stock");
  return (await dbx.all(`SELECT * FROM products WHERE ${where.join(" AND ")} ORDER BY name LIMIT ?`, ...params, opts.limit ?? 300)) as Product[];
}

/**
 * Registra un movimiento de inventario y actualiza el stock.
 * qty positivo = entra, negativo = sale. Si es una compra con costo, recalcula el costo promedio.
 */
export async function moveStock(m: {
  productId: number;
  qty: number;
  reason: "compra" | "venta" | "reparacion" | "devolucion" | "ajuste" | "retoma" | "inicial";
  ref?: string | null;
  unitCost?: number | null;
  note?: string | null;
  userId?: number | null;
}, ex: Exec = dbx) {
  const p = await getProduct(m.productId, ex);
  if (!p || !p.track_stock) return;
  if (m.qty > 0 && m.unitCost && m.unitCost > 0 && (m.reason === "compra" || m.reason === "retoma")) {
    const current = Math.max(p.stock, 0);
    const avg = Math.round((current * p.cost + m.qty * m.unitCost) / (current + m.qty));
    await ex.run("UPDATE products SET cost = ? WHERE id = ?", avg, p.id);
  }
  await ex.run("UPDATE products SET stock = stock + ? WHERE id = ?", m.qty, p.id);
  (await ex.run("INSERT INTO stock_moves (product_id, qty, reason, ref, unit_cost, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)", p.id, m.qty, m.reason, m.ref ?? null, m.unitCost ?? p.cost, m.note ?? null, m.userId ?? null));
}

export async function lowStockCount(): Promise<number> {
  return ((await dbx.get("SELECT COUNT(*) AS n FROM products WHERE active = 1 AND track_stock = 1 AND stock <= min_stock AND kind != 'servicio'")) as { n: number }).n;
}

export type CatalogItem = {
  id: number;
  device_type: string;
  name: string;
  model: string | null;
  service: string | null;
  price: number;
  product_id: number | null;
  minutes: number | null;
  active: number;
  product_name?: string | null;
  product_stock?: number | null;
  product_cost?: number | null;
};

export async function listCatalog(deviceType?: string): Promise<CatalogItem[]> {
  return (await dbx.all(`SELECT c.*, p.name AS product_name, p.stock AS product_stock, p.cost AS product_cost
       FROM repair_catalog c LEFT JOIN products p ON p.id = c.product_id
       WHERE c.active = 1 ${deviceType ? "AND c.device_type = ?" : ""} ORDER BY c.device_type, c.name`, ...(deviceType ? [deviceType] : []))) as CatalogItem[];
}
