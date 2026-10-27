import { connection } from 'next/server';

export default async function WatchlistPage() {
  await connection();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Seguimiento de precios</h1>
        <p className="mt-1 text-sm text-muted">Gestiona tus rutas en seguimiento.</p>
      </header>
      <p className="text-muted">Usa el boton Seguir ruta desde los resultados.</p>
    </div>
  );
}
