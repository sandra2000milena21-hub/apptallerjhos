"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Combobox personalizado que reemplaza el buggy <datalist> nativo de HTML.
 * Se posiciona SIEMPRE anclado exactamente debajo del input (en la flecha),
 * con esquinas redondeadas, soporte táctil para iPad, filtrado en tiempo real
 * y estilo visual integrado al tema oscuro.
 */
export default function Combobox({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  autoCapitalize,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  autoCapitalize?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar si cambia el valor externamente (ej. autocompletado con IA o cambio de tipo)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Si el texto escrito coincide exactamente con la opción seleccionada o está vacío, mostrar todas las opciones
  const isExactMatch = value.trim() && query.trim().toLowerCase() === value.trim().toLowerCase();
  const filtered = query.trim() && !isExactMatch
    ? options.filter((opt) => opt.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function handleSelect(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  }

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        inputRef.current?.focus();
      }
      return next;
    });
  }

  return (
    <div ref={containerRef} className={`relative w-full ${open ? "z-40" : ""}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChange(val);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoCapitalize={autoCapitalize}
          className={`input pr-10 ${className}`}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={handleToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition cursor-pointer"
          aria-label="Abrir opciones"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180 text-blue-400" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && filtered.length > 0 && (
        <ul
          className="absolute top-full left-0 z-50 mt-1.5 w-full rounded-2xl border border-white/[0.15] bg-[#142136] shadow-2xl max-h-60 overflow-y-auto divide-y divide-white/[0.05] p-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ transform: "none" }}
        >
          {filtered.map((opt) => {
            const isSelected = opt.toLowerCase() === value.toLowerCase();
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-slate-200 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <span>{opt}</span>
                  {isSelected && <span className="text-white text-xs">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
