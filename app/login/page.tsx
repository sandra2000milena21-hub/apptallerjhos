import { redirect } from "next/navigation";
import { login, currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";

export const metadata = { title: "Ingresar" };

async function doLogin(formData: FormData) {
  "use server";
  const ok = await login(String(formData.get("email") || ""), String(formData.get("password") || ""));
  if (!ok) redirect("/login?error=1");
  redirect("/panel");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/panel");
  const { error } = await searchParams;
  const s = await getSettings();

  return (
    <main className="min-h-dvh grid place-items-center p-4 relative overflow-hidden">
      {/* Luces ambientales de fondo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <form
        action={doLogin}
        className="card w-full max-w-sm p-8 space-y-5 bg-[#142136]/90 backdrop-blur-xl border border-white/[0.1] rounded-3xl shadow-2xl relative z-10"
      >
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-blue-500/25 mb-3">
            ⚡
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{s.shop_name}</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sistema de Gestión & Taller</p>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold px-4 py-3 text-center">
            Correo o contraseña incorrectos.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label text-xs uppercase tracking-wider text-slate-300" htmlFor="email">
              Correo Electrónico
            </label>
            <input
              className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-500/20"
              id="email"
              name="email"
              type="email"
              placeholder="admin@mitaller.co"
              autoComplete="username"
              required
              autoCapitalize="none"
            />
          </div>

          <div>
            <label className="label text-xs uppercase tracking-wider text-slate-300" htmlFor="password">
              Contraseña
            </label>
            <input
              className="input rounded-xl bg-[#0d1726] border-white/10 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-500/20"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <button className="btn-accent w-full rounded-xl py-3 text-sm font-bold tracking-wide shadow-lg shadow-blue-600/30 hover:scale-[1.01] transition">
          Ingresar al Panel
        </button>

        <div className="pt-2 text-center">
          <a
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 rounded-full border border-white/[0.06]"
            href="/seguimiento"
          >
            <span>🔍 ¿Eres cliente?</span>
            <span className="text-blue-400">Consulta tu orden</span>
          </a>
        </div>
      </form>
    </main>
  );
}
