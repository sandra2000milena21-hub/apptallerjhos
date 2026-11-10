import Link from "next/link";
import { requireUser, logout, hasPermission } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { redirect } from "next/navigation";
import NavLinks from "./NavLinks";

async function doLogout() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const s = await getSettings();
  const links = [
    ...(hasPermission(user, "orders_view") ? [{ href: "/panel", label: "Tablero" }] : []),
    ...(hasPermission(user, "caja_view") ? [{ href: "/panel/caja", label: "Caja" }] : []),
    ...(hasPermission(user, "inventory_view") ? [{ href: "/panel/inventario", label: "Inventario" }] : []),
    ...(hasPermission(user, "customers_view") ? [{ href: "/panel/clientes", label: "Clientes" }] : []),
    ...(hasPermission(user, "buybacks_view") ? [{ href: "/panel/retomas", label: "Retomas" }] : []),
    ...(hasPermission(user, "appointments_view") ? [{ href: "/panel/citas", label: "Citas" }] : []),
    ...(hasPermission(user, "reports_view") ? [{ href: "/panel/reportes", label: "Reportes" }] : []),
    ...(user.role === "admin" || hasPermission(user, "settings_view") ? [{ href: "/panel/ajustes", label: "Ajustes" }] : []),
  ];

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh flex flex-col">
      <header
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        className="no-print sticky top-0 z-30 bg-[#0b1320]/95 backdrop-blur-md border-b border-white/[0.08] transform-gpu"
      >
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-3">
          <Link href="/panel" className="flex items-center gap-2.5 mr-2 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              ⚡
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-[16px] text-white truncate max-w-44 group-hover:text-blue-300 transition">
                {s.shop_name === "Mi Taller" || !s.shop_name ? "Taller Jhos" : s.shop_name}
              </span>
              <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                v6.0
              </span>
            </div>
          </Link>

          <NavLinks links={links} />

          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            {hasPermission(user, "orders_create") && (
              <Link
                href="/panel/nueva"
                className="btn-accent rounded-full px-4 h-10 text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 hover:scale-105 transition"
              >
                <span className="text-base font-bold">+</span> Recepción
              </Link>
            )}

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/[0.08]">
              <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-xs font-bold text-white" title={user.name}>
                {initial}
              </div>
              <span className="text-xs text-slate-300 font-medium truncate max-w-24">
                {user.name.split(" ")[0]}
              </span>
            </div>

            <form action={doLogout}>
              <button
                className="btn-ghost rounded-full px-3 h-9 text-xs text-slate-400 hover:text-white"
                title={`Salir (${user.name})`}
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-4 py-6 flex-1">{children}</main>
    </div>
  );
}
