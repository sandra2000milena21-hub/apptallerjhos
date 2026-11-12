// Se muestra al instante al cambiar de sección, mientras el servidor prepara la página.
export default function PanelLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
      <div className="card p-4 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-10" />
        ))}
      </div>
    </div>
  );
}
