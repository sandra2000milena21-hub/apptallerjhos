"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, hasPermission, NO_PERMISSION } from "@/lib/auth";
import { dbx, tx } from "@/lib/db";
import { addEvent, getOrder, nextNumber, totals } from "@/lib/orders";
import { STATUS_KEYS, statusInfo, deviceType, PRIORITIES, PAYMENT_METHODS } from "@/lib/constants";
import { getProduct, moveStock } from "@/lib/inventory";
import { notifyOrderStatus } from "@/lib/notify";
import { createPaymentLink } from "@/lib/wompi";
import { publicBaseUrl } from "@/lib/orders";
import { parseMoney } from "@/lib/format";
import { deleteMediaFile, saveSignature } from "@/lib/storage";

function idOf(fd: FormData) {
  const id = parseInt(String(fd.get("orderId")), 10);
  if (!id) throw new Error("Orden inválida");
  return id;
}

function refresh(id: number) {
  revalidatePath(`/panel/orden/${id}`);
  revalidatePath("/panel");
}

export async function changeStatus(fd: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "orders_edit")) return;
  const id = idOf(fd);
  const status = String(fd.get("status"));
  if (!STATUS_KEYS.includes(status as never)) return;
  if (!(await dbx.get("SELECT id FROM orders WHERE id = ?", id))) return;
  const note = String(fd.get("note") || "").trim().slice(0, 2000);
  const isPublic = fd.get("public") === "on";
  const sets = ["status = ?"];
  const params: unknown[] = [status];
  if (status === "listo") {
    sets.push("ready_at = datetime('now')");
  }
  if (status === "entregado") {
    sets.push("delivered_at = datetime('now')");
    sets.push("delivered_to = coalesce(delivered_to, (SELECT name FROM customers WHERE id = (SELECT customer_id FROM orders WHERE id = ?)))");
    params.push(id);
  }
  params.push(id);
  (await dbx.run(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, ...params));
  await addEvent({
    orderId: id,
    type: "status",
    status,
    body: note ? `${statusInfo(status).label}. ${note}` : (status === "entregado" ? "Equipo entregado al cliente." : statusInfo(status).label),
    isPublic: true,
    userId: user.id,
  });
  // Si la nota es interna, se guarda aparte para que el cliente vea solo el cambio de estado.
  if (note && !isPublic) {
    (await dbx.run("UPDATE events SET body = ? WHERE id = (SELECT max(id) FROM events WHERE order_id = ?)", statusInfo(status).label, id));
    await addEvent({ orderId: id, type: "note", body: note, isPublic: false, userId: user.id });
  }
  await notifyOrderStatus(id, status);
  refresh(id);
}

export async function addNote(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  const body = String(fd.get("body") || "").trim().slice(0, 4000);
  if (!body) return;
  await addEvent({ orderId: id, type: "note", body, isPublic: fd.get("public") === "on", userId: user.id });
  refresh(id);
}

export async function assignTechnician(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  const techId = parseInt(String(fd.get("technician_id") || "0"), 10) || null;
  (await dbx.run("UPDATE orders SET technician_id = ? WHERE id = ?", techId, id));
  const name = techId ? ((await dbx.get("SELECT name FROM users WHERE id = ?", techId)) as { name: string } | undefined)?.name : null;
  await addEvent({ orderId: id, type: "system", body: name ? `Técnico asignado: ${name}` : "Técnico sin asignar", userId: user.id });
  refresh(id);
}

export async function addQuoteItem(fd: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "orders_edit")) return;
  const id = idOf(fd);
  const description = String(fd.get("description") || "").trim();
  const amount = parseMoney(fd.get("amount"));
  if (!description) return;
  (await dbx.run("INSERT INTO quote_items (order_id, description, amount) VALUES (?, ?, ?)", id, description, amount));
  refresh(id);
}

async function addItemWithPart(orderId: number, description: string, amount: number, productId: number | null, userId: number) {
  const order = await getOrder(orderId);
  if (!order) return;
  // Ítem y salida de inventario van juntos: o se guardan los dos o ninguno.
  await tx(async (t) => {
    const product = productId ? await getProduct(productId, t) : undefined;
    await t.run("INSERT INTO quote_items (order_id, description, amount, product_id, qty, unit_cost) VALUES (?, ?, ?, ?, 1, ?)", orderId, description, amount, product?.id ?? null, product?.cost ?? 0);
    // El repuesto sale del inventario apenas entra a la orden; si se quita, vuelve.
    if (product) await moveStock({ productId: product.id, qty: -1, reason: "reparacion", ref: order.number, userId }, t);
  });
}

export async function addCatalogItem(fd: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "orders_edit")) return;
  const id = idOf(fd);
  const c = (await dbx.get("SELECT * FROM repair_catalog WHERE id = ?", parseInt(String(fd.get("catalogId")), 10))) as
    | { id: number; name: string; price: number; product_id: number | null }
    | undefined;
  if (!c) return;
  await addItemWithPart(id, c.name, c.price, c.product_id, user.id);
  refresh(id);
}

export async function addProductItem(fd: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "orders_edit")) return;
  const id = idOf(fd);
  const p = await getProduct(parseInt(String(fd.get("productId")), 10));
  if (!p) return;
  const price = parseMoney(fd.get("amount")) || p.price;
  await addItemWithPart(id, p.name, price, p.id, user.id);
  refresh(id);
}

export async function removeQuoteItem(fd: FormData) {
  const user = await requireUser();
  if (!hasPermission(user, "orders_edit")) return;
  const id = idOf(fd);
  const item = (await dbx.get("SELECT * FROM quote_items WHERE id = ? AND order_id = ?", parseInt(String(fd.get("itemId")), 10), id)) as
    | { id: number; product_id: number | null; qty: number }
    | undefined;
  if (!item) return;
  const number = (await getOrder(id))?.number;
  await tx(async (t) => {
    // Si otra petición ya lo quitó, no se devuelve el repuesto dos veces.
    const gone = await t.run("DELETE FROM quote_items WHERE id = ?", item.id);
    if (gone.changes && item.product_id) await moveStock({ productId: item.product_id, qty: item.qty, reason: "devolucion", ref: number, userId: user.id }, t);
  });
  refresh(id);
}

export async function setPriority(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  const p = String(fd.get("priority"));
  if (!PRIORITIES.some((x) => x.key === p)) return;
  (await dbx.run("UPDATE orders SET priority = ? WHERE id = ?", p, id));
  await addEvent({ orderId: id, type: "system", body: `Prioridad: ${PRIORITIES.find((x) => x.key === p)!.label}`, userId: user.id });
  refresh(id);
}

export async function resendNotice(fd: FormData) {
  await requirePermission("orders_edit");
  const id = idOf(fd);
  const o = await getOrder(id);
  if (!o) return;
  await notifyOrderStatus(id, o.status);
  refresh(id);
}

export async function createWompiLink(fd: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const user = await requireUser();
  if (!hasPermission(user, "caja_register")) return { ok: false, error: NO_PERMISSION };
  const id = idOf(fd);
  const o = await getOrder(id);
  if (!o) return { ok: false, error: "Orden no existe" };
  const t = await totals(id, o);
  if (t.balance <= 0) return { ok: false, error: "La orden no tiene saldo pendiente." };
  try {
    const link = await createPaymentLink({
      name: `Orden ${o.number}`,
      description: `Reparación ${o.model} · ${o.customer_name}`,
      amount: t.balance,
      redirectUrl: `${await publicBaseUrl()}/s/${o.token}`,
    });
    (await dbx.run("INSERT INTO payment_links (id, order_id, amount, url) VALUES (?, ?, ?, ?)", link.id, id, t.balance, link.url));
    await addEvent({ orderId: id, type: "payment", body: `Link de pago en línea creado por $${t.balance.toLocaleString("es-CO")}.`, isPublic: true, userId: user.id });
    refresh(id);
    return { ok: true, url: link.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendQuote(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  const order = await getOrder(id);
  if (!order) return;
  const t = await totals(id, order);
  if (!t.items.length) return;
  (await dbx.run("UPDATE orders SET quote_status = 'pendiente', quote_decided_at = NULL, quote_decided_by = NULL, status = 'cotizado' WHERE id = ?", id));
  await addEvent({
    orderId: id,
    type: "quote",
    status: "cotizado",
    body: `Cotización enviada por $${t.quoteTotal.toLocaleString("es-CO")}. Esperando tu aprobación.`,
    isPublic: true,
    userId: user.id,
  });
  await notifyOrderStatus(id, "cotizado");
  refresh(id);
}

export async function decideQuote(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  const decision = fd.get("decision") === "aprobada" ? "aprobada" : "rechazada";
  const order = await getOrder(id);
  if (!order) return;
  await tx(async (t) => {
    await t.run("UPDATE orders SET quote_status = ?, quote_decided_at = datetime('now'), quote_decided_by = ? WHERE id = ?", decision, `${user.name} (registrado en el local)`, id);
    if (decision === "rechazada") {
      const items = (await t.all("SELECT * FROM quote_items WHERE order_id = ? AND product_id IS NOT NULL", id)) as { id: number; product_id: number; qty: number }[];
      for (const it of items) {
        await moveStock({ productId: it.product_id, qty: it.qty, reason: "devolucion", ref: `${order.number} (rechazada)`, userId: user.id }, t);
        await t.run("UPDATE quote_items SET product_id = NULL WHERE id = ?", it.id);
      }
    }
    await addEvent({
      orderId: id,
      type: "quote",
      body: decision === "aprobada" ? "Cotización aprobada por el cliente (WhatsApp/teléfono)." : "Cotización rechazada por el cliente. Los repuestos reservados volvieron al inventario.",
      isPublic: true,
      userId: user.id,
    }, t);
  });
  refresh(id);
}

export async function addPayment(fd: FormData) {
  const user = await requirePermission("caja_register");
  const id = idOf(fd);
  const amount = parseMoney(fd.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!(await dbx.get("SELECT id FROM orders WHERE id = ?", id))) return;
  const rawMethod = String(fd.get("method") || "Efectivo");
  const method = PAYMENT_METHODS.includes(rawMethod) ? rawMethod : "Efectivo";
  const note = String(fd.get("note") || "").trim().slice(0, 500) || null;
  (await dbx.run("INSERT INTO payments (order_id, amount, method, note, user_id) VALUES (?, ?, ?, ?, ?)", id, amount, method, note, user.id));
  await addEvent({ orderId: id, type: "payment", body: `Pago registrado: $${amount.toLocaleString("es-CO")} (${method})`, userId: user.id });
  refresh(id);
}

export async function saveChecklistOut(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  let raw: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(fd.get("checklist") || "{}"));
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, string>;
  } catch {
    /* lista inválida: se trata como vacía */
  }
  const order = await getOrder(id);
  if (!order) return;
  const clean = Object.fromEntries(deviceType(order?.device_type).checklist.map((i) => [i.key, ["ok", "falla", "np"].includes(raw[i.key]) ? raw[i.key] : "np"]));
  (await dbx.run("UPDATE orders SET checklist_out = ? WHERE id = ?", JSON.stringify(clean), id));
  const fails = Object.values(clean).filter((v) => v === "falla").length;
  await addEvent({
    orderId: id,
    type: "system",
    body: fails ? `Control de calidad con ${fails} falla(s).` : "Control de calidad aprobado: todas las pruebas OK.",
    userId: user.id,
  });
  refresh(id);
}

export async function deliver(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!hasPermission(user, "orders_edit")) return { ok: false, error: NO_PERMISSION };
  const id = idOf(fd);
  if (!(await dbx.get("SELECT id FROM orders WHERE id = ?", id))) return { ok: false, error: "Orden no encontrada." };
  const signature = String(fd.get("signature") || "");
  const receivedBy = String(fd.get("delivered_to") || "").trim();
  if (!signature) return { ok: false, error: "Falta la firma de recibido." };
  if (!receivedBy) return { ok: false, error: "Escribe quién recibe el equipo." };
  await tx(async (t) => {
    const sigId = await saveSignature(signature, id, user.id, t);
    await t.run("UPDATE orders SET status = 'entregado', delivered_at = datetime('now'), delivery_signature = ?, delivered_to = ? WHERE id = ?", sigId, receivedBy, id);
    await addEvent({ orderId: id, type: "status", status: "entregado", body: `Equipo entregado a ${receivedBy}, recibido a satisfacción.`, isPublic: true, userId: user.id }, t);
  });
  await notifyOrderStatus(id, "entregado");
  refresh(id);
  return { ok: true };
}

export async function toggleMediaPublic(fd: FormData) {
  await requirePermission("orders_edit");
  const id = idOf(fd);
  (await dbx.run("UPDATE media SET public = 1 - public WHERE id = ? AND order_id = ?", String(fd.get("mediaId")), id));
  refresh(id);
}

export async function deleteMedia(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  const m = (await dbx.get("SELECT filename FROM media WHERE id = ? AND order_id = ? AND kind != 'signature'", String(fd.get("mediaId")), id)) as
    | { filename: string }
    | undefined;
  if (!m) return;
  (await dbx.run("DELETE FROM media WHERE id = ?", String(fd.get("mediaId"))));
  await deleteMediaFile(m.filename);
  await addEvent({ orderId: id, type: "system", body: "Se eliminó una foto o video.", userId: user.id });
  refresh(id);
}

export async function updateDueDate(fd: FormData) {
  const user = await requirePermission("orders_edit");
  const id = idOf(fd);
  const dueRaw = String(fd.get("due_date") || "");
  const due = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
  (await dbx.run("UPDATE orders SET due_date = ? WHERE id = ?", due, id));
  await addEvent({ orderId: id, type: "system", body: due ? `Nueva fecha estimada de entrega: ${due}` : "Fecha de entrega sin definir", isPublic: true, userId: user.id });
  refresh(id);
}

export type OrderDeliveryInfo = {
  orderId: number;
  number: string;
  model: string;
  brand: string | null;
  customerName: string;
  customerPhone: string;
  total: number;
  paid: number;
  balance: number;
};

export async function getOrderDeliveryInfo(orderId: number): Promise<OrderDeliveryInfo | null> {
  const viewer = await requireUser();
  if (!hasPermission(viewer, "orders_view")) return null;
  if (!Number.isInteger(orderId)) return null;
  const o = await getOrder(orderId);
  if (!o) return null;
  const t = await totals(orderId, o);
  return {
    orderId: o.id,
    number: o.number,
    model: o.model,
    brand: o.brand,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    total: t.total,
    paid: t.paid,
    balance: t.balance,
  };
}

export type DeliveryProcessInput = {
  orderId: number;
  deliveredTo: string;
  payRemaining: boolean;
  paymentMethod: string;
  paymentAmount: number;
  finalNote?: string;
  noteIsPublic?: boolean;
  signature?: string | null;
};

export async function processDeliveryAction(input: DeliveryProcessInput): Promise<{ ok: boolean; error?: string; saleId?: number }> {
  const user = await requireUser();
  if (!hasPermission(user, "orders_edit")) return { ok: false, error: NO_PERMISSION };
  const id = Number(input?.orderId);
  if (!Number.isInteger(id)) return { ok: false, error: "Orden inválida." };
  const o = await getOrder(id);
  if (!o) return { ok: false, error: "Orden no encontrada." };
  if (o.status === "entregado") return { ok: false, error: "Esta orden ya fue entregada." };
  if (input.payRemaining && !hasPermission(user, "caja_register")) {
    return { ok: false, error: "No tienes permiso para registrar cobros. Entrega sin cobrar o pídele a caja que registre el pago." };
  }

  const receivedBy = String(input.deliveredTo || o.customer_name || "").trim().slice(0, 200);
  if (!receivedBy) return { ok: false, error: "Indica quién recibe el equipo." };
  const requested = Number(input.paymentAmount);
  const method = PAYMENT_METHODS.includes(input.paymentMethod) ? input.paymentMethod : "Efectivo";

  let saleId: number | undefined = undefined;

  try {
    await tx(async (db) => {
      // El saldo se calcula dentro de la transacción: si otro usuario cobró hace un segundo, no se cobra dos veces.
      const t = await totals(id, o, db);
      // 1. Si hay saldo restante y se marcó para cobrar:
      if (input.payRemaining && t.balance > 0) {
        const amount = Math.min(Math.max(0, Number.isFinite(requested) && requested > 0 ? Math.round(requested * 100) / 100 : t.balance), t.balance);
        if (amount > 0) {
          if (method === "Saldo a favor") {
            // El saldo a favor se descuenta de verdad del cliente (antes solo se anotaba el método).
            const credit = ((await db.get("SELECT store_credit FROM customers WHERE id = ?", o.customer_id)) as { store_credit: number } | undefined)?.store_credit ?? 0;
            if (credit < amount) throw new Error(`El cliente solo tiene $${credit.toLocaleString("es-CO")} de saldo a favor.`);
            await db.run("UPDATE customers SET store_credit = store_credit - ? WHERE id = ?", amount, o.customer_id);
          }
          const saleNumber = await nextNumber("sale_prefix", "next_sale", "V-", db);
          const pointsEarned = o.customer_id && amount > 0 ? Math.floor(amount / 1000) : 0;

          const sId = Number(
            (await db.run(
              "INSERT INTO sales (number, customer_id, subtotal, discount, total, points_earned, points_redeemed, note, user_id) VALUES (?, ?, ?, 0, ?, ?, 0, ?, ?)",
              saleNumber,
              o.customer_id,
              amount,
              amount,
              pointsEarned,
              `Entrega orden ${o.number} (${o.model})`,
              user.id,
            )).lastInsertRowid,
          );
          saleId = sId;

          await db.run("INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)", sId, method, amount);
          await db.run(
            "INSERT INTO sale_items (sale_id, order_id, description, qty, unit_price, unit_cost) VALUES (?, ?, ?, 1, ?, 0)",
            sId,
            o.id,
            `Saldo orden ${o.number} · ${o.model}`,
            amount,
          );
          await db.run(
            "INSERT INTO payments (order_id, amount, method, note, sale_id, user_id) VALUES (?, ?, ?, ?, ?, ?)",
            o.id,
            amount,
            method,
            `Cobrado en entrega (${saleNumber})`,
            sId,
            user.id,
          );

          if (pointsEarned > 0 && o.customer_id) {
            await db.run("UPDATE customers SET points = points + ? WHERE id = ?", pointsEarned, o.customer_id);
          }

          await addEvent(
            {
              orderId: o.id,
              type: "payment",
              body: `Pago de $${amount.toLocaleString("es-CO")} en entrega (${method}). Recibo ${saleNumber}.`,
              userId: user.id,
            },
            db,
          );
        }
      }

      // 2. Nota final de reparación
      if (input.finalNote && String(input.finalNote).trim()) {
        await addEvent(
          {
            orderId: o.id,
            type: "note",
            body: `Nota final de entrega: ${String(input.finalNote).trim().slice(0, 2000)}`,
            isPublic: input.noteIsPublic ?? true,
            userId: user.id,
          },
          db,
        );
      }

      // 3. Firma digital
      let sigId: string | null = null;
      if (typeof input.signature === "string" && input.signature.startsWith("data:image")) {
        sigId = await saveSignature(input.signature, o.id, user.id, db);
      }

      // 4. Actualizar orden a "entregado"
      const sets = [
        "status = 'entregado'",
        "delivered_at = datetime('now')",
        "delivered_to = ?",
      ];
      const params: unknown[] = [receivedBy];
      if (sigId) {
        sets.push("delivery_signature = ?");
        params.push(sigId);
      }
      params.push(o.id);
      await db.run(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, ...params);

      await addEvent(
        {
          orderId: o.id,
          type: "status",
          status: "entregado",
          body: `Equipo entregado a ${receivedBy}, recibido a satisfacción.`,
          isPublic: true,
          userId: user.id,
        },
        db,
      );
    });

    await notifyOrderStatus(o.id, "entregado");
    refresh(o.id);
    return { ok: true, saleId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
