export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">No encontramos esta página</h1>
        <p className="text-muted mt-1">Revisa el enlace o consulta tu orden con su número.</p>
        <a href="/seguimiento" className="btn-primary mt-4">Consultar mi reparación</a>
      </div>
    </main>
  );
}
