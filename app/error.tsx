"use client";

import { useEffect } from "react";

// Pantalla de error general: si algo falla en el servidor, el usuario ve un mensaje claro y puede reintentar
// (en vez de una página en blanco). El detalle técnico queda en los registros del servidor.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-[60dvh] grid place-items-center p-6 text-center">
      <div className="card p-6 max-w-md space-y-3">
        <h1 className="text-xl font-bold">Algo no salió bien</h1>
        <p className="text-muted text-sm">
          No se pudo completar la acción. Vuelve a intentarlo; si sigue pasando, avísale al administrador
          {error.digest ? ` (código ${error.digest})` : ""}.
        </p>
        <div className="flex justify-center gap-2">
          <button className="btn-primary" onClick={() => reset()}>
            Reintentar
          </button>
          <a className="btn-ghost" href="/panel">
            Ir al tablero
          </a>
        </div>
      </div>
    </main>
  );
}
