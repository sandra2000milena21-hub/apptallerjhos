"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dbx, tx, type Exec } from "@/lib/db";
import { addEvent, getOrder, nextNumber, totals } from "@/lib/orders";
import { getProduct, moveStock } from "@/lib/inventory";
import { PAYMENT_METHODS } from "@/lib/constants";

export async function findOrderForCheckout(code: string) {
  await requireUser();
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const numDigits = c.replace(/\D/g, "");
  const padded = numDigits ? numDigits.padStart(4, "0") : "";
  const row = (await dbx.get(
    "SELECT id FROM orders WHERE upper(number) = ? OR (? != '' AND (number LIKE ? OR number LIKE ?)) ORDER BY id DESC LIMIT 1",
    c,
    padded,
    `%-${padded}`,
    `%${padded}`,
  )) as { id: number } | undefined;
  if (!row) return null;
  return orderLine(row.id);
}

async function orderLine(id: number) {
  const o = await getOrder(id);
  if (!o) return null;
  const t = await totals(id, o);
  return {
    orderId: o.id,
    number: o.number,
    description: `Orden ${o.number} · ${o.model}`,
    balance: t.balance,
    customer: { id: o.customer_id, name: o.customer_name, phone: o.customer_phone, credit: await customerCredit(o.customer_id) },
  };
}

export async function orderLineAction(id: number) {
  await requireUser();
  return orderLine(id);
}

async function customerCredit(id: number, ex: Exec = dbx) {
  return ((await ex.get("SELECT store_credit FROM customers WHERE id = ?", id)) as { store_credit: number } | undefined)?.store_credit ?? 0;
}

export async function findCustomerByPhone(phone: string) {
  await requireUser();
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return null;
  return (
    ((await dbx.get("SELECT id, name, phone, store_credit AS credit FROM customers WHERE replace(replace(phone,' ',''),'-','') LIKE ? ORDER BY id DESC LIMIT 1", `%${d.slice(-10)}`)) as { id: number; name: string; phone: string; credit: number } | undefined) ?? null
  );
}

export type SaleLine =
  | { type: "product"; productId: number; description: string; qty: number; unitPrice: number }
  | { type: "order"; orderId: number; description: string; qty: number; unitPrice: number }
  | { type: "custom"; description: string; qty: number; unitPrice: number };

export async function createSale(input: {
  customerId: number | null;
  newCustomer?: { name: string; phone: string } | null;
  lines: SaleLine[];
  discount: number;
  payments: { method: string; amount: number }[];
  note?: string;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const lines = input.lines.filter((l) => l.qty > 0 && l.unitPrice >= 0);
  if (!lines.length) return { ok: false, error: "La venta no tiene productos." };
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const discount = Math.min(Math.max(0, Math.round(input.discount || 0)), subtotal);
  const total = subtotal - discount;
  const payments = input.payments.filter((p) => p.amount > 0 && PAYMENT_METHODS.includes(p.method));
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid < total) return { ok: false, error: `Faltan $${(total - paid).toLocaleString("es-CO")} por pagar.` };
  const nonCash = payments.filter((p) => p.method !== "Efectivo").reduce((s, p) => s + p.amount, 0);
  if (nonCash > total) {
    return { ok: false, error: "Los pagos electrónicos o con tarjeta no pueden ser mayores al total de la venta." };
  }
  const orderLines = lines.filter((l) => l.type === "order");
  if (orderLines.length && discount > 0) return { ok: false, error: "No se puede aplicar descuento al cobro de una orden; ajusta la cotización." };

  for (const l of lines) {
    if (l.type === "product") {
      const p = await getProduct(l.productId);
      if (!p) return { ok: false, error: `Producto no encontrado: ${l.description}` };
      if (p.track_stock && p.stock < l.qty) return { ok: false, error: `No hay stock suficiente de ${p.name} (quedan ${p.stock}).` };
    }
  }

  try {
    const id = await tx(async (t) => {
      let customerId = input.customerId;
      if (!customerId && input.newCustomer?.phone) {
        const d = input.newCustomer.phone.replace(/\D/g, "");
        if (d.length >= 7) {
          const existing = (await t.get(
            "SELECT id FROM customers WHERE replace(replace(phone,' ',''),'-','') LIKE ? LIMIT 1",
            `%${d.slice(-10)}`,
          )) as { id: number } | undefined;
          if (existing) customerId = existing.id;
        }
      }
      if (!customerId && input.newCustomer?.name && input.newCustomer.phone) {
        customerId = Number((await t.run("INSERT INTO customers (name, phone) VALUES (?, ?)", input.newCustomer.name, input.newCustomer.phone)).lastInsertRowid);
      }
      const creditUsed = payments.filter((p) => p.method === "Saldo a favor").reduce((s, p) => s + p.amount, 0);
      if (creditUsed > 0) {
        if (!customerId) throw new Error("Para pagar con saldo a favor elige el cliente.");
        if ((await customerCredit(customerId, t)) < creditUsed) throw new Error("El cliente no tiene saldo a favor suficiente.");
        (await t.run("UPDATE customers SET store_credit = store_credit - ? WHERE id = ?", creditUsed, customerId));
      }

      const number = await nextNumber("sale_prefix", "next_sale", "V-", t);
      const saleId = Number(
        (await t.run("INSERT INTO sales (number, customer_id, subtotal, discount, total, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)", number, customerId, subtotal, discount, total, input.note || null, user.id)).lastInsertRowid,
      );

      // El cambio (vueltas) se descuenta del efectivo recibido.
      let change = paid - total;
      for (const p of payments) {
        let amount = p.amount;
        if (change > 0 && p.method === "Efectivo") {
          const c = Math.min(change, amount);
          amount -= c;
          change -= c;
        }
        if (amount > 0) (await t.run("INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)", saleId, p.method, amount));
      }
      const methodLabel = payments.map((p) => p.method).join(" + ");

      for (const l of lines) {
        if (l.type === "product") {
          const p = (await getProduct(l.productId, t))!;
          (await t.run("INSERT INTO sale_items (sale_id, product_id, description, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?, ?)", saleId, p.id, l.description, l.qty, l.unitPrice, p.cost));
          await moveStock({ productId: p.id, qty: -l.qty, reason: "venta", ref: number, userId: user.id }, t);
        } else if (l.type === "order") {
          (await t.run("INSERT INTO sale_items (sale_id, order_id, description, qty, unit_price, unit_cost) VALUES (?, ?, ?, 1, ?, 0)", saleId, l.orderId, l.description, l.unitPrice));
          (await t.run("INSERT INTO payments (order_id, amount, method, note, sale_id, user_id) VALUES (?, ?, ?, ?, ?, ?)", l.orderId, l.unitPrice, methodLabel, `Cobrado en caja ${number}`, saleId, user.id));
          await addEvent({ orderId: l.orderId, type: "payment", body: `Pago de $${l.unitPrice.toLocaleString("es-CO")} en caja (${number}).`, userId: user.id }, t);
        } else {
          (await t.run("INSERT INTO sale_items (sale_id, description, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, 0)", saleId, l.description, l.qty, l.unitPrice));
        }
      }
      return saleId;
    });
    revalidatePath("/panel/caja");
    for (const l of orderLines) revalidatePath(`/panel/orden/${(l as { orderId: number }).orderId}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function voidSale(fd: FormData) {
  const user = await requireUser();
  if (user.role === "tecnico") throw new Error("No tienes permisos para anular ventas.");
  const id = parseInt(String(fd.get("id")), 10);
  const sale = (await dbx.get("SELECT * FROM sales WHERE id = ?", id)) as { id: number; number: string; status: string; customer_id: number | null } | undefined;
  if (!sale || sale.status === "anulada") return;
  await tx(async (t) => {
    const items = (await t.all("SELECT * FROM sale_items WHERE sale_id = ?", id)) as { product_id: number | null; order_id: number | null; qty: number }[];
    for (const it of items) {
      if (it.product_id) await moveStock({ productId: it.product_id, qty: it.qty, reason: "devolucion", ref: `Anulación ${sale.number}`, userId: user.id }, t);
      if (it.order_id) {
        (await t.run("DELETE FROM payments WHERE sale_id = ? AND order_id = ?", id, it.order_id));
        await addEvent({ orderId: it.order_id, type: "payment", body: `Se anuló el pago de la venta ${sale.number}.`, userId: user.id }, t);
      }
    }
    const credit = ((await t.get("SELECT SUM(amount) AS n FROM sale_payments WHERE sale_id = ? AND method = 'Saldo a favor'", id)) as { n: number | null }).n ?? 0;
    if (credit && sale.customer_id) (await t.run("UPDATE customers SET store_credit = store_credit + ? WHERE id = ?", credit, sale.customer_id));
    (await t.run("UPDATE sales SET status = 'anulada' WHERE id = ?", id));
  });
  revalidatePath(`/panel/ventas/${id}`);
}
