"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dbx, tx } from "@/lib/db";
import { nextNumber } from "@/lib/orders";
import { moveStock } from "@/lib/inventory";
import { saveSignature } from "@/lib/storage";
import { BUYBACK_CHECKS, GRADES, deviceType } from "@/lib/constants";
import { upsertDevice } from "@/lib/devices";

export type BuybackInput = {
  seller: { id?: number; name: string; doc_id: string; phone: string };
  device: { device_type: string; brand: string; model: string; color: string; capacity: string; imei: string; serial: string };
  checks: Record<string, boolean>;
  grade: string;
  notes: string;
  price: number;
  payout: string;
  salePrice: number;
  signature: string | null;
};

export async function createBuyback(input: BuybackInput): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!input.seller.name.trim() || !input.seller.phone.trim() || !input.seller.doc_id.trim())
    return { ok: false, error: "Nombre, cédula y celular del vendedor son obligatorios." };
  if (!input.device.model.trim()) return { ok: false, error: "Falta el modelo." };
  if (input.device.device_type === "celular" && !input.device.imei.trim()) return { ok: false, error: "Para celulares el IMEI es obligatorio." };
  if (!input.checks.imei) return { ok: false, error: "Confirma que consultaste que el IMEI no está reportado." };
  if (!GRADES.some((g) => g.key === input.grade)) return { ok: false, error: "Elige el grado del equipo." };
  if (input.price <= 0) return { ok: false, error: "Escribe el valor que se paga." };
  if (!input.signature) return { ok: false, error: "Falta la firma del vendedor." };
  if (!["Efectivo", "Transferencia", "Saldo a favor"].includes(input.payout)) return { ok: false, error: "Forma de pago inválida." };

  const d = input.device;
  const dt = deviceType(d.device_type);
  try {
    const id = await tx(async (t) => {
      let customerId = input.seller.id;
      if (customerId) {
        (await t.run("UPDATE customers SET name = ?, doc_id = ?, phone = ? WHERE id = ?", input.seller.name, input.seller.doc_id, input.seller.phone, customerId));
      } else {
        customerId = Number(
          (await t.run("INSERT INTO customers (name, doc_id, phone) VALUES (?, ?, ?)", input.seller.name, input.seller.doc_id, input.seller.phone)).lastInsertRowid,
        );
      }
      const number = await nextNumber("buyback_prefix", "next_buyback", "C-", t);
      const name = `${d.brand && !d.model.toLowerCase().startsWith(d.brand.toLowerCase()) ? d.brand + " " : ""}${d.model} ${d.capacity} ${d.color} (usado ${input.grade})`.replace(/\s+/g, " ").trim();
      const productId = Number(
        (await t.run("INSERT INTO products (name, kind, device_type, cost, price, stock, min_stock, imei, grade, barcode) VALUES (?, 'equipo', ?, ?, ?, 0, 0, ?, ?, ?)", name, dt.key, input.price, input.salePrice || 0, d.imei || d.serial || null, input.grade, null)).lastInsertRowid,
      );
      (await t.run("UPDATE products SET barcode = ? WHERE id = ?", `P${String(productId).padStart(6, "0")}`, productId));
      await moveStock({ productId, qty: 1, reason: "retoma", ref: number, unitCost: input.price, userId: user.id }, t);
      await upsertDevice({ customerId: customerId!, deviceType: dt.key, brand: d.brand, model: d.model, color: d.color, capacity: d.capacity, imei: d.imei, serial: d.serial }, t);

      const checks = Object.fromEntries(BUYBACK_CHECKS.map((c) => [c.key, Boolean(input.checks[c.key])]));
      const buybackId = Number(
        (await t.run(`INSERT INTO buybacks (number, customer_id, device_type, brand, model, color, capacity, imei, serial, checks, grade, notes, price, payout, sale_price, product_id, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, number, customerId, dt.key, d.brand || null, d.model, d.color || null, d.capacity || null, d.imei || null, d.serial || null, JSON.stringify(checks), input.grade, input.notes || null, input.price, input.payout, input.salePrice || null, productId, user.id))
          .lastInsertRowid,
      );
      const sig = await saveSignature(input.signature!, null, user.id, t);
      (await t.run("UPDATE buybacks SET signature = ? WHERE id = ?", sig, buybackId));
      if (input.payout === "Saldo a favor") (await t.run("UPDATE customers SET store_credit = store_credit + ? WHERE id = ?", input.price, customerId));
      return buybackId;
    });
    revalidatePath("/panel/retomas");
    revalidatePath("/panel/inventario");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function voidBuyback(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Solo el administrador puede anular retomas.");
  const id = parseInt(String(fd.get("id")), 10);
  const b = (await dbx.get("SELECT * FROM buybacks WHERE id = ?", id)) as { id: number; number: string; status: string; product_id: number; payout: string; price: number; customer_id: number } | undefined;
  if (!b || b.status === "anulada") return;
  await tx(async (t) => {
    await moveStock({ productId: b.product_id, qty: -1, reason: "ajuste", note: `Anulación ${b.number}`, userId: user.id }, t);
    (await t.run("UPDATE products SET active = 0 WHERE id = ?", b.product_id));
    if (b.payout === "Saldo a favor") (await t.run("UPDATE customers SET store_credit = MAX(store_credit - ?, 0) WHERE id = ?", b.price, b.customer_id));
    (await t.run("UPDATE buybacks SET status = 'anulada' WHERE id = ?", id));
  });
  revalidatePath(`/panel/retomas/${id}`);
}
