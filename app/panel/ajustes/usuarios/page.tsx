import { requireAdmin, parsePermissions, type UserPermissions } from "@/lib/auth";
import { dbx } from "@/lib/db";
import Tabs from "@/components/Tabs";
import { SETTINGS_TABS } from "../tabs";
import UserManager, { type ManagedUser } from "./UserManager";

export const metadata = { title: "Usuarios y Permisos · Ajustes" };

export default async function UsuariosAjustesPage() {
  const me = await requireAdmin();

  const rawUsers = (await dbx.all(
    "SELECT id, name, email, phone, role, active, permissions, created_at FROM users ORDER BY active DESC, (role = 'admin') DESC, name ASC",
  )) as {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    active: number;
    permissions: string | null;
    created_at: string;
  }[];

  const users: ManagedUser[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    active: u.active,
    created_at: u.created_at,
    permissions: parsePermissions(u.permissions, u.role),
  }));

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-black tracking-tight text-white">Ajustes</h1>
        <p className="text-sm text-slate-400">
          Configuración global del taller, perfiles de empleados y servicios integrados.
        </p>
      </div>

      <Tabs tabs={SETTINGS_TABS} active="usuarios" />

      <UserManager users={users} currentUserId={me.id} />
    </div>
  );
}
