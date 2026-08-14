import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataset } from '../../lib/db/repositories/datasets';
import { initializeImport, processStoredImport } from '../../lib/imports/service';
import { getDatasetQuality } from '../../lib/imports/quality';
import { IMPORT_BUCKET } from '../../lib/imports/storage';
import { getSupabaseServerClient } from '../../lib/supabase/server';

describe('hosted ingestion benchmark', () => {
  const datasetIds: string[] = [];
  const storagePaths: string[] = [];

  beforeAll(() => {
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is required for hosted benchmarks.');
    if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for hosted benchmarks.');
    }
  });

  afterAll(async () => {
    const supabase = getSupabaseServerClient();
    if (storagePaths.length) await supabase.storage.from(IMPORT_BUCKET).remove(storagePaths);
    for (const datasetId of datasetIds) {
      for (const table of [
        'order_items', 'orders', 'products', 'pharmacies', 'ingestion_jobs', 'data_sources',
      ] as const) {
        const { error } = await supabase.from(table).delete().eq('dataset_id', datasetId);
        if (error) throw error;
      }
      const { error } = await supabase.from('datasets').delete().eq('id', datasetId);
      if (error) throw error;
    }
  }, 120_000);

  for (const rowCount of process.env.RUN_25K_BENCHMARK === '1' ? [1_000, 10_000, 25_000] : [1_000, 10_000]) {
    it(`imports ${rowCount.toLocaleString()} deterministic order rows`, async () => {
      const dataset = await createDataset({
        name: `Phase 3 Benchmark ${rowCount} ${randomUUID()}`,
        mode: 'SAMPLE',
      });
      datasetIds.push(dataset.id);
      const csv = buildOrdersCsv(rowCount);
      const bytes = new TextEncoder().encode(csv);
      const initialized = await initializeImport({
        datasetId: dataset.id,
        kind: 'ORDERS',
        filename: `benchmark-${rowCount}.csv`,
        size: bytes.byteLength,
        contentType: 'text/csv',
      });
      storagePaths.push(initialized.storagePath);

      const uploadStarted = performance.now();
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', new Blob([bytes], { type: 'text/csv' }), `benchmark-${rowCount}.csv`);
      const upload = await fetch(initialized.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body,
      });
      expect(upload.ok).toBe(true);
      const uploadMs = roundMs(performance.now() - uploadStarted);
      const beforeMemory = process.memoryUsage().rss;
      const result = await processStoredImport(initialized.jobId);
      const afterMemory = process.memoryUsage().rss;
      const qualityStarted = performance.now();
      await getDatasetQuality(dataset.id);
      const qualityMs = roundMs(performance.now() - qualityStarted);

      const evidence = {
        rows: rowCount,
        fileBytes: bytes.byteLength,
        storageUploadMs: uploadMs,
        ...result.timingsMs,
        qualityMs,
        rssBeforeBytes: beforeMemory,
        rssAfterBytes: afterMemory,
        rssDeltaBytes: afterMemory - beforeMemory,
      };
      console.info(`PHASE3_BENCHMARK ${JSON.stringify(evidence)}`);
      expect(result.state).toBe('SUCCESS');
      expect(result.acceptedRows).toBe(rowCount);
    }, 900_000);
  }
});

function buildOrdersCsv(rows: number): string {
  const header = 'order_id,pharmacy_id,pharmacy_name,placed_at,product_id,product_name,manufacturer,requested_qty,unit';
  const values = Array.from({ length: rows }, (_, index) => {
    const id = String(index + 1).padStart(6, '0');
    return `BENCH-ORD-${id},BENCH-PHARM,Benchmark Pharmacy,2026-08-14T10:30:00Z,BENCH-PROD,Benchmark Product,Resolve Pharma,1,pack`;
  });
  return [header, ...values].join('\n');
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}
