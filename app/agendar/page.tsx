import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { dbx, getSettings } from "@/lib/db";
import { DEVICE_TYPES } from "@/lib/constants";
import { availableSlots } from "@/lib/booking";
import BookingForm from "./BookingForm";

export const metadata = { title: "Agenda tu reparación" };

const hits = new Map<string, number[]>();

async function book(fd: FormData) {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      const active = v.filter((t) => now - t < 3600_000);
      if (!active.length) hits.delete(k);
      else hits.set(k, active);
    }
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 5) redirect("/agendar?error=limite");
  hits.set(ip, [...recent, now]);

  const name = String(fd.get("name") || "").trim();
  const phone = String(fd.get("phone") || "").trim();
  const date = String(fd.get("date") || "");
  const time = String(fd.get("time") || "");
  const type = DEVICE_TYPES.some((d) => d.key === fd.get("device_type")) ? String(fd.get("device_type")) : "otro";
  const slot = (await availableSlots(30)).find((d) => d.date === date);
  if (!name || phone.replace(/\D/g, "").length < 7 || !slot || !slot.times.includes(time)) redirect("/agendar?error=datos");
  (await dbx.run("INSERT INTO appointments (name, phone, email, device_type, model, problem, date, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", name, phone, String(fd.get("email") || "") || null, type, String(fd.get("model") || "") || null, String(fd.get("problem") || "") || null, date, time));
  redirect(`/agendar?ok=${encodeURIComponent(`${slot.label} a las ${time}`)}`);
}

export default async function Agendar({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await getSettings();
  const { ok, error } = await searchParams;
  if (s.booking_enabled !== "1") {
    return <main className="min-h-dvh grid place-items-center p-6 text-center"><p>Las citas en línea no están disponibles. Escríbenos por WhatsApp.</p></main>;
  }
  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-5">
      <div>
        <p className="font-bold tracking-tight text-[17px]">{s.shop_name}</p>
        <h1 className="text-[28px] font-bold tracking-tight">Agenda tu reparación</h1>
        <p className="text-muted">{s.shop_address} · {s.shop_hours}</p>
      </div>
      {ok ? (
        <div className="card p-6 space-y-2">
          <p className="text-xl font-bold">¡Listo! Te esperamos el {ok}.</p>
          <p className="text-muted">Trae tu equipo y, si puedes, una copia de seguridad hecha. Te confirmaremos por WhatsApp.</p>
        </div>
      ) : (
        <>
          {error && (
            <p className="rounded-xl bg-bad-soft text-bad font-medium px-4 py-3">
              {error === "limite" ? "Demasiadas solicitudes. Intenta más tarde." : "Revisa tus datos y elige una hora disponible."}
            </p>
          )}
          <BookingForm action={book} slots={await availableSlots()} types={DEVICE_TYPES.map((d) => ({ key: d.key, label: d.label, icon: d.icon }))} />
        </>
      )}
    </main>
  );
}
