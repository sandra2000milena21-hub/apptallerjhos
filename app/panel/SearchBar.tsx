"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ScanButton from "@/components/Scanner";

/** Búsqueda por orden, cliente, celular, IMEI o serial con estilo refinado. */
export default function SearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue ?? "");
  const go = (v: string) => router.push(v.trim() ? `/panel?q=${encodeURIComponent(v.trim())}` : "/panel");

  return (
    <form
      className="flex items-center gap-2 w-full sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
    >
      <div className="relative w-full sm:w-80">
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input pl-10 pr-4 rounded-full min-h-11 text-sm bg-[#0e1828]/90 border-white/[0.12] focus:border-blue-400 text-white placeholder:text-slate-500 shadow-inner"
          placeholder="Orden, cliente, IMEI o serial…"
          type="search"
        />
        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <ScanButton label="" onResult={(t) => { setQ(t); go(t); }} className="btn-ghost rounded-full min-h-11 w-11 p-0 flex items-center justify-center shrink-0 shadow-sm" />
      <button className="btn-primary rounded-full px-5 min-h-11 text-sm font-semibold shrink-0">Buscar</button>
    </form>
  );
}
