import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataset } from '../../lib/db/repositories/datasets';
import { getImportJob } from '../../lib/db/repositories/ingestion-jobs';
import { listIngestionErrors } from '../../lib/db/repositories/ingestion-errors';
import { getSupplierOfferByExternalId } from '../../lib/db/repositories/offers';
import { getDatasetQuality } from '../../lib/imports/quality';
import { initializeImport, processStoredImport } from '../../lib/imports/service';
import { IMPORT_BUCKET } from '../../lib/imports/storage';
import { getSupabaseServerClient } from '../../lib/supabase/server';
import type { ImportKind } from '@cluster/schemas/imports';

interface UploadedFixture {
  jobId: string;
  storagePath: string;
}

describe('Database Integration — Real Ingestion + Storage', () => {
  const datasetIds: string[] = [];
  const storagePaths = new Set<string>();
  let datasetId: string;
  let otherDatasetId: string;

  beforeAll(async () => {
    requireHostedEnvironment();
    const dataset = await createDataset({
      name: `Phase 3 Integration ${randomUUID()}`,
      mode: 'IMPORTED_REAL',
    });
    const other = await createDataset({
      name: `Phase 3 Cross Dataset ${randomUUID()}`,
      mode: 'SAMPLE',
    });
    datasetId = dataset.id;
    otherDatasetId = other.id;
    datasetIds.push(datasetId, otherDatasetId);
  }, 30_000);

  afterAll(async () => {
    const supabase = getSupabaseServerClient();
    if (storagePaths.size > 0) {
      const { error } = await supabase.storage.from(IMPORT_BUCKET).remove([...storagePaths]);
      if (error) throw error;
    }
    const childTables = [
      'ai_decision_candidates',
      'ai_decisions',
      'order_outcomes',
      'supplier_offers',
      'order_items',
      'orders',
      'products',
      'pharmacies',
      'suppliers',
      'ingestion_jobs',
      'data_sources',
    ] as const;
    for (const id of datasetIds) {
      for (const table of childTables) {
        const { error } = await supabase.from(table).delete().eq('dataset_id', id);
        if (error) throw error;
      }
      const { error } = await supabase.from('datasets').delete().eq('id', id);
      if (error) throw error;
    }
  }, 60_000);

  it('imports the coherent four-file scenario through unauthenticated signed uploads', async () => {
    for (const [kind, fixture] of [
      ['ORDERS', 'valid-orders.csv'],
      ['OFFERS', 'valid-offers.csv'],
      ['OUTCOMES', 'valid-outcomes.csv'],
      ['DECISIONS', 'valid-decisions.csv'],
    ] as const) {
      const uploaded = await uploadFixture(datasetId, kind, fixture);
      const result = await processStoredImport(uploaded.jobId);
      expect(result.state).toBe('SUCCESS');
    }

    const supabase = getSupabaseServerClient();
    const [products, pharmacies, suppliers, items, candidates] = await Promise.all([
      supabase.from('products').select('source_ingestion_job_id').eq('dataset_id', datasetId),
      supabase.from('pharmacies').select('source_ingestion_job_id').eq('dataset_id', datasetId),
      supabase.from('suppliers').select('source_ingestion_job_id').eq('dataset_id', datasetId),
      supabase.from('order_items').select('source_ingestion_job_id').eq('dataset_id', datasetId),
      supabase.from('ai_decision_candidates').select('id').eq('dataset_id', datasetId),
    ]) as Array<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
    for (const response of [products, pharmacies, suppliers, items]) {
      expect(response.error).toBeNull();
      expect(response.data?.every((row) => typeof row.source_ingestion_job_id === 'string')).toBe(true);
    }
    expect(candidates.data).toHaveLength(0);

    const offer = await getSupplierOfferByExternalId(datasetId, 'OFF-1001-A');
    expect(offer?.unit_price_minor).toBe(12_550n);
  }, 120_000);

  it('returns ALREADY_IMPORTED and removes the duplicate stored copy', async () => {
    const uploaded = await uploadFixture(datasetId, 'ORDERS', 'valid-orders.csv');
    const result = await processStoredImport(uploaded.jobId);
    expect(result.state).toBe('ALREADY_IMPORTED');
    expect(result.originalJobId).toBeDefined();
    expect(await getImportJob(uploaded.jobId)).toBeNull();
    storagePaths.delete(uploaded.storagePath);
  }, 60_000);

  it('persists row errors and completes mixed rows as PARTIAL_SUCCESS', async () => {
    const uploaded = await uploadFixture(datasetId, 'ORDERS', 'mixed-orders.csv');
    const result = await processStoredImport(uploaded.jobId);
    expect(result.state).toBe('PARTIAL_SUCCESS');
    expect(result.acceptedRows).toBe(1);
    expect(result.rejectedRows).toBe(2);
    const errors = await listIngestionErrors(uploaded.jobId, 0, 10);
    expect(errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['INVALID_QUANTITY', 'INVALID_TIMESTAMP'])
    );
  }, 60_000);

  it('accepts an identical duplicate record but rejects a conflicting duplicate', async () => {
    const identical = await uploadFixture(datasetId, 'OFFERS', 'duplicate-identical-offer.csv');
    expect((await processStoredImport(identical.jobId)).state).toBe('SUCCESS');

    const conflict = await uploadFixture(datasetId, 'OFFERS', 'duplicate-conflicting-offer.csv');
    const result = await processStoredImport(conflict.jobId);
    expect(result.state).toBe('PARTIAL_SUCCESS');
    const errors = await listIngestionErrors(conflict.jobId, 0, 10);
    expect(errors.some((error) => error.code === 'DUPLICATE_EXTERNAL_ID')).toBe(true);
  }, 60_000);

  it('fails all-invalid files while retaining actionable row evidence', async () => {
    for (const [kind, fixture, code] of [
      ['OUTCOMES', 'orphan-outcome.csv', 'UNKNOWN_ORDER'],
      ['OFFERS', 'invalid-money-offer.csv', 'INVALID_MONEY'],
      ['ORDERS', 'invalid-timestamp-order.csv', 'INVALID_TIMESTAMP'],
    ] as const) {
      const uploaded = await uploadFixture(datasetId, kind, fixture);
      const result = await processStoredImport(uploaded.jobId);
      expect(result.state).toBe('FAILED');
      expect(result.error?.code).toBe('NO_VALID_ROWS');
      const errors = await listIngestionErrors(uploaded.jobId, 0, 10);
      expect(errors.some((error) => error.code === code)).toBe(true);
    }
  }, 90_000);

  it('rejects a cross-dataset import reference and enforces provenance FKs', async () => {
    const uploaded = await uploadFixture(otherDatasetId, 'ORDERS', 'cross-dataset-order.csv');
    const result = await processStoredImport(uploaded.jobId);
    expect(result.state).toBe('FAILED');
    const errors = await listIngestionErrors(uploaded.jobId, 0, 10);
    expect(errors.some((error) => error.code === 'CROSS_DATASET_REFERENCE')).toBe(true);

    const sourceJob = await getSupabaseServerClient()
      .from('ingestion_jobs')
      .select('id')
      .eq('dataset_id', datasetId)
      .limit(1)
      .single();
    if (sourceJob.error) throw sourceJob.error;
    const { error } = await getSupabaseServerClient().from('products').insert({
      dataset_id: otherDatasetId,
      external_product_id: `CROSS-${randomUUID()}`,
      name: 'Cross provenance',
      name_normalized: 'cross provenance',
      source_ingestion_job_id: sourceJob.data.id,
    } as never);
    expect(error).not.toBeNull();
  }, 60_000);

  it('calculates quality from hosted canonical rows and ingestion errors', async () => {
    const quality = await getDatasetQuality(datasetId);
    expect(quality.rows.processed).toBeGreaterThan(0);
    expect(quality.rejectedReferences.attemptedOrphanOutcomes).toBeGreaterThan(0);
    expect(quality.coverage.ordersWithFinalOutcomes.denominator).toBeGreaterThan(0);
    expect(quality.coverage.decisionsWithComparativeOffers.state).toBe('PARTIAL');
    expect(quality.coverage.decisionsWithComparativeOffers.percentage).toBe('50.00');
  }, 60_000);

  async function uploadFixture(
    targetDatasetId: string,
    kind: ImportKind,
    filename: string
  ): Promise<UploadedFixture> {
    const bytes = await readFile(new URL(`../fixtures/imports/${filename}`, import.meta.url));
    const initialized = await initializeImport({
      datasetId: targetDatasetId,
      kind,
      filename,
      size: bytes.byteLength,
      contentType: 'text/csv',
    });
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', new Blob([bytes], { type: 'text/csv' }), filename);
    const response = await fetch(initialized.signedUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'false' },
      body,
    });
    if (!response.ok) throw new Error(`Signed Storage upload failed with HTTP ${response.status}.`);
    storagePaths.add(initialized.storagePath);
    return { jobId: initialized.jobId, storagePath: initialized.storagePath };
  }
});

function requireHostedEnvironment(): void {
  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required. Hosted DB tests MUST NOT skip silently.');
  }
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required. Hosted DB tests MUST NOT skip silently.');
  }
}
