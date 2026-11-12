"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Íconos de trazo (24x24) por sección: ayudan a ubicar cada módulo de un vistazo.
const ICONS: Record<string, string> = {
  "/panel": "M4 5h6v14H4zM14 5h6v8h-6z",
  "/panel/caja": "M3 7h18v12H3zM3 11h18M7 15h3",
  "/panel/inventario": "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  "/panel/clientes": "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.87M16 3.13a3.5 3.5 0 010 6.74",
  "/panel/retomas": "M4 9a8 8 0 0114-4l2 2M20 3v4h-4M20 15a8 8 0 01-14 4l-2-2M4 21v-4h4",
  "/panel/citas": "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4",
  "/panel/reportes": "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8",
  "/panel/exportar": "M12 3v12M7 10l5 5 5-5M4 20h16",
  "/panel/ajustes": "M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5",
};

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Secciones" className="flex items-center gap-1 text-[14px] font-semibold overflow-x-auto min-w-0 py-1 scrollbar-none touch-pan-x">
      {links.map((l) => {
        const active = l.href === "/panel" ? path === "/panel" || path.startsWith("/panel/orden") || path.startsWith("/panel/nueva") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full whitespace-nowrap border transition-colors duration-150 ${
              active
                ? "bg-blue-500/15 text-white border-blue-400/40"
                : "text-slate-400 border-transparent hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className={`w-4 h-4 shrink-0 ${active ? "text-blue-300" : "text-slate-500"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={ICONS[l.href] ?? "M5 12h14"} />
            </svg>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
