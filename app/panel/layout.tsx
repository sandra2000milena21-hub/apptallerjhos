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
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  const links = [
    ...(hasPermission(user, "orders_view") ? [{ href: "/panel", label: "Tablero" }] : []),
    ...(hasPermission(user, "caja_view") ? [{ href: "/panel/caja", label: "Caja" }] : []),
    ...(hasPermission(user, "inventory_view") ? [{ href: "/panel/inventario", label: "Inventario" }] : []),
    ...(hasPermission(user, "customers_view") ? [{ href: "/panel/clientes", label: "Clientes" }] : []),
    ...(hasPermission(user, "buybacks_view") ? [{ href: "/panel/retomas", label: "Retomas" }] : []),
    ...(hasPermission(user, "appointments_view") ? [{ href: "/panel/citas", label: "Citas" }] : []),
    ...(hasPermission(user, "reports_view") ? [{ href: "/panel/reportes", label: "Reportes" }] : []),
    ...(user.role === "admin" || hasPermission(user, "reports_view") || hasPermission(user, "orders_view") ? [{ href: "/panel/exportar", label: "Exportar Excel" }] : []),
    ...(user.role === "admin" || hasPermission(user, "settings_view") ? [{ href: "/panel/ajustes", label: "Ajustes" }] : []),
  ];

  const initial = user.name.charAt(0).toUpperCase();
  const shopName = settings.shop_name === "Mi Taller" || !settings.shop_name ? "Taller Jhos" : settings.shop_name;

  return (
    <div className="min-h-dvh flex flex-col">
      <header
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        className="no-print sticky top-0 z-30 bg-[#0b1320] border-b border-white/[0.08]"
      >
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
          <Link href="/panel" className="flex items-center gap-2.5 mr-1 group shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/20">
              ⚡
            </div>
            <span className="font-bold tracking-tight text-[16px] text-white truncate max-w-40 sm:max-w-56 group-hover:text-blue-300 transition-colors">
              {shopName}
            </span>
            <span className="hidden sm:inline text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded-md bg-white/[0.06] text-slate-400 border border-white/[0.08]">
              v7.0
            </span>
          </Link>

          {/* En pantallas anchas el menú va en la misma fila */}
          <div className="hidden xl:block min-w-0 flex-1">
            <NavLinks links={links} />
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {hasPermission(user, "orders_create") && (
              <Link href="/panel/nueva" className="btn-accent rounded-full px-4 min-h-10 text-sm">
                <span className="text-base leading-none">+</span> Recepción
              </Link>
            )}

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/[0.08]" title={user.name}>
              <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-xs font-bold text-white">
                {initial}
              </div>
              <span className="text-xs text-slate-300 font-medium truncate max-w-24">{user.name.split(" ")[0]}</span>
            </div>

            <form action={doLogout}>
              <button className="btn-ghost rounded-full px-3 min-h-10 text-xs text-slate-300" title={`Salir (${user.name})`}>
                Salir
              </button>
            </form>
          </div>
        </div>

        {/* En iPad y celular el menú ocupa su propia fila, deslizable, para que no se corte */}
        <div className="xl:hidden mx-auto max-w-7xl px-3 pb-1.5 border-t border-white/[0.05]">
          <NavLinks links={links} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-4 py-6 flex-1">{children}</main>
    </div>
  );
}
