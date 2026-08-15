'use client';

import { useState, useRef, useEffect, useTransition, useMemo } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Gavel,
  Layers,
  UploadCloud,
  Download,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Check,
  AlertTriangle,
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
import {
  CANONICAL_FIELD_METADATA,
  generateMappedPreview,
  inferColumnMappings,
  validateColumnMapping,
  type ImportKind,
  type MappingConfidence,
  type SourceColumnMapping,
} from '@cluster/core/mapping';

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

function parseCsvClient(text: string): { headers: string[]; sampleRows: Array<{ rowNumber: number; values: Record<string, string> }> } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error('File is empty.');

  function splitLine(line: string): string[] {
    const res: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        res.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    res.push(current.trim());
    return res;
  }

  const headers = splitLine(lines[0]);
  const sampleRows: Array<{ rowNumber: number; values: Record<string, string> }> = [];

  for (let i = 1; i < Math.min(lines.length, 11); i++) {
    const cols = splitLine(lines[i]);
    const values: Record<string, string> = {};
    headers.forEach((h, idx) => {
      values[h] = cols[idx] ?? '';
    });
    sampleRows.push({ rowNumber: i + 1, values });
  }

  return { headers, sampleRows };
}

export function ImportView() {
  const { datasets, activeDatasetId, setActiveDatasetId, activeDataset } = useDataset();
  const [kind, setKind] = useState<ImportKind>('ORDERS');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'mapping' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [quality, setQuality] = useState<Record<string, unknown> | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Mapping state
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Array<{ rowNumber: number; values: Record<string, string> }>>([]);
  const [inferredMappings, setInferredMappings] = useState<SourceColumnMapping[]>([]);
  const [userMapping, setUserMapping] = useState<Record<string, string | null>>({});

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

  // Handle file selection and prepare mapping step
  async function handleFileSelected(selectedFile: File) {
    if (!activeDatasetId) return;
    setFile(selectedFile);
    setResult(null);
    setErrors([]);
    setUploadProgress(0);

    try {
      const text = await selectedFile.text();
      const { headers, sampleRows: samples } = parseCsvClient(text);

      const sampleValuesByHeader: Record<string, string[]> = {};
      headers.forEach((h) => {
        sampleValuesByHeader[h] = samples.map((s) => s.values[h]).filter(Boolean).slice(0, 3);
      });

      const inferred = inferColumnMappings(headers, kind, sampleValuesByHeader);
      const initialSpec: Record<string, string | null> = {};
      inferred.forEach((m) => {
        initialSpec[m.sourceHeader] = m.targetField;
      });

      setRawHeaders(headers);
      setSampleRows(samples);
      setInferredMappings(inferred);
      setUserMapping(initialSpec);
      setPhase('mapping');
      setStatusMessage('Review column mapping before ingestion.');
    } catch (err) {
      setPhase('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to parse CSV headers.');
    }
  }

  // Update a single column mapping
  function updateMapping(sourceHeader: string, targetField: string | null) {
    setUserMapping((prev) => ({
      ...prev,
      [sourceHeader]: targetField,
    }));
  }

  // Mapping validation and preview
  const mappingValidation = useMemo(() => {
    return validateColumnMapping(userMapping, kind);
  }, [userMapping, kind]);

  const mappedPreview = useMemo(() => {
    if (sampleRows.length === 0) return null;
    return generateMappedPreview(sampleRows, userMapping, kind);
  }, [sampleRows, userMapping, kind]);

  // Execute upload and ingestion with confirmed mapping
  async function handleConfirmAndIngest() {
    if (!file || !activeDatasetId || !mappingValidation.isValid) return;

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
          filename: file.name,
          size: file.size,
          contentType: file.type || 'text/csv',
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error?.message ?? 'Upload initialization failed.');
      }

      // 2. Direct PUT to Supabase Storage signed URL
      setStatusMessage('Uploading directly to private Supabase Storage...');
      await uploadSignedFile(initData.signedUrl, file, setUploadProgress);

      // 3. Process with mapping payload
      setPhase('processing');
      setStatusMessage('Validating records and persisting canonical rows...');
      const processRes = await fetch(`/api/imports/${initData.jobId}/process`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mapping: userMapping }),
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

  function resetImport() {
    setFile(null);
    setPhase('idle');
    setResult(null);
    setErrors([]);
    setRawHeaders([]);
    setSampleRows([]);
    setUserMapping({});
    setStatusMessage('');
  }

  const canonicalOptions = Object.entries(CANONICAL_FIELD_METADATA[kind]).map(([field, meta]) => {
    const m = meta as { required: boolean; description: string };
    return {
      field,
      label: `${field} ${m.required ? '*' : '(optional)'}`,
      required: m.required,
      description: m.description,
    };
  });

  return (
    <AppShell>
      <TopContextBar
        title="Imports"
        subtitle={`Dataset, flexible mapping, processing, verification · ${activeDataset?.name ?? ''}`}
      />
      <PageBody wide>
        <PageHeader
          title="Imports"
          subtitle="Bring procurement records in through flexible column mapping and real signed Supabase storage uploads."
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
                    disabled={phase === 'uploading' || phase === 'processing'}
                    onClick={() => {
                      setKind(t.key);
                      if (phase === 'mapping' && file) {
                        void handleFileSelected(file);
                      }
                    }}
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
          {phase === 'idle' || phase === 'error' ? (
            <Panel title="File" description="CSV file with canonical or non-canonical column headers.">
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
                  if (f) void handleFileSelected(f);
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
                    or choose a CSV file from your device to map columns and ingest
                  </p>
                </div>
                <ClusterButton
                  size="sm"
                  type="button"
                  onClick={() => inputRef.current?.click()}
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
                    if (f) void handleFileSelected(f);
                  }}
                />
              </div>

              {phase === 'error' && (
                <div className="mt-4">
                  <ErrorState
                    title="Import operation failed"
                    detail={statusMessage}
                  />
                </div>
              )}
            </Panel>
          ) : null}

          {/* Interactive Column Mapping Step */}
          {phase === 'mapping' && (
            <div className="space-y-6">
              <Panel
                title="Flexible Column Mapping"
                description={`Map your file's columns into Resolve's canonical ${kind} schema before ingestion.`}
                action={
                  <div className="flex items-center gap-2">
                    <StatusChip
                      label={`${mappingValidation.requiredMapped} / ${mappingValidation.requiredTotal} Required Fields`}
                      tone={mappingValidation.isValid ? 'success' : 'caution'}
                    />
                    <ClusterButton size="sm" variant="secondary" onClick={resetImport}>
                      Choose different file
                    </ClusterButton>
                  </div>
                }
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[8px] bg-surface p-4 border border-line">
                  <div className="flex items-center gap-3">
                    <ClusterIconChip icon={FileSpreadsheet} size="compact" tone="soft" />
                    <div>
                      <p className="text-sm font-semibold text-ink">{file?.name}</p>
                      <p className="cl-meta">{rawHeaders.length} columns detected · {sampleRows.length} sample rows inspected</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="text-body">
                      Mapped: <strong className="text-ink">{mappingValidation.mappedFieldsCount}</strong>
                    </span>
                    <span className="text-body">
                      Ignored: <strong className="text-ink">{mappingValidation.ignoredFieldsCount}</strong>
                    </span>
                    <span className="text-body">
                      Unmapped: <strong className="text-ink">{mappingValidation.unmappedFieldsCount}</strong>
                    </span>
                  </div>
                </div>

                {!mappingValidation.isValid && (
                  <div className="mb-4 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold">Mapping requires attention before ingestion:</p>
                      {mappingValidation.missingRequiredFields.length > 0 && (
                        <p className="mt-1">
                          Missing required canonical fields: <strong>{mappingValidation.missingRequiredFields.join(', ')}</strong>
                        </p>
                      )}
                      {mappingValidation.duplicateTargetFields.length > 0 && (
                        <p className="mt-1">
                          Duplicate mapped targets: <strong>{mappingValidation.duplicateTargetFields.join(', ')}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Mapping Table */}
                <div className="overflow-x-auto rounded-[8px] border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface border-b border-line text-xs font-semibold text-ink">
                      <tr>
                        <th className="py-3 px-4">Your Column</th>
                        <th className="py-3 px-2 text-center w-8"></th>
                        <th className="py-3 px-4">Resolve Canonical Field</th>
                        <th className="py-3 px-4">Confidence</th>
                        <th className="py-3 px-4">Sample Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                      {rawHeaders.map((header) => {
                        const inferred = inferredMappings.find((m) => m.sourceHeader === header);
                        const currentTarget = userMapping[header] ?? '';
                        const confidence: MappingConfidence = inferred?.confidence ?? 'UNMAPPED';
                        const sampleVals = inferred?.sampleValues ?? [];

                        return (
                          <tr key={header} className="hover:bg-surface/50">
                            <td className="py-3 px-4 font-mono font-medium text-ink">
                              {header}
                            </td>
                            <td className="py-3 px-2 text-center text-body">
                              <ArrowRight className="h-4 w-4 inline" />
                            </td>
                            <td className="py-3 px-4">
                              <select
                                className="cl-field py-1 text-xs max-w-xs"
                                value={currentTarget}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMapping(header, val === '__IGNORE__' ? null : val || null);
                                }}
                              >
                                <option value="">— Select Resolve field —</option>
                                <option value="__IGNORE__">❌ Ignore column (do not import)</option>
                                <optgroup label="Canonical Fields">
                                  {canonicalOptions.map((opt) => (
                                    <option key={opt.field} value={opt.field}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <ConfidenceChip confidence={currentTarget === null ? 'HIGH' : confidence} />
                            </td>
                            <td className="py-3 px-4 text-xs text-body font-mono truncate max-w-xs">
                              {sampleVals.length > 0 ? sampleVals.join(', ') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Normalized Live Preview */}
                {mappedPreview && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-ink mb-2">Live Normalized Preview</h3>
                    <p className="cl-meta mb-3">
                      Sample rows translated into Resolve schema using the selected mapping.
                    </p>
                    <div className="overflow-x-auto rounded-[8px] border border-line">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface border-b border-line font-semibold text-ink">
                          <tr>
                            <th className="py-2.5 px-3">Row</th>
                            <th className="py-2.5 px-3">Validation</th>
                            {Object.keys(CANONICAL_FIELD_METADATA[kind]).map((field) => (
                              <th key={field} className="py-2.5 px-3 whitespace-nowrap">
                                {field}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line bg-white font-mono">
                          {mappedPreview.previewRows.map((r) => (
                            <tr key={r.rowNumber} className={r.isValid ? '' : 'bg-red-50/50'}>
                              <td className="py-2 px-3 text-body">{r.rowNumber}</td>
                              <td className="py-2 px-3">
                                {r.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                    <Check className="h-3.5 w-3.5" /> Valid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-danger font-semibold" title={r.errors?.map((e) => e.message).join('; ')}>
                                    <AlertCircle className="h-3.5 w-3.5" /> Error
                                  </span>
                                )}
                              </td>
                              {Object.keys(CANONICAL_FIELD_METADATA[kind]).map((field) => (
                                <td key={field} className="py-2 px-3 text-ink truncate max-w-[160px]">
                                  {r.canonicalValues[field] ?? <span className="text-slate-300">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Final Action Bar */}
                <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <ClusterButton size="sm" variant="secondary" onClick={resetImport}>
                    Cancel
                  </ClusterButton>
                  <ClusterButton
                    size="sm"
                    onClick={() => void handleConfirmAndIngest()}
                    disabled={!mappingValidation.isValid}
                  >
                    Confirm Mapping & Ingest
                  </ClusterButton>
                </div>
              </Panel>
            </div>
          )}

          {/* Upload Progress & Active File Card */}
          {(phase === 'uploading' || phase === 'processing' || phase === 'complete') && file ? (
            <Panel title="Ingestion Status">
              <div className="rounded-[12px] border border-line p-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                  <ClusterIconChip icon={FileSpreadsheet} size="compact" tone="soft" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">{file.name}</p>
                    <p className="cl-meta">
                      {Math.max(1, Math.round(file.size / 1024))} KB · {statusMessage}
                    </p>
                  </div>
                  <StatusChip
                    label={phase === 'complete' ? 'COMPLETE' : phase === 'processing' ? 'PROCESSING' : 'UPLOADING'}
                    tone={phase === 'complete' ? 'success' : 'brand'}
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

              {phase === 'complete' && (
                <div className="mt-4 flex justify-end">
                  <ClusterButton size="sm" variant="secondary" onClick={resetImport}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Import another file
                  </ClusterButton>
                </div>
              )}
            </Panel>
          ) : null}

          {/* Processing Result */}
          {result ? (
            <>
              <Panel
                title="Processing result"
                action={
                  <StatusChip
                    label={result.state}
                    tone={
                      result.state === 'COMPLETED' || result.state === 'SUCCESS'
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

function ConfidenceChip({ confidence }: { confidence: MappingConfidence }) {
  if (confidence === 'HIGH') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-semibold bg-emerald-100 text-emerald-800">HIGH</span>;
  }
  if (confidence === 'MEDIUM') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-semibold bg-blue-100 text-blue-800">MEDIUM</span>;
  }
  if (confidence === 'NEEDS_REVIEW') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-semibold bg-amber-100 text-amber-800">NEEDS REVIEW</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-semibold bg-slate-100 text-slate-600">UNMAPPED</span>;
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
