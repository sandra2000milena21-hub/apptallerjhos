import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/db";
import { STATUSES } from "@/lib/constants";
import { publicBaseUrl } from "@/lib/orders";
import { sendEmail, sendSms, sendWhatsApp } from "@/lib/notify";
import { guessIntake } from "@/lib/ai";
import Tabs from "@/components/Tabs";
import { SETTINGS_TABS } from "../tabs";

export const metadata = { title: "Integraciones" };

const SECRET_KEYS = ["wa_token", "twilio_token", "smtp_pass", "wompi_private_key", "wompi_events_secret", "ai_key"];
const PLAIN_KEYS = ["wa_phone_number_id", "wa_template", "wa_lang", "twilio_sid", "twilio_from", "smtp_host", "smtp_port", "smtp_user", "smtp_from", "google_review_url", "ai_model"];
const TOGGLES = ["wa_enabled", "sms_enabled", "email_enabled"];

async function save(fd: FormData) {
  "use server";
  await requireAdmin();
  for (const k of PLAIN_KEYS) await setSetting(k, String(fd.get(k) ?? "").trim());
  for (const k of TOGGLES) await setSetting(k, fd.get(k) === "on" ? "1" : "0");
  // Las claves secretas solo se cambian si se escribe algo nuevo; "borrar" las elimina.
  for (const k of SECRET_KEYS) {
    const v = String(fd.get(k) ?? "").trim();
    if (v === "borrar") await setSetting(k, "");
    else if (v) await setSetting(k, v);
  }
  await setSetting("notify_statuses", STATUSES.map((s) => s.key).filter((k) => fd.get(`notify_${k}`) === "on").join(","));
  revalidatePath("/panel/ajustes/integraciones");
  redirect("/panel/ajustes/integraciones?ok=1");
}

async function test(fd: FormData) {
  "use server";
  await requireAdmin();
  const channel = String(fd.get("channel"));
  const to = String(fd.get("to") || "").trim();
  const s = await getSettings();
  let result = "ok";
  try {
    if (channel === "whatsapp") await sendWhatsApp(to, ["Prueba", "iPhone", "R-0000", "Mensaje de prueba", "https://ejemplo.co"], s);
    else if (channel === "sms") await sendSms(to, `Prueba de ${s.shop_name}: los avisos por SMS funcionan.`, s);
    else if (channel === "correo") await sendEmail(to, `Prueba de ${s.shop_name}`, "Los avisos por correo funcionan.", s);
    else if (channel === "ia") {
      const g = await guessIntake("iPhone 13 se cayó al agua y no carga");
      result = g.source === "ia" ? `ok: ${g.model} · ${g.services.join(", ")}` : "La IA no respondió; se usaron reglas. Revisa la clave.";
    }
  } catch (e) {
    result = (e as Error).message.slice(0, 200);
  }
  redirect(`/panel/ajustes/integraciones?prueba=${encodeURIComponent(channel + ": " + result)}`);
}

function Secret({ name, label, saved, hint }: { name: string; label: string; saved: boolean; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="password" autoComplete="off" className="input" placeholder={saved ? "•••••• guardada (escribe para cambiar)" : "Sin configurar"} />
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Field({ name, label, value, hint, placeholder }: { name: string; label: string; value: string; hint?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" defaultValue={value} placeholder={placeholder} />
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className="flex items-center gap-2 font-semibold">
      <input type="checkbox" name={name} defaultChecked={on} className="size-5" /> {label}
    </label>
  );
}

export default async function Integraciones({ searchParams }: { searchParams: Promise<{ ok?: string; prueba?: string }> }) {
  await requireAdmin();
  const { ok, prueba } = await searchParams;
  const s = await getSettings();
  const base = await publicBaseUrl();
  const notify = (s.notify_statuses || "").split(",");
  const has = (k: string) => Boolean(s[k]);

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-[28px] font-bold tracking-tight">Ajustes</h1>
      <Tabs tabs={SETTINGS_TABS} active="integraciones" />
      {ok && <p className="rounded-xl bg-good-soft text-good font-semibold px-4 py-3">Integraciones guardadas.</p>}
      {prueba && <p className={`rounded-xl font-semibold px-4 py-3 ${prueba.includes(": ok") ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>Prueba {prueba}</p>}

      <form action={save} className="space-y-5">
        <section className="card p-5 space-y-4">
          <p className="section-title">Avisos automáticos al cliente</p>
          <p className="text-sm text-muted">Cuando la orden cambia a uno de estos estados, se avisa por los canales activos. El botón manual de WhatsApp sigue funcionando siempre.</p>
          <div className="flex flex-wrap gap-4">
            {STATUSES.map((st) => (
              <label key={st.key} className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" name={`notify_${st.key}`} defaultChecked={notify.includes(st.key)} className="size-5" /> {st.short}
              </label>
            ))}
          </div>
          <Field name="google_review_url" label="Enlace para calificarnos en Google" value={s.google_review_url} hint="Se envía al entregar el equipo. Lo encuentras en tu Perfil de Empresa de Google → Pedir reseñas." />
        </section>

        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">WhatsApp Business (API oficial de Meta)</p>
            <Toggle name="wa_enabled" label="Activo" on={s.wa_enabled === "1"} />
          </div>
          <p className="text-sm text-muted">
            Necesitas una cuenta de WhatsApp Business Platform y una plantilla aprobada por Meta con 5 variables en el cuerpo:
            {" {{1}}"} nombre, {"{{2}}"} equipo, {"{{3}}"} orden, {"{{4}}"} estado, {"{{5}}"} enlace de seguimiento.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field name="wa_phone_number_id" label="Phone number ID" value={s.wa_phone_number_id} />
            <Secret name="wa_token" label="Token de acceso permanente" saved={has("wa_token")} />
            <Field name="wa_template" label="Nombre de la plantilla" value={s.wa_template} placeholder="estado_reparacion" />
            <Field name="wa_lang" label="Idioma de la plantilla" value={s.wa_lang} placeholder="es" />
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">SMS (Twilio)</p>
            <Toggle name="sms_enabled" label="Activo" on={s.sms_enabled === "1"} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field name="twilio_sid" label="Account SID" value={s.twilio_sid} />
            <Secret name="twilio_token" label="Auth token" saved={has("twilio_token")} />
            <Field name="twilio_from" label="Número remitente" value={s.twilio_from} placeholder="+1…" />
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Correo (SMTP)</p>
            <Toggle name="email_enabled" label="Activo" on={s.email_enabled === "1"} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field name="smtp_host" label="Servidor" value={s.smtp_host} placeholder="smtp.gmail.com" />
            <Field name="smtp_port" label="Puerto" value={s.smtp_port} />
            <Field name="smtp_from" label="Remitente" value={s.smtp_from} placeholder="Mi Taller <taller@midominio.co>" />
            <Field name="smtp_user" label="Usuario" value={s.smtp_user} />
            <Secret name="smtp_pass" label="Contraseña" saved={has("smtp_pass")} hint="En Gmail usa una contraseña de aplicación." />
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <p className="section-title">Pagos en línea (Wompi)</p>
          <p className="text-sm text-muted">
            Crea links de pago por el saldo de una orden (tarjeta, PSE, Nequi, botón Bancolombia). Cuando el cliente paga, el pago se registra solo.
            URL de eventos para configurar en Wompi: <code className="font-mono text-ink">{base}/api/webhooks/wompi</code>
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Secret name="wompi_private_key" label="Llave privada (prv_prod_… o prv_test_…)" saved={has("wompi_private_key")} />
            <Secret name="wompi_events_secret" label="Secreto de eventos" saved={has("wompi_events_secret")} />
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <p className="section-title">Asistente con IA (Claude)</p>
          <p className="text-sm text-muted">Llena la orden a partir de una frase. Sin clave se usan reglas automáticas, que también funcionan.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Secret name="ai_key" label="Clave de API de Anthropic" saved={has("ai_key") || Boolean(process.env.ANTHROPIC_API_KEY)} />
            <Field name="ai_model" label="Modelo" value={s.ai_model} />
          </div>
        </section>

        <button className="btn-primary">Guardar integraciones</button>
        <p className="text-xs text-muted">Para borrar una clave guardada escribe “borrar” en su campo y guarda.</p>
      </form>

      <form action={test} className="card p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Probar canal</label>
          <select name="channel" className="input !w-44">
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="correo">Correo</option>
            <option value="ia">IA</option>
          </select>
        </div>
        <div className="flex-1 min-w-56">
          <label className="label">Enviar a (celular o correo)</label>
          <input name="to" className="input" placeholder="3001234567 o correo@ejemplo.co" />
        </div>
        <button className="btn-ghost">Enviar prueba</button>
      </form>
    </div>
  );
}
