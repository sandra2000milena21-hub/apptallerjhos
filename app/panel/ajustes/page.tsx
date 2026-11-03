import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { dbx, getSettings, setSetting } from "@/lib/db";
import Tabs from "@/components/Tabs";
import { SETTINGS_TABS } from "./tabs";

export const metadata = { title: "Ajustes" };

const FIELDS: { key: string; label: string; type?: string; hint?: string }[] = [
  { key: "shop_name", label: "Nombre del local" },
  { key: "shop_address", label: "Dirección" },
  { key: "shop_phone", label: "Teléfono" },
  { key: "shop_whatsapp", label: "WhatsApp del local", hint: "Para el botón “Escríbenos” de la página del cliente." },
  { key: "shop_hours", label: "Horario" },
  { key: "order_prefix", label: "Prefijo de las órdenes", hint: "Ej. R- → R-0001" },
  { key: "next_number", label: "Siguiente número de orden", type: "number" },
  { key: "default_diagnostic_fee", label: "Valor del diagnóstico por defecto ($)", type: "number" },
  { key: "default_warranty_months", label: "Garantía por defecto (meses, mínimo 3)", type: "number" },
  { key: "storage_fee_per_day", label: "Almacenamiento por día ($)", type: "number" },
  { key: "sale_prefix", label: "Prefijo de las ventas", hint: "Ej. V- → V-0001" },
  { key: "buyback_prefix", label: "Prefijo de las retomas", hint: "Ej. C- → C-0001" },
  { key: "booking_hours", label: "Horas para citas en línea", hint: "Separadas por coma: 09:00,10:00,11:00" },
  { key: "booking_days", label: "Días con citas", hint: "0 = domingo … 6 = sábado. Ej. 1,2,3,4,5,6" },
];

async function saveSettings(fd: FormData) {
  "use server";
  await requireAdmin();
  for (const f of FIELDS) {
    const v = String(fd.get(f.key) ?? "").trim();
    if (f.key === "default_warranty_months") await setSetting(f.key, String(Math.max(3, parseInt(v || "3", 10))));
    else await setSetting(f.key, v);
  }
  await setSetting("terms", String(fd.get("terms") ?? ""));
  await setSetting("booking_enabled", fd.get("booking_enabled") === "on" ? "1" : "0");
  revalidatePath("/", "layout");
  redirect("/panel/ajustes?ok=1");
}

async function addUser(fd: FormData) {
  "use server";
  await requireAdmin();
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const role = ["admin", "tecnico", "asesor"].includes(String(fd.get("role"))) ? String(fd.get("role")) : "asesor";
  if (!name || !email || password.length < 6) redirect("/panel/ajustes?error=usuario");
  try {
    (await dbx.run("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)", name, email, bcrypt.hashSync(password, 10), role));
  } catch {
    redirect("/panel/ajustes?error=existe");
  }
  revalidatePath("/panel/ajustes");
}

async function toggleUser(fd: FormData) {
  "use server";
  const me = await requireAdmin();
  const id = parseInt(String(fd.get("id")), 10);
  if (id === me.id) return;
  (await dbx.run("UPDATE users SET active = 1 - active WHERE id = ?", id));
  revalidatePath("/panel/ajustes");
}

async function resetPassword(fd: FormData) {
  "use server";
  await requireAdmin();
  const id = parseInt(String(fd.get("id")), 10);
  const password = String(fd.get("password") || "");
  if (password.length < 6) redirect("/panel/ajustes?error=clave");
  (await dbx.run("UPDATE users SET password_hash = ? WHERE id = ?", bcrypt.hashSync(password, 10), id));
  redirect("/panel/ajustes?ok=clave");
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", tecnico: "Técnico", asesor: "Asesor" };
const ERRORS: Record<string, string> = {
  usuario: "Completa nombre, correo y una contraseña de al menos 6 caracteres.",
  existe: "Ya existe un usuario con ese correo.",
  clave: "La contraseña debe tener al menos 6 caracteres.",
};

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireAdmin();
  const { ok, error } = await searchParams;
  const s = await getSettings();
  const users = (await dbx.all("SELECT id, name, email, role, active FROM users ORDER BY active DESC, name")) as {
    id: number; name: string; email: string; role: string; active: number;
  }[];

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight">Ajustes</h1>
      <Tabs tabs={SETTINGS_TABS} active="general" />
      {ok && <p className="rounded-xl bg-good-soft text-good font-semibold px-4 py-3">Cambios guardados.</p>}
      {error && <p className="rounded-xl bg-bad-soft text-bad font-semibold px-4 py-3">{ERRORS[error] ?? "Error"}</p>}

      <form action={saveSettings} className="card p-5 space-y-4">
        <p className="section-title">Datos del local y de las órdenes</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label" htmlFor={f.key}>{f.label}</label>
              <input className="input" id={f.key} name={f.key} type={f.type ?? "text"} defaultValue={s[f.key]} />
              {f.hint && <p className="text-xs text-muted mt-1">{f.hint}</p>}
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="booking_enabled" defaultChecked={s.booking_enabled === "1"} className="size-5" /> Permitir que los clientes agenden citas en línea (/agendar)
        </label>
        <div>
          <label className="label" htmlFor="terms">Condiciones del servicio (las firma el cliente en cada orden)</label>
          <textarea className="input font-[inherit]" id="terms" name="terms" rows={14} defaultValue={s.terms} />
          <p className="text-xs text-muted mt-1">Las órdenes ya creadas conservan las condiciones que el cliente firmó.</p>
        </div>
        <button className="btn-primary">Guardar ajustes</button>
      </form>

      <section className="card p-5 space-y-4">
        <p className="section-title">Usuarios</p>
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48">
                <p className={`font-semibold ${u.active ? "" : "line-through text-muted"}`}>{u.name}</p>
                <p className="text-sm text-muted">{u.email} · {ROLE_LABEL[u.role] ?? u.role}</p>
              </div>
              <form action={resetPassword} className="flex gap-2">
                <input type="hidden" name="id" value={u.id} />
                <input name="password" type="password" className="input !min-h-10 !w-40" placeholder="Nueva clave" autoComplete="new-password" />
                <button className="btn-ghost !min-h-10">Cambiar</button>
              </form>
              {u.id !== me.id && (
                <form action={toggleUser}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="btn-ghost !min-h-10">{u.active ? "Desactivar" : "Activar"}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={addUser} className="grid sm:grid-cols-[1fr_1fr_140px_150px_auto] gap-2">
          <input name="name" className="input" placeholder="Nombre" required />
          <input name="email" type="email" className="input" placeholder="Correo" required autoCapitalize="none" />
          <input name="password" type="password" className="input" placeholder="Contraseña" required autoComplete="new-password" />
          <select name="role" className="input" defaultValue="asesor">
            <option value="asesor">Asesor</option>
            <option value="tecnico">Técnico</option>
            <option value="admin">Administrador</option>
          </select>
          <button className="btn-primary">Agregar</button>
        </form>
      </section>
    </div>
  );
}
