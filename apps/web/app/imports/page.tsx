import Link from 'next/link';
import { listDatasets } from '@/lib/db/repositories/datasets';
import { ImportForm } from './import-form';

export const dynamic = 'force-dynamic';

export default async function ImportsPage() {
  const datasets = await listDatasets();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="mb-8">
        <Link className="text-sm text-slate-600 underline" href="/">Home</Link>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Procurement data import</h1>
        <p className="mt-2 text-slate-600">
          Upload a canonical CSV directly to private Supabase Storage, then validate and persist it.
        </p>
      </div>
      <ImportForm datasets={datasets.map(({ id, name, mode }) => ({ id, name, mode }))} />
    </main>
  );
}
