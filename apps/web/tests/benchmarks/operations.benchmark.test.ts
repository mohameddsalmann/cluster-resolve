import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../lib/db/generated-types';
import { createDataset } from '../../lib/db/repositories/datasets';
import { evaluateDatasetOperations } from '../../lib/operations/evaluate';
import { getSupabaseServerClient } from '../../lib/supabase/server';
import { cleanupPhase4Dataset, PHASE4_AS_OF } from '../fixtures/phase4-scenario';

type Tables = Database['public']['Tables'];

describe('hosted Phase 4 evaluation benchmark', () => {
  let datasetId = '';

  beforeAll(() => {
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is required for hosted benchmarks.');
    if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for hosted benchmarks.');
    }
  });

  afterAll(async () => {
    if (datasetId) await cleanupPhase4Dataset(datasetId);
  }, 180_000);

  it('evaluates 1,000 persisted supplier/order observations', async () => {
    const dataset = await createDataset({ name: 'Phase 4 1000 Observation Benchmark', mode: 'SAMPLE' });
    datasetId = dataset.id;
    const pharmacy = await insertOne('pharmacies', {
      dataset_id: dataset.id,
      external_pharmacy_id: 'P4-BENCH-PHARMACY',
      name: 'Benchmark Pharmacy',
    });
    const product = await insertOne('products', {
      dataset_id: dataset.id,
      external_product_id: 'P4-BENCH-PRODUCT',
      name: 'Benchmark Product',
      name_normalized: 'benchmark product',
    });
    const supplier = await insertOne('suppliers', {
      dataset_id: dataset.id,
      external_supplier_id: 'P4-BENCH-SUPPLIER',
      name: 'Benchmark Supplier',
      name_normalized: 'benchmark supplier',
    });
    const orders = await insertBatches('orders', Array.from({ length: 1_000 }, (_, index) => ({
      dataset_id: dataset.id,
      external_order_id: `P4-BENCH-${String(index + 1).padStart(4, '0')}`,
      pharmacy_id: pharmacy.id,
      status: 'IMPORTED',
      placed_at: index < 500 ? '2026-07-15T00:00:00.000Z' : '2026-08-05T00:00:00.000Z',
    })));
    await insertBatches('order_items', orders.map((order) => ({
      dataset_id: dataset.id,
      order_id: order.id,
      product_id: product.id,
      requested_qty: 10,
      unit: 'pack',
    })));
    await insertBatches('order_outcomes', orders.map((order) => ({
      dataset_id: dataset.id,
      order_id: order.id,
      supplier_id: supplier.id,
      product_id: product.id,
      filled_qty: 10,
      delivered_at: new Date(Date.parse(order.placed_at) + 720 * 60_000).toISOString(),
      cancelled: false,
      outcome_final: true,
    })));

    const beforeMemory = process.memoryUsage().rss;
    const result = await evaluateDatasetOperations(dataset.id, PHASE4_AS_OF);
    const afterMemory = process.memoryUsage().rss;
    console.info(`PHASE4_BENCHMARK ${JSON.stringify({
      observations: 1_000,
      ...result.timingsMs,
      rssBeforeBytes: beforeMemory,
      rssAfterBytes: afterMemory,
      rssDeltaBytes: afterMemory - beforeMemory,
    })}`);
    expect(result.observationsEvaluated).toBe(1_000);
    expect(result.suppliersEvaluated).toBe(1);
  }, 300_000);

  async function insertOne<T extends keyof Tables>(table: T, value: Tables[T]['Insert']): Promise<Tables[T]['Row']> {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from(table as never).insert(value as never).select('*').single();
    if (error) throw error;
    return data as unknown as Tables[T]['Row'];
  }

  async function insertBatches<T extends keyof Tables>(
    table: T,
    values: Array<Tables[T]['Insert']>
  ): Promise<Array<Tables[T]['Row']>> {
    const supabase = getSupabaseServerClient();
    const rows: Array<Tables[T]['Row']> = [];
    for (let index = 0; index < values.length; index += 400) {
      const { data, error } = await supabase.from(table as never).insert(values.slice(index, index + 400) as never).select('*');
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as Array<Tables[T]['Row']>));
    }
    return rows;
  }
});
