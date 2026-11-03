import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { dbx, getSettings } from "@/lib/db";
import { last4 } from "@/lib/format";

export const metadata = { title: "Consulta tu reparación" };

// Límite simple de intentos por IP para evitar que adivinen órdenes.
const attempts = new Map<string, { n: number; since: number }>();

async function lookup(fd: FormData) {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && now - a.since < 15 * 60_000 && a.n >= 10) redirect("/seguimiento?error=limite");
  attempts.set(ip, a && now - a.since < 15 * 60_000 ? { n: a.n + 1, since: a.since } : { n: 1, since: now });

  const raw = String(fd.get("number") || "").trim().toUpperCase();
  const phone = String(fd.get("phone") || "").replace(/\D/g, "");
  const digits = raw.replace(/\D/g, "");
  if (!digits || phone.length !== 4) redirect("/seguimiento?error=1");
  const candidates = (await dbx.all(
    "SELECT o.token, o.number, c.phone FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.number LIKE ?",
    `%${digits.replace(/^0+/, "")}`
  )) as { token: string; number: string; phone: string }[];
  const match = candidates.find(
    (c) => last4(c.phone) === phone && c.number.replace(/\D/g, "").replace(/^0+/, "") === digits.replace(/^0+/, "")
  );
  if (!match) redirect("/seguimiento?error=1");
  redirect(`/s/${match.token}`);
}

export default async function Seguimiento({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const s = await getSettings();

  return (
    <main className="min-h-dvh grid place-items-center p-4 relative overflow-hidden">
      {/* Luces de fondo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />

      <form
        action={lookup}
        className="card w-full max-w-sm p-8 space-y-5 bg-[#142136]/90 backdrop-blur-xl border border-white/[0.1] rounded-3xl shadow-2xl relative z-10"
      >
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xl shadow-lg shadow-blue-500/20 mb-2">
            🔍
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.shop_name}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Consulta tu reparación</h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Ingresa los datos para ver el estado en vivo, fotos y cotización de tu equipo.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold px-4 py-3 text-center">
            {error === "limite" ? "Demasiados intentos. Espera unos minutos." : "No encontramos una orden con esos datos."}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label text-xs uppercase tracking-wider text-slate-300" htmlFor="number">
              Número de orden
            </label>
            <input
              className="input font-mono rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
              id="number"
              name="number"
              placeholder="R-1"
              required
              autoCapitalize="characters"
            />
          </div>

          <div>
            <label className="label text-xs uppercase tracking-wider text-slate-300" htmlFor="phone">
              Últimos 4 dígitos de tu celular
            </label>
            <input
              className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
              id="phone"
              name="phone"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              placeholder="4567"
              required
            />
          </div>
        </div>

        <button className="btn-accent w-full rounded-xl py-3 text-sm font-bold tracking-wide shadow-lg shadow-blue-600/30 hover:scale-[1.01] transition">
          Ver estado de mi equipo
        </button>

        <p className="text-center text-xs text-slate-400 pt-2">
          ¿Eres técnico o administrador?{" "}
          <a className="text-blue-400 font-semibold hover:underline" href="/login">
            Iniciar sesión
          </a>
        </p>
      </form>
    </main>
  );
}
