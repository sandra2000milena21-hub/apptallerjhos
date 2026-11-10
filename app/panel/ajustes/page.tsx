import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/db";
import Tabs from "@/components/Tabs";
import { SETTINGS_TABS } from "./tabs";

export const metadata = { title: "Ajustes · Local y Órdenes" };

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

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const { ok } = await searchParams;
  const s = await getSettings();

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight">Ajustes</h1>
      <Tabs tabs={SETTINGS_TABS} active="general" />
      {ok && <p className="rounded-xl bg-good-soft text-good font-semibold px-4 py-3">Cambios guardados.</p>}

      <section className="card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-900 border border-blue-500/20 rounded-2xl shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <h3 className="font-bold text-white text-lg">Perfiles, Empleados y Permisos</h3>
          </div>
          <p className="text-sm text-slate-300 max-w-xl">
            Crea cuentas de acceso con usuario y contraseña para tus técnicos y asesores. Administra y modifica con precisión a qué datos tienen acceso y qué cambios pueden realizar en la base de datos principal.
          </p>
        </div>
        <Link
          href="/panel/ajustes/usuarios"
          className="btn-primary shrink-0 flex items-center gap-2 px-5 py-2.5 shadow-md shadow-blue-500/25 hover:scale-[1.02] transition"
        >
          <span>Gestionar Usuarios y Permisos</span>
          <span>→</span>
        </Link>
      </section>

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
    </div>
  );
}
