"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, hasPermission, NO_PERMISSION } from "@/lib/auth";
import { dbx, tx, type Exec } from "@/lib/db";
import { addEvent, getOrder, nextNumber, totals } from "@/lib/orders";
import { getProduct, moveStock } from "@/lib/inventory";
import { PAYMENT_METHODS } from "@/lib/constants";

export async function findOrderForCheckout(code: string) {
  const viewer = await requireUser();
  if (!hasPermission(viewer, "caja_view")) return null;
  const c = String(code ?? "").trim().toUpperCase().slice(0, 40);
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
    customer: {
      id: o.customer_id,
      name: o.customer_name,
      phone: o.customer_phone,
      credit: await customerCredit(o.customer_id),
      points: await customerPoints(o.customer_id),
    },
  };
}

export async function orderLineAction(id: number) {
  const viewer = await requireUser();
  if (!hasPermission(viewer, "caja_view") || !Number.isInteger(id)) return null;
  return orderLine(id);
}

async function customerCredit(id: number, ex: Exec = dbx) {
  return ((await ex.get("SELECT store_credit FROM customers WHERE id = ?", id)) as { store_credit: number } | undefined)?.store_credit ?? 0;
}

async function customerPoints(id: number, ex: Exec = dbx) {
  return ((await ex.get("SELECT COALESCE(points, 0) AS points FROM customers WHERE id = ?", id)) as { points: number } | undefined)?.points ?? 0;
}

export async function findCustomerByPhone(phone: string) {
  const viewer = await requireUser();
  if (!hasPermission(viewer, "caja_view")) return null;
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 7) return null;
  return (
    ((await dbx.get(
      "SELECT id, name, phone, store_credit AS credit, COALESCE(points, 0) AS points FROM customers WHERE replace(replace(phone,' ',''),'-','') LIKE ? ORDER BY id DESC LIMIT 1",
      `%${d.slice(-10)}`
    )) as { id: number; name: string; phone: string; credit: number; points: number } | undefined) ?? null
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
  pointsRedeemed?: number;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!hasPermission(user, "caja_register")) return { ok: false, error: NO_PERMISSION };
  if (!input || !Array.isArray(input.lines) || !Array.isArray(input.payments)) return { ok: false, error: "Venta inválida." };
  const okNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  // Solo números válidos; las cantidades de producto deben ser enteras y el cobro de una orden siempre es 1 línea.
  const lines = input.lines
    .filter((l) => l && okNum(l.qty) && okNum(l.unitPrice) && l.qty > 0 && l.qty <= 100000 && l.unitPrice >= 0 && l.unitPrice <= 1e10)
    .map((l) => ({ ...l, description: String(l.description ?? "").slice(0, 300), qty: l.type === "order" ? 1 : l.type === "product" ? Math.round(l.qty) : l.qty }))
    .filter((l) => l.qty > 0) as SaleLine[];
  if (!lines.length) return { ok: false, error: "La venta no tiene productos." };
  input = { ...input, discount: okNum(input.discount) ? input.discount : 0, payments: input.payments.filter((p) => p && okNum(p.amount)) };
  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;
  const discount = Math.round(Math.min(Math.max(0, input.discount || 0), subtotal) * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const payments = input.payments.filter((p) => p.amount > 0 && PAYMENT_METHODS.includes(p.method));
  const paid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  if (paid < total) return { ok: false, error: `Faltan $${(total - paid).toLocaleString("es-CO")} por pagar.` };
  const nonCash = Math.round(payments.filter((p) => p.method !== "Efectivo").reduce((s, p) => s + p.amount, 0) * 100) / 100;
  if (nonCash > total) {
    return { ok: false, error: "Los pagos electrónicos o con tarjeta no pueden ser mayores al total de la venta." };
  }
  const orderLines = lines.filter((l) => l.type === "order");
  if (orderLines.length && discount > 0) return { ok: false, error: "No se puede aplicar descuento al cobro de una orden; ajusta la cotización." };

  // Una misma orden no puede venir dos veces en la venta.
  const orderIds = orderLines.map((l) => (l as { orderId: number }).orderId);
  if (new Set(orderIds).size !== orderIds.length) return { ok: false, error: "La misma orden está repetida en la venta." };

  try {
    const id = await tx(async (t) => {
      // Las comprobaciones van dentro de la transacción: nadie puede vender la misma unidad ni cobrar el mismo saldo al tiempo.
      const needed = new Map<number, number>();
      for (const l of lines) if (l.type === "product") needed.set(l.productId, (needed.get(l.productId) ?? 0) + l.qty);
      for (const [productId, qty] of needed) {
        const p = await getProduct(productId, t);
        if (!p || !p.active) throw new Error("Uno de los productos ya no existe en el inventario.");
        if (p.track_stock && p.stock < qty) throw new Error(`No hay stock suficiente de ${p.name} (quedan ${p.stock}).`);
      }
      for (const l of lines) {
        if (l.type !== "order") continue;
        const o = await getOrder(l.orderId, t);
        if (!o) throw new Error("La orden que se intenta cobrar no existe.");
        const bal = (await totals(o.id, o, t)).balance;
        if (l.unitPrice <= 0) throw new Error(`El cobro de la orden ${o.number} debe ser mayor a cero.`);
        if (l.unitPrice > bal + 0.01) throw new Error(`La orden ${o.number} solo tiene $${bal.toLocaleString("es-CO")} de saldo pendiente.`);
      }

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
        customerId = Number((await t.run("INSERT INTO customers (name, phone) VALUES (?, ?)", String(input.newCustomer.name).trim().slice(0, 200), String(input.newCustomer.phone).trim().slice(0, 40))).lastInsertRowid);
      }
      if (customerId && !(await t.get("SELECT id FROM customers WHERE id = ?", customerId))) throw new Error("El cliente seleccionado no existe.");
      const creditUsed = payments.filter((p) => p.method === "Saldo a favor").reduce((s, p) => s + p.amount, 0);
      if (creditUsed > 0) {
        if (!customerId) throw new Error("Para pagar con saldo a favor elige el cliente.");
        if ((await customerCredit(customerId, t)) < creditUsed) throw new Error("El cliente no tiene saldo a favor suficiente.");
        (await t.run("UPDATE customers SET store_credit = store_credit - ? WHERE id = ?", creditUsed, customerId));
      }

      // Fidelización: redención de puntos
      const pointsRedeemed = okNum(input.pointsRedeemed) ? Math.max(0, Math.round(input.pointsRedeemed)) : 0;
      if (pointsRedeemed > 0) {
        if (!customerId) throw new Error("Para redimir puntos debes seleccionar o registrar un cliente.");
        const currentPts = await customerPoints(customerId, t);
        if (currentPts < pointsRedeemed) throw new Error(`El cliente solo tiene ${currentPts} puntos disponibles.`);
        await t.run("UPDATE customers SET points = points - ? WHERE id = ?", pointsRedeemed, customerId);
      }

      // Fidelización: acumulación (1 punto por cada $1.000 COP pagados)
      const pointsEarned = customerId && total > 0 ? Math.floor(total / 1000) : 0;
      if (pointsEarned > 0 && customerId) {
        await t.run("UPDATE customers SET points = points + ? WHERE id = ?", pointsEarned, customerId);
      }

      const number = await nextNumber("sale_prefix", "next_sale", "V-", t);
      const saleId = Number(
        (await t.run(
          "INSERT INTO sales (number, customer_id, subtotal, discount, total, points_earned, points_redeemed, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          number,
          customerId,
          subtotal,
          discount,
          total,
          pointsEarned,
          pointsRedeemed,
          input.note ? String(input.note).slice(0, 500) : null,
          user.id,
        )).lastInsertRowid,
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
  const user = await requirePermission("caja_register");
  if (user.role === "tecnico") throw new Error("No tienes permisos para anular ventas.");
  const id = parseInt(String(fd.get("id")), 10);
  if (!id) return;
  await tx(async (t) => {
    // Se vuelve a leer dentro de la transacción: dos clics seguidos no anulan (ni devuelven stock) dos veces.
    const sale = (await t.get("SELECT * FROM sales WHERE id = ?", id)) as { id: number; number: string; status: string; customer_id: number | null } | undefined;
    if (!sale || sale.status === "anulada") return;
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
    if (sale.customer_id) {
      const salePts = (await t.get("SELECT points_earned, points_redeemed FROM sales WHERE id = ?", id)) as
        | { points_earned: number; points_redeemed: number }
        | undefined;
      if (salePts?.points_earned) {
        await t.run("UPDATE customers SET points = MAX(0, points - ?) WHERE id = ?", salePts.points_earned, sale.customer_id);
      }
      if (salePts?.points_redeemed) {
        await t.run("UPDATE customers SET points = points + ? WHERE id = ?", salePts.points_redeemed, sale.customer_id);
      }
    }
    (await t.run("UPDATE sales SET status = 'anulada' WHERE id = ?", id));
  });
  revalidatePath(`/panel/ventas/${id}`);
}
