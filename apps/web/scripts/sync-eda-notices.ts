import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

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

import { fetchEdaNotices } from '@cluster/core';
import { listDatasets } from '../lib/db/repositories/datasets';
import {
  evaluateAndPersistExposures,
  upsertRegulatoryNotices,
} from '../lib/db/repositories/regulatory';

async function main() {
  console.log('================================================================');
  console.log('  CLUSTER RESOLVE — Real Egyptian Drug Authority (EDA) Sync');
  console.log('================================================================');

  console.log('[eda:sync] Fetching official notices from edaegypt.gov.eg...');
  const { notices, source, retrievedAt } = await fetchEdaNotices({ allowLive: true, timeoutMs: 8000 });

  console.log(`[eda:sync] Retrieved ${notices.length} notices (Source: ${source}, Timestamp: ${retrievedAt})`);

  console.log('[eda:sync] Upserting notices into global database repository...');
  const persisted = await upsertRegulatoryNotices(notices);
  console.log(`[eda:sync] Persisted ${persisted.length} notices in regulatory_notices table.`);

  // List datasets to evaluate exposures
  const datasets = await listDatasets();
  console.log(`[eda:sync] Found ${datasets.length} datasets. Evaluating deterministic exposures...`);

  for (const dataset of datasets) {
    try {
      const summary = await evaluateAndPersistExposures(dataset.id);
      console.log(`  -> Dataset: ${dataset.name} (${dataset.mode})`);
      console.log(`     Exact Matches:    ${summary.exactMatchesCount}`);
      console.log(`     Possible Matches: ${summary.possibleMatchesCount}`);
      console.log(`     Unmatched:        ${summary.unmatchedCount}`);
      console.log(`     Affected Orders:  ${summary.totalAffectedOrders}`);
      console.log(`     Exposed Value:    ${(Number(summary.totalExposedValueMinor) / 100).toFixed(2)} EGP (${summary.totalExposedValueMinor} piastres)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`     [warning] Could not evaluate dataset ${dataset.id}: ${msg}`);
    }
  }

  console.log('================================================================');
  console.log('  EDA Regulatory Sync Complete.');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('[eda:sync:error]', err);
  process.exit(1);
});
