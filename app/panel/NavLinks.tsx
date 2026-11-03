"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1 text-[14px] font-semibold overflow-x-auto min-w-0 py-1 scrollbar-none">
      {links.map((l) => {
        const active = l.href === "/panel" ? path === "/panel" || path.startsWith("/panel/orden") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3.5 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
              active
                ? "bg-white/[0.14] text-white border border-white/20 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
