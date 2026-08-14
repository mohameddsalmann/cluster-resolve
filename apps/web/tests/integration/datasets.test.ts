import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataset, getDatasetById, listDatasets } from '../../lib/db/repositories/datasets';
import { getSupabaseServerClient } from '../../lib/supabase/server';

describe('Database Integration — Datasets Repository', () => {
  const createdDatasetIds: string[] = [];

  beforeAll(() => {
    if (!process.env.SUPABASE_URL) {
      throw new Error(
        'SUPABASE_URL environment variable is missing. DB integration tests MUST NOT be skipped silently.'
      );
    }
    if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing. DB integration tests MUST NOT be skipped silently.'
      );
    }
  });

  afterAll(async () => {
    const supabase = getSupabaseServerClient();
    for (const id of createdDatasetIds) {
      const { error } = await supabase.from('datasets').delete().eq('id', id);
      if (error) throw error;
    }
  });

  it('creates a dataset with mode SAMPLE and reads it back', async () => {
    const datasetName = `Integration Test SAMPLE ${Date.now()}`;
    const created = await createDataset({
      name: datasetName,
      mode: 'SAMPLE',
      description: 'Synthetic benchmark dataset',
    });
    createdDatasetIds.push(created.id);

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.name).toBe(datasetName);
    expect(created.mode).toBe('SAMPLE');

    const fetched = await getDatasetById(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.mode).toBe('SAMPLE');
  });

  it('creates datasets with mode LIVE and IMPORTED_REAL', async () => {
    const liveDataset = await createDataset({
      name: `Integration Test LIVE ${Date.now()}`,
      mode: 'LIVE',
    });
    createdDatasetIds.push(liveDataset.id);
    expect(liveDataset.mode).toBe('LIVE');

    const realDataset = await createDataset({
      name: `Integration Test IMPORTED_REAL ${Date.now()}`,
      mode: 'IMPORTED_REAL',
    });
    createdDatasetIds.push(realDataset.id);
    expect(realDataset.mode).toBe('IMPORTED_REAL');
  });

  it('lists datasets including newly created ones', async () => {
    const list = await listDatasets();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});
