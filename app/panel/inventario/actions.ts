"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbx, tx } from "@/lib/db";
import { findProductByCode, getProduct, moveStock, searchProducts } from "@/lib/inventory";
import { parseMoney } from "@/lib/format";
import { PRODUCT_KINDS } from "@/lib/constants";

export async function searchProductsAction(q: string) {
  await requireUser();
  const exact = await findProductByCode(q);
  const list = await searchProducts(q, { limit: 12 });
  const all = exact ? [exact, ...list.filter((p) => p.id !== exact.id)] : list;
  return all.map((p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, track_stock: p.track_stock, cost: p.cost, kind: p.kind, barcode: p.barcode }));
}

function str(fd: FormData, k: string) {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
}

export async function saveProduct(fd: FormData) {
  const user = await requireUser();
  const id = parseInt(String(fd.get("id") || "0"), 10);
  const kind = PRODUCT_KINDS.some((k) => k.key === fd.get("kind")) ? String(fd.get("kind")) : "repuesto";
  const name = str(fd, "name");
  if (!name) redirect("/panel/inventario?error=nombre");
  const data = [
    str(fd, "sku"),
    str(fd, "barcode"),
    name,
    kind,
    str(fd, "device_type"),
    str(fd, "compatible"),
    parseMoney(fd.get("cost")),
    parseMoney(fd.get("price")),
    parseInt(String(fd.get("min_stock") || "0"), 10) || 0,
    str(fd, "supplier"),
    str(fd, "imei"),
    str(fd, "grade"),
    kind === "servicio" ? 0 : 1,
  ];
  if (id) {
    (await dbx.run("UPDATE products SET sku=?, barcode=?, name=?, kind=?, device_type=?, compatible=?, cost=?, price=?, min_stock=?, supplier=?, imei=?, grade=?, track_stock=? WHERE id = ?", ...data, id));
    revalidatePath(`/panel/inventario/${id}`);
    redirect(`/panel/inventario/${id}?ok=1`);
  }
  const newId = Number(
    (await dbx.run("INSERT INTO products (sku, barcode, name, kind, device_type, compatible, cost, price, min_stock, supplier, imei, grade, track_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ...data)).lastInsertRowid,
  );
  // Si no trae código de barras, se genera uno interno para poder etiquetar y escanear.
  if (!data[1]) (await dbx.run("UPDATE products SET barcode = ? WHERE id = ?", `P${String(newId).padStart(6, "0")}`, newId));
  const initial = parseInt(String(fd.get("stock") || "0"), 10) || 0;
  if (initial > 0 && kind !== "servicio") await moveStock({ productId: newId, qty: initial, reason: "inicial", unitCost: data[6] as number, userId: user.id });
  revalidatePath("/panel/inventario");
  redirect(`/panel/inventario?nuevo=${newId}`);
}

export async function adjustStock(fd: FormData) {
  const user = await requireUser();
  const id = parseInt(String(fd.get("id")), 10);
  const p = await getProduct(id);
  if (!p) return;
  const counted = parseInt(String(fd.get("counted") ?? ""), 10);
  if (Number.isNaN(counted)) return;
  const diff = counted - p.stock;
  if (diff !== 0) await moveStock({ productId: id, qty: diff, reason: "ajuste", note: str(fd, "note") ?? "Conteo físico", userId: user.id });
  revalidatePath(`/panel/inventario/${id}`);
}

export async function archiveProduct(fd: FormData) {
  const user = await requireUser();
  if (user.role === "tecnico") throw new Error("No tienes permisos para archivar productos.");
  const id = parseInt(String(fd.get("id")), 10);
  (await dbx.run("UPDATE products SET active = 0 WHERE id = ?", id));
  revalidatePath("/panel/inventario");
  redirect("/panel/inventario");
}

export async function receivePurchase(input: { supplier: string; note: string; lines: { productId: number; qty: number; cost: number }[] }) {
  const user = await requireUser();
  const lines = input.lines.filter((l) => l.productId && l.qty > 0);
  if (!lines.length) return { ok: false, error: "Agrega al menos un producto con cantidad." };
  const ref = `Compra ${input.supplier || ""}`.trim();
  await tx(async (t) => {
    for (const l of lines) {
      await moveStock({ productId: l.productId, qty: l.qty, reason: "compra", unitCost: l.cost, ref, note: input.note || null, userId: user.id }, t);
      if (input.supplier) (await t.run("UPDATE products SET supplier = COALESCE(supplier, ?) WHERE id = ?", input.supplier, l.productId));
    }
  });
  revalidatePath("/panel/inventario");
  return { ok: true };
}

export async function saveCatalogItem(fd: FormData) {
  await requireUser();
  const id = parseInt(String(fd.get("id") || "0"), 10);
  const name = str(fd, "name");
  if (!name) return;
  const productId = parseInt(String(fd.get("product_id") || "0"), 10) || null;
  const vals = [String(fd.get("device_type") || "celular"), name, str(fd, "model"), str(fd, "service"), parseMoney(fd.get("price")), productId];
  if (id) (await dbx.run("UPDATE repair_catalog SET device_type=?, name=?, model=?, service=?, price=?, product_id=? WHERE id=?", ...vals, id));
  else (await dbx.run("INSERT INTO repair_catalog (device_type, name, model, service, price, product_id) VALUES (?, ?, ?, ?, ?, ?)", ...vals));
  revalidatePath("/panel/inventario/catalogo");
}

export async function deleteCatalogItem(fd: FormData) {
  const user = await requireUser();
  if (user.role === "tecnico") throw new Error("No tienes permisos para eliminar ítems del catálogo.");
  (await dbx.run("UPDATE repair_catalog SET active = 0 WHERE id = ?", parseInt(String(fd.get("id")), 10)));
  revalidatePath("/panel/inventario/catalogo");
}
