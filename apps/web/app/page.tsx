export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Cluster Control Tower
        </h1>
        <p className="mt-4 max-w-md text-slate-600">
          An unofficial, candidate-built reliability/observability layer for pharmaceutical AI
          procurement decisions.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Phase 1 — Repository foundation. Dashboard coming soon.
      </div>
      <a className="rounded bg-slate-900 px-4 py-2 text-sm text-white" href="/imports">
        Import procurement data
      </a>
    </main>
  );
}
