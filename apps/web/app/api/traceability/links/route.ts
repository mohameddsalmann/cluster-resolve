import { NextResponse } from 'next/server';
import {
  evaluateAndPersistReconciliations,
  listTraceabilityProductLinks,
  upsertTraceabilityProductLink,
} from '@/lib/db/repositories/traceability';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const datasetId = url.searchParams.get('datasetId');
    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId is required' }, { status: 400 });
    }

    const links = await listTraceabilityProductLinks(datasetId);
    return NextResponse.json({ links });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve links';
    console.error('[traceability:links:get:error]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { datasetId, productId, gtin, status, reason } = body;

    if (!datasetId || !productId || !gtin) {
      return NextResponse.json(
        { error: 'datasetId, productId, and gtin are required' },
        { status: 400 }
      );
    }

    const link = await upsertTraceabilityProductLink(
      datasetId,
      productId,
      gtin,
      status || 'CONFIRMED',
      reason || 'User confirmed link'
    );

    // Re-evaluate reconciliations with updated confirmed linkage
    await evaluateAndPersistReconciliations(datasetId);

    return NextResponse.json({ success: true, link });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update link';
    console.error('[traceability:links:post:error]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
