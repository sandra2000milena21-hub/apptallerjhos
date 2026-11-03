"use server";

import { requireUser } from "@/lib/auth";
import { dbx, tx, type Exec } from "@/lib/db";
import { addEvent, newToken, nextOrderNumber } from "@/lib/orders";
import { saveSignature } from "@/lib/storage";
import { deviceType, PRIORITIES } from "@/lib/constants";
import { deviceHistory, findDevice, upsertDevice } from "@/lib/devices";
import { guessIntake, type IntakeGuess } from "@/lib/ai";
import { notifyOrderStatus } from "@/lib/notify";

export async function lookupCustomer(phone: string) {
  await requireUser();
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return (
    ((await dbx.get("SELECT id, name, doc_id, phone, email, store_credit FROM customers WHERE replace(replace(phone,' ',''),'-','') LIKE ? ORDER BY id DESC LIMIT 1", `%${digits.slice(-10)}`)) as { id: number; name: string; doc_id: string | null; phone: string; email: string | null; store_credit: number } | undefined) ?? null
  );
}

export async function lookupDevice(imei: string, serial: string) {
  await requireUser();
  const d = await findDevice(imei, serial);
  if (!d) return null;
  return { device: d, history: await deviceHistory(d.id) };
}

export async function quickFill(text: string): Promise<IntakeGuess | null> {
  await requireUser();
  if (!text.trim()) return null;
  return guessIntake(text);
}

export type NewOrderInput = {
  customer: { id?: number; name: string; doc_id: string; phone: string; email: string };
  device: {
    device_type: string;
    brand: string;
    model: string;
    color: string;
    capacity: string;
    imei: string;
    serial: string;
    passcode: string;
    services: string[];
    problem: string;
    accessories: string;
    priority: string;
  };
  intake: {
    entered_off: boolean;
    checklist: Record<string, string>;
    battery_health: string;
    condition_notes: string;
  };
  mediaIds: string[];
  values: {
    diagnostic_fee: number;
    estimate: number | null;
    deposit: number;
    deposit_method: string;
    due_date: string;
    warranty_months: number;
  };
  terms: string;
  data_consent: boolean;
  signature: string | null;
  appointmentId?: number | null;
};

export async function createOrder(input: NewOrderInput): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const c = input.customer;
  const d = input.device;
  if (!c.name.trim() || !c.phone.trim()) return { ok: false, error: "Faltan el nombre o el celular del cliente." };
  if (!d.model.trim()) return { ok: false, error: "Falta el modelo del equipo." };
  if (!d.problem.trim()) return { ok: false, error: "Falta la falla según el cliente." };
  if (!input.signature) return { ok: false, error: "Falta la firma del cliente." };
  if (!input.data_consent) return { ok: false, error: "El cliente debe aceptar las condiciones." };

  const dt = deviceType(d.device_type);
  const services = d.services.filter((s) => dt.services.some((t) => t.key === s));
  const checklist = Object.fromEntries(
    dt.checklist.map((i) => [i.key, ["ok", "falla", "np"].includes(input.intake.checklist[i.key]) ? input.intake.checklist[i.key] : "np"]),
  );
  const priority = PRIORITIES.some((p) => p.key === d.priority) ? d.priority : "normal";

  const create = (t: Exec) => (async () => {
    let customerId = c.id;
    if (customerId) {
      (await t.run("UPDATE customers SET name = ?, doc_id = ?, phone = ?, email = ? WHERE id = ?", c.name.trim(), c.doc_id.trim() || null, c.phone.trim(), c.email.trim() || null, customerId));
    } else {
      const numDigits = c.phone.replace(/\D/g, "");
      if (numDigits.length >= 7) {
        const existing = (await t.get(
          "SELECT id FROM customers WHERE replace(replace(phone,' ',''),'-','') LIKE ? LIMIT 1",
          `%${numDigits.slice(-10)}`,
        )) as { id: number } | undefined;
        if (existing) {
          customerId = existing.id;
          (await t.run("UPDATE customers SET name = ?, doc_id = COALESCE(?, doc_id), email = COALESCE(?, email) WHERE id = ?", c.name.trim(), c.doc_id.trim() || null, c.email.trim() || null, customerId));
        }
      }
      if (!customerId) {
        customerId = Number(
          (await t.run("INSERT INTO customers (name, doc_id, phone, email) VALUES (?, ?, ?, ?)", c.name.trim(), c.doc_id.trim() || null, c.phone.trim(), c.email.trim() || null)).lastInsertRowid,
        );
      }
    }

    const deviceId = await upsertDevice({
      customerId,
      deviceType: dt.key,
      brand: d.brand,
      model: d.model.trim(),
      color: d.color,
      capacity: d.capacity,
      imei: d.imei,
      serial: d.serial,
    }, t);

    const number = await nextOrderNumber(t);
    const orderId = Number(
      (await t.run(`INSERT INTO orders (number, token, customer_id, status, device_type, device_id, priority, brand, model, color, capacity, imei, serial, passcode,
             services, problem, accessories, condition_notes, entered_off, battery_health, checklist_in, diagnostic_fee, estimate, warranty_months,
             due_date, terms_text, data_consent, received_by)
           VALUES (?, ?, ?, 'recibido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, number,
          newToken(),
          customerId,
          dt.key,
          deviceId,
          priority,
          d.brand.trim() || null,
          d.model.trim(),
          d.color.trim() || null,
          d.capacity.trim() || null,
          d.imei.trim() || null,
          d.serial.trim() || null,
          d.passcode.trim() || null,
          JSON.stringify(services),
          d.problem.trim(),
          d.accessories.trim() || null,
          input.intake.condition_notes.trim() || null,
          input.intake.entered_off ? 1 : 0,
          input.intake.battery_health.trim() || null,
          JSON.stringify(checklist),
          Math.max(0, Math.round(input.values.diagnostic_fee || 0)),
          input.values.estimate ? Math.round(input.values.estimate) : null,
          Math.max(3, Math.round(input.values.warranty_months || 3)),
          input.values.due_date || null,
          input.terms,
          user.id,)).lastInsertRowid,
    );

    if (input.mediaIds.length) {
      for (const id of input.mediaIds) await t.run("UPDATE media SET order_id = ? WHERE id = ? AND order_id IS NULL", orderId, id);
    }
    const sigId = await saveSignature(input.signature!, orderId, user.id, t);
    (await t.run("UPDATE orders SET intake_signature = ? WHERE id = ?", sigId, orderId));

    if (input.values.deposit > 0) {
      (await t.run("INSERT INTO payments (order_id, amount, method, note, user_id) VALUES (?, ?, ?, 'Abono al recibir', ?)", orderId, Math.round(input.values.deposit), input.values.deposit_method || "Efectivo", user.id));
    }
    if (input.appointmentId) {
      (await t.run("UPDATE appointments SET status = 'llego', order_id = ? WHERE id = ?", orderId, input.appointmentId));
    }
    await addEvent({
      orderId,
      type: "status",
      status: "recibido",
      body: `Equipo recibido. ${input.mediaIds.length} foto(s)/video(s) de ingreso.`,
      isPublic: true,
      userId: user.id,
    }, t);
    return orderId;
  })();

  try {
    const id = await tx(create);
    await notifyOrderStatus(id, "recibido");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: "No se pudo guardar la orden: " + (e as Error).message };
  }
}
