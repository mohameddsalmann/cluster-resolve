import { NextResponse } from 'next/server';
import { fetchEdaNotices } from '@cluster/core';
import {
  evaluateAndPersistExposures,
  upsertRegulatoryNotices,
} from '@/lib/db/repositories/regulatory';
import { listDatasets } from '@/lib/db/repositories/datasets';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const targetDatasetId = url.searchParams.get('datasetId');

    const { notices, source, retrievedAt } = await fetchEdaNotices({ allowLive: true });
    const persisted = await upsertRegulatoryNotices(notices);

    const datasets = await listDatasets();
    const datasetsToEvaluate = targetDatasetId
      ? datasets.filter((d) => d.id === targetDatasetId)
      : datasets;

    let totalEvaluated = 0;
    for (const d of datasetsToEvaluate) {
      try {
        await evaluateAndPersistExposures(d.id);
        totalEvaluated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[regulatory:sync] Could not evaluate dataset ${d.id}:`, msg);
      }
    }

    return NextResponse.json({
      success: true,
      source,
      retrievedAt,
      noticesCount: persisted.length,
      datasetsEvaluated: totalEvaluated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Regulatory synchronization failed';
    console.error('[regulatory:sync:error]', error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
