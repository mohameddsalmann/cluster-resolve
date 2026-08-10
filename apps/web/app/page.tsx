export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-brand-700">
          Cluster Control Tower
        </h1>
        <p className="mt-4 max-w-md text-text-secondary">
          An unofficial, candidate-built reliability/observability layer for pharmaceutical AI
          procurement decisions.
        </p>
      </div>
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-6 text-sm text-text-muted">
        Phase 1 — Repository foundation. Dashboard coming soon.
      </div>
    </main>
  );
}
