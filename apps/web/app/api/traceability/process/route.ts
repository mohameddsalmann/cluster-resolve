import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { runEpttsPreflight } from '@cluster/core';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  createTraceabilityImport,
  evaluateAndPersistReconciliations,
  getTraceabilityRepositoryStatus,
  persistCanonicalEvents,
} from '@/lib/db/repositories/traceability';
import { getDatasetById } from '@/lib/db/repositories/datasets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { datasetId, storagePath, filename, fileSizeBytes, format } = body;

    if (!datasetId || !storagePath) {
      return NextResponse.json(
        { error: 'Missing required parameters: datasetId and storagePath' },
        { status: 400 }
      );
    }

    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    const repositoryStatus = await getTraceabilityRepositoryStatus();
    if (!repositoryStatus.available) {
      return NextResponse.json({ error: repositoryStatus.reason }, { status: 503 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from('traceability-imports')
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: `Failed to download file from storage: ${error?.message || 'Empty file'}` },
        { status: 400 }
      );
    }
    const fileText = await data.text();

    const fileSha256 = createHash('sha256').update(fileText, 'utf8').digest('hex');
    const bytes = fileSizeBytes || Buffer.byteLength(fileText, 'utf8');

    // Run official preflight engine
    const { result, canonicalEvents } = runEpttsPreflight(fileText, format, filename);

    // Persist import and findings
    const { importRow, findings } = await createTraceabilityImport({
      datasetId,
      filename: filename || 'eptts_data.csv',
      format: result.format,
      storagePath,
      fileSha256,
      fileSizeBytes: bytes,
      result,
    });

    // If preflight passed, persist canonical events and re-evaluate reconciliation
    let persistedEventsCount = 0;
    if (result.status === 'PASS' && canonicalEvents.length > 0) {
      const events = await persistCanonicalEvents(datasetId, importRow.id, canonicalEvents);
      persistedEventsCount = events.length;
      await evaluateAndPersistReconciliations(datasetId);
    }

    return NextResponse.json({
      success: true,
      importId: importRow.id,
      preflight: {
        ...result,
        findings,
      },
      eventsCount: persistedEventsCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Traceability processing failed';
    console.error('[traceability:process:error]', error);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
