'use client';

import { useMemo, useState } from 'react';

type ImportKind = 'ORDERS' | 'OFFERS' | 'OUTCOMES' | 'DECISIONS';
type DatasetOption = { id: string; name: string; mode: string };
type ProcessResult = {
  jobId: string;
  state: string;
  processedRows: number;
  acceptedRows: number;
  rejectedRows: number;
  error?: { code: string; message: string };
};

const KINDS: ImportKind[] = ['ORDERS', 'OFFERS', 'OUTCOMES', 'DECISIONS'];

export function ImportForm({ datasets }: { datasets: DatasetOption[] }) {
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? '');
  const [kind, setKind] = useState<ImportKind>('ORDERS');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Ready');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errors, setErrors] = useState<Array<Record<string, unknown>>>([]);
  const [quality, setQuality] = useState<Record<string, unknown> | null>(null);
  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === datasetId),
    [datasetId, datasets]
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !datasetId) return;
    setResult(null);
    setErrors([]);
    setQuality(null);
    setProgress(0);
    setPhase('Initializing private upload');

    try {
      const initResponse = await fetch('/api/imports/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          kind,
          filename: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      const init = await initResponse.json();
      if (!initResponse.ok) throw new Error(init.error?.message ?? 'Upload initialization failed.');

      setPhase('Uploading directly to private Supabase Storage');
      await uploadSignedFile(init.signedUrl, file, setProgress);
      setPhase('Validating and persisting canonical rows');
      const processResponse = await fetch(`/api/imports/${init.jobId}/process`, { method: 'POST' });
      const processed = await processResponse.json() as ProcessResult;
      setResult(processed);
      if (processed.rejectedRows > 0) {
        const errorResponse = await fetch(`/api/imports/${processed.jobId}/errors?limit=100`);
        const errorBody = await errorResponse.json();
        setErrors(errorBody.errors ?? []);
      }
      const qualityResponse = await fetch(`/api/datasets/${datasetId}/quality`);
      const qualityBody = await qualityResponse.json();
      setQuality(qualityBody.quality ?? null);
      setPhase(processed.state);
    } catch (error) {
      setPhase(error instanceof Error ? error.message : 'Import failed.');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={submit} className="space-y-5 rounded-lg border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-800">
          Dataset
          <select className="mt-1 w-full rounded border border-slate-300 p-2" value={datasetId} onChange={(event) => setDatasetId(event.target.value)} required>
            {datasets.map((dataset) => <option value={dataset.id} key={dataset.id}>{dataset.name} — {dataset.mode}</option>)}
          </select>
        </label>
        {selectedDataset && <p className="text-sm text-slate-500">Mode: {selectedDataset.mode}</p>}
        <label className="block text-sm font-medium text-slate-800">
          Import type
          <select className="mt-1 w-full rounded border border-slate-300 p-2" value={kind} onChange={(event) => setKind(event.target.value as ImportKind)}>
            {KINDS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <a className="inline-block text-sm text-blue-700 underline" href={`/templates/imports/${kind.toLowerCase()}.csv`} download>
          Download canonical {kind.toLowerCase()} template
        </a>
        <label className="block text-sm font-medium text-slate-800">
          CSV file
          <input className="mt-1 block w-full text-sm" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
        </label>
        <button disabled={!file || !datasetId} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40" type="submit">Upload and process</button>
        <div aria-live="polite" className="text-sm text-slate-600">
          <p>{phase}</p>
          {progress > 0 && progress < 100 && <progress className="mt-2 w-full" value={progress} max={100}>{progress}%</progress>}
        </div>
      </form>

      <section className="space-y-5">
        {result && <div className="rounded-lg border border-slate-200 p-5">
          <h2 className="font-semibold">Import result: {result.state}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div><dt>Processed</dt><dd className="text-xl font-semibold">{result.processedRows}</dd></div>
            <div><dt>Accepted</dt><dd className="text-xl font-semibold">{result.acceptedRows}</dd></div>
            <div><dt>Rejected</dt><dd className="text-xl font-semibold">{result.rejectedRows}</dd></div>
          </dl>
          {result.error && <p className="mt-3 text-sm text-red-700">{result.error.code}: {result.error.message}</p>}
        </div>}
        {errors.length > 0 && <div className="rounded-lg border border-slate-200 p-5">
          <h2 className="font-semibold">Row errors</h2>
          <div className="mt-3 max-h-72 overflow-auto text-sm">
            {errors.map((error, index) => <p className="border-t py-2 first:border-0" key={index}>
              Row {String(error.row_number)} · {String(error.field ?? 'row')} · {String(error.code)}<br />
              <span className="text-slate-600">{String(error.message)}</span>
            </p>)}
          </div>
        </div>}
        {quality && <div className="rounded-lg border border-slate-200 p-5">
          <h2 className="font-semibold">Dataset quality</h2>
          <pre className="mt-3 overflow-auto text-xs text-slate-600">{JSON.stringify(quality, null, 2)}</pre>
        </div>}
      </section>
    </div>
  );
}

function uploadSignedFile(
  signedUrl: string,
  file: File,
  setProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    const request = new XMLHttpRequest();
    request.open('PUT', signedUrl);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded * 100) / event.total));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error('Direct Storage upload failed.'));
    request.onerror = () => reject(new Error('Direct Storage upload failed.'));
    request.send(body);
  });
}
