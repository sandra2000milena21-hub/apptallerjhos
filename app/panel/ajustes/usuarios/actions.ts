"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAdmin, DEFAULT_PERMISSIONS_BY_ROLE, parsePermissions, type UserPermissions } from "@/lib/auth";
import { dbx } from "@/lib/db";

const PERMISSION_KEYS: (keyof UserPermissions)[] = [
  "orders_view",
  "caja_view",
  "inventory_view",
  "customers_view",
  "buybacks_view",
  "appointments_view",
  "reports_view",
  "settings_view",
  "orders_create",
  "orders_edit",
  "orders_delete",
  "caja_register",
  "inventory_edit",
  "customers_edit",
  "view_costs",
];

function extractPermissions(fd: FormData, role: string): string {
  if (role === "admin") {
    return JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE.admin);
  }
  const perms: Partial<UserPermissions> = {};
  for (const k of PERMISSION_KEYS) {
    perms[k] = fd.get(`perm_${k}`) === "1" || fd.get(`perm_${k}`) === "on";
  }
  return JSON.stringify(perms);
}

export async function createUserAction(fd: FormData) {
  await requireAdmin();
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const phone = String(fd.get("phone") || "").trim() || null;
  const password = String(fd.get("password") || "");
  const role = String(fd.get("role") || "asesor");

  if (!name || !email) {
    return { ok: false, error: "El nombre y el correo o usuario son obligatorios." };
  }
  if (!password || password.length < 4) {
    return { ok: false, error: "La contraseña debe tener al menos 4 caracteres." };
  }

  const existing = await dbx.get("SELECT id FROM users WHERE lower(email) = ?", email);
  if (existing) {
    return { ok: false, error: "Ya existe un usuario con ese correo o nombre de usuario." };
  }

  const permissionsJson = extractPermissions(fd, role);

  try {
    await dbx.run(
      `INSERT INTO users (name, email, password_hash, role, phone, permissions, active) 
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      name,
      email,
      bcrypt.hashSync(password, 10),
      role,
      phone,
      permissionsJson,
    );
    revalidatePath("/panel/ajustes/usuarios");
    revalidatePath("/panel", "layout");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al crear usuario" };
  }
}

export async function updateUserAction(fd: FormData) {
  const me = await requireAdmin();
  const id = parseInt(String(fd.get("id")), 10);
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const phone = String(fd.get("phone") || "").trim() || null;
  const role = String(fd.get("role") || "asesor");
  const newPassword = String(fd.get("password") || "").trim();

  if (!id || !name || !email) {
    return { ok: false, error: "Faltan datos obligatorios." };
  }

  // Verificar correo único
  const existing = (await dbx.get("SELECT id FROM users WHERE lower(email) = ? AND id != ?", email, id)) as { id: number } | undefined;
  if (existing) {
    return { ok: false, error: "Ese correo o nombre de usuario ya está asignado a otro usuario." };
  }

  // Prevenir que el usuario admin actual se degrade a sí mismo
  const finalRole = id === me.id ? "admin" : role;
  const permissionsJson = id === me.id ? JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE.admin) : extractPermissions(fd, finalRole);

  try {
    if (newPassword && newPassword.length >= 4) {
      await dbx.run(
        `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, permissions = ?, password_hash = ? WHERE id = ?`,
        name,
        email,
        phone,
        finalRole,
        permissionsJson,
        bcrypt.hashSync(newPassword, 10),
        id,
      );
    } else {
      await dbx.run(
        `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, permissions = ? WHERE id = ?`,
        name,
        email,
        phone,
        finalRole,
        permissionsJson,
        id,
      );
    }
    revalidatePath("/panel/ajustes/usuarios");
    revalidatePath("/panel", "layout");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al actualizar usuario" };
  }
}

export async function toggleUserStatusAction(id: number) {
  const me = await requireAdmin();
  if (id === me.id) {
    return { ok: false, error: "No puedes desactivar tu propia cuenta administradora." };
  }
  await dbx.run("UPDATE users SET active = 1 - active WHERE id = ?", id);
  revalidatePath("/panel/ajustes/usuarios");
  revalidatePath("/panel", "layout");
  return { ok: true };
}

export async function resetPasswordAction(id: number, newPass: string) {
  await requireAdmin();
  if (!newPass || newPass.length < 4) {
    return { ok: false, error: "La contraseña debe tener al menos 4 caracteres." };
  }
  await dbx.run("UPDATE users SET password_hash = ? WHERE id = ?", bcrypt.hashSync(newPass, 10), id);
  revalidatePath("/panel/ajustes/usuarios");
  return { ok: true };
}

export async function deleteUserAction(id: number) {
  const me = await requireAdmin();
  if (id === me.id) {
    return { ok: false, error: "No puedes eliminar tu propia cuenta de administrador." };
  }
  // Soft delete desactivando o borrar si no tiene dependencias
  try {
    await dbx.run("DELETE FROM users WHERE id = ?", id);
    revalidatePath("/panel/ajustes/usuarios");
    revalidatePath("/panel", "layout");
    return { ok: true };
  } catch {
    // Si falla por foreign key, desactivarlo
    await dbx.run("UPDATE users SET active = 0 WHERE id = ?", id);
    revalidatePath("/panel/ajustes/usuarios");
    revalidatePath("/panel", "layout");
    return { ok: true, notice: "El usuario tenía registros asociados, por lo que fue desactivado permanentemente." };
  }
}
