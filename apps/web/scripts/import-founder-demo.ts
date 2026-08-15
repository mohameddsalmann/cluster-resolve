import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const envLocalPath = resolve(__dirname, '../.env.local');
if (existsSync(envLocalPath)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envLocalPath);
    } else {
      const content = readFileSync(envLocalPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {
    // ignore
  }
}

import { getSupabaseServerClient } from '../lib/supabase/server';
import { createDataset, listDatasets } from '../lib/db/repositories/datasets';
import { initializeImport, processStoredImport } from '../lib/imports/service';
import { evaluateDatasetOperations } from '../lib/operations/evaluate';
import type { DatasetEvaluationSummary } from '../lib/operations/evaluate';
import { AS_OF_DATE } from './generate-founder-demo-data';

const ROOT_DIR = resolve(__dirname, '../../..');
const DATA_DIR = resolve(ROOT_DIR, 'data/founder-demo');
const FOUNDER_DATASET_NAME = 'Cluster Resolve · Founder Demo';
type ImportProfile = 'smoke' | 'medium' | 'full';
type ImportStage = 'orders' | 'offers' | 'decisions' | 'outcomes';
const STAGES: ImportStage[] = ['orders', 'offers', 'decisions', 'outcomes'];

interface FounderImportOptions {
  profile?: ImportProfile;
  from?: ImportStage;
}

export async function runFounderDemoImport(options: FounderImportOptions = {}): Promise<{
  datasetId: string;
  importTimings: Record<string, number>;
  evaluationSummary: DatasetEvaluationSummary;
  counts: Record<string, number>;
}> {
  console.log(`[founder:import] Starting real signed Storage import of Founder Demo dataset...`);
  const supabase = getSupabaseServerClient();
  const profile = options.profile ?? 'full';
  const from = options.from ?? 'orders';
  const datasetName = profile === 'full' ? FOUNDER_DATASET_NAME : `${FOUNDER_DATASET_NAME} · ${profile.toUpperCase()}`;

  // 1. Check or Create Dataset
  const existingDatasets = await listDatasets();
  let dataset = existingDatasets.find((d) => d.name === datasetName && d.mode === 'SAMPLE');

  if (!dataset) {
    if (from !== 'orders') throw new Error(`Cannot resume ${datasetName}: the dataset does not exist.`);
    console.log(`[founder:import] Creating dataset: ${datasetName}`);
    dataset = await createDataset({
      name: datasetName,
      mode: 'SAMPLE',
      description:
        'Large deterministic founder-demo dataset (10,000 orders, 200 public Egyptian medicines, 50 pharmacies, 30 suppliers, competing offers, AI decisions, execution outcomes).',
    });
  } else if (from === 'orders') {
    console.log(`[founder:import] Resetting previous ingestion state for clean import...`);
    await supabase.from('order_exceptions').delete().eq('dataset_id', dataset.id);
    await supabase.from('supplier_product_reliability_snapshots').delete().eq('dataset_id', dataset.id);
    await supabase.from('supplier_reliability_snapshots').delete().eq('dataset_id', dataset.id);
    await supabase.from('order_outcomes').delete().eq('dataset_id', dataset.id);
    await supabase.from('ai_decision_candidates').delete().eq('dataset_id', dataset.id);
    await supabase.from('ai_decisions').delete().eq('dataset_id', dataset.id);
    await supabase.from('supplier_offers').delete().eq('dataset_id', dataset.id);
    await supabase.from('order_items').delete().eq('dataset_id', dataset.id);
    await supabase.from('orders').delete().eq('dataset_id', dataset.id);
    await supabase.from('products').delete().eq('dataset_id', dataset.id);
    await supabase.from('suppliers').delete().eq('dataset_id', dataset.id);
    await supabase.from('pharmacies').delete().eq('dataset_id', dataset.id);
    const { data: existingJobs } = await supabase.from('ingestion_jobs').select('id').eq('dataset_id', dataset.id);
    const jobIds = (existingJobs ?? []).map((j) => j.id);
    if (jobIds.length > 0) {
      await supabase.from('ingestion_errors').delete().in('job_id', jobIds);
    }
    await supabase.from('ingestion_jobs').delete().eq('dataset_id', dataset.id);
    await supabase.from('data_sources').delete().eq('dataset_id', dataset.id);
  }
  const datasetId = dataset.id;
  console.log(`[founder:import] Using Dataset ID: ${datasetId}`);

  // 2. Read Generated CSV Files
  const ordersPath = resolve(DATA_DIR, 'orders.csv');
  const offersPath = resolve(DATA_DIR, 'offers.csv');
  const decisionsPath = resolve(DATA_DIR, 'decisions.csv');
  const outcomesPath = resolve(DATA_DIR, 'outcomes.csv');
  const manifestPath = resolve(DATA_DIR, 'founder-demo-manifest.json');

  if (!existsSync(ordersPath) || !existsSync(offersPath) || !existsSync(decisionsPath) || !existsSync(outcomesPath)) {
    throw new Error(`Generated CSV files missing in ${DATA_DIR}. Run pnpm demo:data:generate first.`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const buffers = loadProfileBuffers(profile, { ordersPath, offersPath, decisionsPath, outcomesPath });
  const importTimings: Record<string, number> = {};
  const startStage = STAGES.indexOf(from);

  // 3. Upload & Process Orders
  if (startStage <= 0) {
  console.log(`[founder:import] 1/4 Uploading and processing orders.csv...`);
  const ordersBuffer = buffers.orders;
  const ordersStart = performance.now();
  const ordersInit = await initializeImport({
    datasetId,
    kind: 'ORDERS',
    filename: 'orders.csv',
    size: ordersBuffer.byteLength,
    contentType: 'text/csv',
  });
  await uploadToSignedUrl(ordersInit.signedUrl, ordersBuffer);
  const ordersResult = await processStoredImport(ordersInit.jobId);
  importTimings.ordersMs = Math.round(performance.now() - ordersStart);
  console.log(`[founder:import] Orders complete: ${ordersResult.acceptedRows} accepted, state=${ordersResult.state} (${importTimings.ordersMs}ms)`);
  if (ordersResult.state === 'IN_PROGRESS' || ordersResult.state === 'FAILED' || (ordersResult.state === 'ALREADY_IMPORTED' && ordersResult.acceptedRows === 0)) {
    throw new Error(`Orders import failed with state: ${ordersResult.state}`);
  }
  } else {
    console.log(`[founder:import] 1/4 Orders preserved; resuming from ${from}.`);
  }

  // 4. Upload & Process Offers
  if (startStage <= 1) {
  console.log(`[founder:import] 2/4 Uploading and processing offers.csv...`);
  const offersBuffer = buffers.offers;
  const offersStart = performance.now();
  const offersInit = await initializeImport({
    datasetId,
    kind: 'OFFERS',
    filename: 'offers.csv',
    size: offersBuffer.byteLength,
    contentType: 'text/csv',
  });
  await uploadToSignedUrl(offersInit.signedUrl, offersBuffer);
  const offersResult = await processStoredImport(offersInit.jobId);
  importTimings.offersMs = Math.round(performance.now() - offersStart);
  console.log(`[founder:import] Offers complete: ${offersResult.acceptedRows} accepted, state=${offersResult.state} (${importTimings.offersMs}ms)`);
  if (offersResult.state === 'IN_PROGRESS' || offersResult.state === 'FAILED' || (offersResult.state === 'ALREADY_IMPORTED' && offersResult.acceptedRows === 0)) {
    throw new Error(`Offers import failed with state: ${offersResult.state}`);
  }
  }

  // 5. Upload & Process Decisions
  if (startStage <= 2) {
  console.log(`[founder:import] 3/4 Uploading and processing decisions.csv...`);
  const decisionsBuffer = buffers.decisions;
  const decisionsStart = performance.now();
  const decisionsInit = await initializeImport({
    datasetId,
    kind: 'DECISIONS',
    filename: 'decisions.csv',
    size: decisionsBuffer.byteLength,
    contentType: 'text/csv',
  });
  await uploadToSignedUrl(decisionsInit.signedUrl, decisionsBuffer);
  const decisionsResult = await processStoredImport(decisionsInit.jobId);
  importTimings.decisionsMs = Math.round(performance.now() - decisionsStart);
  console.log(`[founder:import] Decisions complete: ${decisionsResult.acceptedRows} accepted, state=${decisionsResult.state} (${importTimings.decisionsMs}ms)`);
  if (decisionsResult.state === 'IN_PROGRESS' || decisionsResult.state === 'FAILED' || (decisionsResult.state === 'ALREADY_IMPORTED' && decisionsResult.acceptedRows === 0)) {
    throw new Error(`Decisions import failed with state: ${decisionsResult.state}`);
  }
  }

  // 6. Upload & Process Outcomes
  if (startStage <= 3) {
  console.log(`[founder:import] 4/4 Uploading and processing outcomes.csv...`);
  const outcomesBuffer = buffers.outcomes;
  const outcomesStart = performance.now();
  const outcomesInit = await initializeImport({
    datasetId,
    kind: 'OUTCOMES',
    filename: 'outcomes.csv',
    size: outcomesBuffer.byteLength,
    contentType: 'text/csv',
  });
  await uploadToSignedUrl(outcomesInit.signedUrl, outcomesBuffer);
  const outcomesResult = await processStoredImport(outcomesInit.jobId);
  importTimings.outcomesMs = Math.round(performance.now() - outcomesStart);
  console.log(`[founder:import] Outcomes complete: ${outcomesResult.acceptedRows} accepted, state=${outcomesResult.state} (${importTimings.outcomesMs}ms)`);
  if (outcomesResult.state === 'IN_PROGRESS' || outcomesResult.state === 'FAILED' || (outcomesResult.state === 'ALREADY_IMPORTED' && outcomesResult.acceptedRows === 0)) {
    throw new Error(`Outcomes import failed with state: ${outcomesResult.state}`);
  }
  }

  // 7. Run Operational Evaluation
  console.log(`[founder:import] Executing operational evaluation pipeline (asOf: ${AS_OF_DATE})...`);
  const evalStart = performance.now();
  const evaluationSummary = await evaluateDatasetOperations(datasetId, AS_OF_DATE);
  importTimings.evaluationMs = Math.round(performance.now() - evalStart);
  console.log(`[founder:import] Evaluation complete in ${importTimings.evaluationMs}ms!`);
  console.log(`[founder:import] Suppliers by status:`, evaluationSummary.suppliersByStatus);
  console.log(`[founder:import] Exceptions persisted: ${evaluationSummary.exceptionsPersisted}`);

  // 8. Verify Persisted Database Counts
  const [
    { count: orderCount },
    { count: offerCount },
    { count: decisionCount },
    { count: outcomeCount },
    { count: supplierCount },
    { count: pharmacyCount },
    { count: productCount },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId),
    supabase.from('supplier_offers').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId),
    supabase.from('ai_decisions').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId),
    supabase.from('order_outcomes').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId),
    supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId),
    supabase.from('pharmacies').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId),
  ]);

  const counts = {
    persistedOrders: orderCount ?? 0,
    persistedOffers: offerCount ?? 0,
    persistedDecisions: decisionCount ?? 0,
    persistedOutcomes: outcomeCount ?? 0,
    persistedSuppliers: supplierCount ?? 0,
    persistedPharmacies: pharmacyCount ?? 0,
    persistedProducts: productCount ?? 0,
  };

  console.log(`[founder:import] Persisted Counts:`, counts);
  console.log(`[founder:import] Manifest Counts:`, manifest.counts);

  return {
    datasetId,
    importTimings,
    evaluationSummary,
    counts,
  };
}

function loadProfileBuffers(
  profile: ImportProfile,
  paths: { ordersPath: string; offersPath: string; decisionsPath: string; outcomesPath: string }
): Record<ImportStage, Buffer> {
  const full = {
    orders: readFileSync(paths.ordersPath),
    offers: readFileSync(paths.offersPath),
    decisions: readFileSync(paths.decisionsPath),
    outcomes: readFileSync(paths.outcomesPath),
  };
  const orderLimit = profile === 'smoke' ? 100 : profile === 'medium' ? 2_000 : null;
  if (orderLimit === null) return full;

  const orderRecords = parse(full.orders, { bom: true, skip_empty_lines: true }) as string[][];
  const selectedOrderIds = new Set<string>();
  for (const row of orderRecords.slice(1)) {
    if (selectedOrderIds.size >= orderLimit && !selectedOrderIds.has(row[0])) break;
    selectedOrderIds.add(row[0]);
  }

  const namespace = profile === 'smoke' ? 'SMK' : 'MED';
  return {
    orders: profileCsv(orderRecords.filter((row, index) => index === 0 || selectedOrderIds.has(row[0])), namespace),
    offers: filterCsv(full.offers, selectedOrderIds, namespace),
    decisions: filterCsv(full.decisions, selectedOrderIds, namespace),
    outcomes: filterCsv(full.outcomes, selectedOrderIds, namespace),
  };
}

function filterCsv(input: Buffer, orderIds: Set<string>, namespace: string): Buffer {
  const records = parse(input, { bom: true, skip_empty_lines: true }) as string[][];
  const orderColumn = records[0].indexOf('order_id');
  return profileCsv(records.filter((row, index) => index === 0 || orderIds.has(row[orderColumn])), namespace);
}

function profileCsv(records: string[][], namespace: string): Buffer {
  const identifierColumns = new Set([
    'order_id',
    'pharmacy_id',
    'product_id',
    'supplier_id',
    'selected_supplier_id',
    'offer_id',
    'decision_id',
  ]);
  const columns = records[0]
    .map((header, index) => identifierColumns.has(header) ? index : -1)
    .filter((index) => index >= 0);
  return csvBuffer(records.map((row, rowIndex) =>
    rowIndex === 0 ? row : row.map((value, index) => columns.includes(index) ? `${namespace}-${value}` : value)
  ));
}

function csvBuffer(records: string[][]): Buffer {
  const text = records
    .map((row) => row.map((value) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(','))
    .join('\n');
  return Buffer.from(text, 'utf8');
}

async function uploadToSignedUrl(signedUrl: string, buffer: Buffer): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/csv',
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to upload to signed storage URL: ${res.status} ${res.statusText} — ${errorText}`);
  }
}

if (process.argv[1]?.includes('import-founder-demo')) {
  const profileArg = process.argv.find((value) => value.startsWith('--profile='))?.split('=')[1] ?? 'full';
  const fromArg = process.argv.find((value) => value.startsWith('--from='))?.split('=')[1] ?? 'orders';
  if (!['smoke', 'medium', 'full'].includes(profileArg) || !STAGES.includes(fromArg as ImportStage)) {
    console.error('Usage: import-founder-demo [--profile=smoke|medium|full] [--from=orders|offers|decisions|outcomes]');
    process.exit(1);
  }
  runFounderDemoImport({ profile: profileArg as ImportProfile, from: fromArg as ImportStage })
    .then((res) => {
      console.log(`[founder:import] SUCCESS! Dataset ID: ${res.datasetId}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[founder:import] FAILED:', err);
      process.exit(1);
    });
}
