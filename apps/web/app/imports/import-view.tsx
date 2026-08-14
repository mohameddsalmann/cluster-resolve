'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Gavel,
  Layers,
  UploadCloud,
  Download,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import { DataTable, type Column } from '@/components/cluster/DataTable';
import {
  ClusterButton,
  ClusterIconChip,
  CoverageMetric,
  DatasetModeChip,
  ErrorState,
  PageHeader,
  Panel,
  StatusChip,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';
import { cn } from '@/lib/utils';

type ImportKind = 'ORDERS' | 'OFFERS' | 'OUTCOMES' | 'DECISIONS';

interface ProcessResult {
  jobId: string;
  state: string;
  processedRows: number;
  acceptedRows: number;
  rejectedRows: number;
  error?: { code: string; message: string };
}

interface ErrorRow {
  row_number: number;
  field: string | null;
  code: string;
  message: string;
  raw_value: string | null;
}

const importTypes: { key: ImportKind; label: string; icon: LucideIcon; hint: string }[] = [
  { key: 'ORDERS', label: 'Orders', icon: ClipboardList, hint: 'Requested products and quantities' },
  { key: 'OFFERS', label: 'Offers', icon: Layers, hint: 'Supplier offers at decision time' },
  { key: 'OUTCOMES', label: 'Outcomes', icon: CheckCircle2, hint: 'What was actually delivered' },
  { key: 'DECISIONS', label: 'Decisions', icon: Gavel, hint: 'Selections made by the agent' },
];

const errorColumns: Column<ErrorRow>[] = [
  { key: 'row', header: 'Row', align: 'right', cell: (r) => r.row_number },
  { key: 'field', header: 'Field', cell: (r) => <span className="text-ink">{r.field ?? '—'}</span> },
  { key: 'code', header: 'Code', cell: (r) => <code className="text-[0.8125rem]">{r.code}</code> },
  { key: 'message', header: 'Message', cell: (r) => r.message },
  { key: 'raw', header: 'Raw Value', cell: (r) => <code className="text-[0.8125rem]">{r.raw_value ?? '—'}</code> },
];

export function ImportView() {
  const { datasets, activeDatasetId, setActiveDatasetId, activeDataset } = useDataset();
  const [kind, setKind] = useState<ImportKind>('ORDERS');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<string>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [quality, setQuality] = useState<Record<string, unknown> | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Load quality on dataset change
  useEffect(() => {
    if (!activeDatasetId) return;
    let isCancelled = false;

    fetch(`/api/datasets/${activeDatasetId}/quality`)
      .then((r) => r.json())
      .then((d) => {
        if (!isCancelled) setQuality(d.quality ?? null);
      })
      .catch(() => {
        if (!isCancelled) setQuality(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId]);

  async function handleUploadAndProcess(selectedFile: File) {
    if (!activeDatasetId) return;
    setFile(selectedFile);
    setResult(null);
    setErrors([]);
    setUploadProgress(0);
    setPhase('uploading');
    setStatusMessage('Initializing private signed upload...');

    try {
      // 1. Init signed upload
      const initRes = await fetch('/api/imports/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          datasetId: activeDatasetId,
          kind,
          filename: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type || 'text/csv',
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error?.message ?? 'Upload initialization failed.');
      }

      // 2. Direct PUT to Supabase Storage signed URL
      setStatusMessage('Uploading directly to private Supabase Storage...');
      await uploadSignedFile(initData.signedUrl, selectedFile, setUploadProgress);

      // 3. Process
      setPhase('processing');
      setStatusMessage('Validating records and persisting canonical rows...');
      const processRes = await fetch(`/api/imports/${initData.jobId}/process`, {
        method: 'POST',
      });
      const processed: ProcessResult = await processRes.json();
      setResult(processed);

      // 4. If rejected rows, fetch real row errors
      if (processed.rejectedRows > 0) {
        const errRes = await fetch(`/api/imports/${processed.jobId}/errors?limit=100`);
        const errData = await errRes.json();
        setErrors(errData.errors ?? []);
      }

      // 5. Refresh quality
      const qualityRes = await fetch(`/api/datasets/${activeDatasetId}/quality`);
      const qualityData = await qualityRes.json();
      setQuality(qualityData.quality ?? null);

      setPhase('complete');
      setStatusMessage(processed.state);
    } catch (err) {
      setPhase('error');
      setStatusMessage(err instanceof Error ? err.message : 'Import failed.');
    }
  }

  return (
    <AppShell>
      <TopContextBar
        title="Imports"
        subtitle={`Dataset, import type, file, processing, result · ${activeDataset?.name ?? ''}`}
      />
      <PageBody wide>
        <PageHeader
          title="Imports"
          subtitle="Bring procurement records in through real signed Supabase storage uploads, then see exactly what became evaluable."
        />

        <div className="space-y-6">
          {/* Dataset Selector */}
          <Panel title="Dataset" description="Imports are always scoped to a single dataset.">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_auto] sm:items-end">
              <div>
                <label htmlFor="dataset" className="cl-label mb-1.5 block">
                  Active dataset
                </label>
                <select
                  id="dataset"
                  className="cl-field"
                  value={activeDatasetId}
                  onChange={(e) => startTransition(() => setActiveDatasetId(e.target.value))}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.mode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex pb-2.5">
                {activeDataset ? (
                  <DatasetModeChip mode={activeDataset.mode} />
                ) : (
                  <DatasetModeChip mode="SAMPLE" />
                )}
              </div>
            </div>
          </Panel>

          {/* Import Type Selector */}
          <Panel
            title="Import type"
            description="Each type unlocks a different part of the procurement evaluation."
            action={
              <a
                href={`/templates/imports/${kind.toLowerCase()}.csv`}
                download
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-cluster-bright hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download canonical {kind.toLowerCase()}.csv template
              </a>
            }
          >
            <div
              role="radiogroup"
              aria-label="Import type"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {importTypes.map((t) => {
                const active = t.key === kind;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKind(t.key)}
                    className={cn(
                      'flex min-h-11 flex-col items-start gap-3 rounded-[12px] border p-4 text-left transition-colors duration-200 cursor-pointer',
                      active
                        ? 'border-cluster-bright bg-[rgba(15,110,255,0.04)]'
                        : 'border-line bg-white hover:border-cluster-bright'
                    )}
                  >
                    <ClusterIconChip icon={t.icon} size="compact" tone={active ? 'brand' : 'soft'} />
                    <div>
                      <p className="text-[1rem] font-semibold text-ink">{t.label}</p>
                      <p className="cl-meta">{t.hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* File Upload Dropzone */}
          <Panel title="File" description="CSV file matching the canonical schema specification.">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleUploadAndProcess(f);
              }}
              className={cn(
                'flex flex-col items-center gap-4 rounded-[12px] border-[1.5px] border-line bg-surface px-6 py-14 text-center transition-colors duration-200',
                dragging && 'border-cluster-bright bg-white'
              )}
            >
              <ClusterIconChip icon={UploadCloud} size="large" />
              <div>
                <p className="text-[1.125rem] font-semibold text-ink">
                  Drop your {kind.toLowerCase()} CSV file here
                </p>
                <p className="mt-1 text-[0.9375rem] text-body">
                  or choose a CSV file from your device for direct signed upload
                </p>
              </div>
              <ClusterButton
                size="sm"
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={phase === 'uploading' || phase === 'processing'}
              >
                Choose CSV file
              </ClusterButton>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Choose import file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadAndProcess(f);
                }}
              />
            </div>

            {file ? (
              <div className="mt-4 rounded-[12px] border border-line p-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                  <ClusterIconChip icon={FileSpreadsheet} size="compact" tone="soft" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">{file.name}</p>
                    <p className="cl-meta">
                      {Math.max(1, Math.round(file.size / 1024))} KB · {statusMessage}
                    </p>
                  </div>
                  <StatusChip
                    label={phase === 'complete' ? 'COMPLETE' : phase === 'error' ? 'ERROR' : phase.toUpperCase()}
                    tone={phase === 'complete' ? 'success' : phase === 'error' ? 'danger' : 'brand'}
                  />
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div
                    className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface"
                    role="progressbar"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                  >
                    <div
                      className="h-full rounded-full bg-cluster-bright transition-[width] duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </Panel>

          {/* Processing Result */}
          {result ? (
            <>
              <Panel
                title="Processing result"
                action={
                  <StatusChip
                    label={result.state}
                    tone={
                      result.state === 'COMPLETED'
                        ? 'success'
                        : result.state === 'PARTIAL_SUCCESS'
                          ? 'caution'
                          : 'danger'
                    }
                  />
                }
              >
                <dl className="grid gap-4 sm:grid-cols-3">
                  {[
                    ['Processed', String(result.processedRows)],
                    ['Accepted', String(result.acceptedRows)],
                    ['Rejected', String(result.rejectedRows)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[8px] bg-surface p-4">
                      <dt className="cl-meta">{k}</dt>
                      <dd className="mt-1 text-[1.5rem] font-bold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                {result.error && (
                  <p className="mt-3 text-sm text-danger">
                    {result.error.code}: {result.error.message}
                  </p>
                )}
              </Panel>

              {errors.length > 0 ? (
                <>
                  <ErrorState
                    title="Some rows were rejected during ingestion validation."
                    detail={`${errors.length} row error(s) detected. Valid rows were persisted.`}
                  />
                  <section aria-label="Row errors">
                    <h2 className="cl-card-title mb-3">Ingestion Row Errors</h2>
                    <DataTable
                      columns={errorColumns}
                      rows={errors}
                      rowKey={(r) => `${r.row_number}-${r.field}-${r.code}`}
                      caption="Rejected rows"
                    />
                  </section>
                </>
              ) : null}
            </>
          ) : phase === 'error' ? (
            <ErrorState
              title="Import operation failed"
              detail={statusMessage}
            />
          ) : null}

          {/* Real Data Quality Summary */}
          <section aria-label="Data quality">
            <h2 className="cl-section-title mb-4">Dataset Data Quality</h2>
            {quality ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <CoverageMetric
                  label="Orders ready for evaluation"
                  value={Number(quality.total_orders ?? 0)}
                  total={Number(quality.total_orders ?? 0)}
                  state={Number(quality.total_orders ?? 0) > 0 ? 'AVAILABLE' : 'INSUFFICIENT DATA'}
                />
                <CoverageMetric
                  label="Orders with recorded items"
                  value={Number(quality.orders_with_items ?? 0)}
                  total={Number(quality.total_orders ?? 0)}
                  state={
                    Number(quality.orders_with_items ?? 0) === Number(quality.total_orders ?? 0) &&
                    Number(quality.total_orders ?? 0) > 0
                      ? 'AVAILABLE'
                      : Number(quality.orders_with_items ?? 0) > 0
                        ? 'PARTIAL'
                        : 'INSUFFICIENT DATA'
                  }
                />
                <CoverageMetric
                  label="Orders with recorded outcomes"
                  value={Number(quality.orders_with_outcomes ?? 0)}
                  total={Number(quality.total_orders ?? 0)}
                  state={
                    Number(quality.orders_with_outcomes ?? 0) === Number(quality.total_orders ?? 0) &&
                    Number(quality.total_orders ?? 0) > 0
                      ? 'AVAILABLE'
                      : Number(quality.orders_with_outcomes ?? 0) > 0
                        ? 'PARTIAL'
                        : 'INSUFFICIENT DATA'
                  }
                />
                <CoverageMetric
                  label="Orders with supplier offers"
                  value={Number(quality.orders_with_offers ?? 0)}
                  total={Number(quality.total_orders ?? 0)}
                  state={
                    Number(quality.orders_with_offers ?? 0) === Number(quality.total_orders ?? 0) &&
                    Number(quality.total_orders ?? 0) > 0
                      ? 'AVAILABLE'
                      : Number(quality.orders_with_offers ?? 0) > 0
                        ? 'PARTIAL'
                        : 'INSUFFICIENT DATA'
                  }
                />
              </div>
            ) : (
              <Panel>
                <div className="flex items-center gap-3 text-body">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">Select an active dataset above to view data quality metrics.</p>
                </div>
              </Panel>
            )}
          </section>
        </div>
      </PageBody>
    </AppShell>
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
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded * 100) / event.total));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`Direct storage upload failed with status ${request.status}`));
      }
    };
    request.onerror = () => reject(new Error('Direct storage upload network error.'));
    request.send(body);
  });
}
