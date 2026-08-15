import { NextResponse } from 'next/server';
import {
  getExpiryIntelligenceSummary,
  listCanonicalEvents,
  listTraceabilityImports,
  listTraceabilityProductLinks,
  listTraceabilityReconciliations,
} from '@/lib/db/repositories/traceability';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const datasetId = url.searchParams.get('datasetId');

    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId is required' }, { status: 400 });
    }

    const [imports, eventsData, links, reconciliations, expiryData] = await Promise.all([
      listTraceabilityImports(datasetId),
      listCanonicalEvents(datasetId, { limit: 100 }),
      listTraceabilityProductLinks(datasetId),
      listTraceabilityReconciliations(datasetId),
      getExpiryIntelligenceSummary(datasetId),
    ]);

    return NextResponse.json({
      imports,
      events: eventsData.events,
      totalEventsCount: eventsData.totalCount,
      links,
      reconciliations,
      expirySummary: expiryData.summary,
      expiryItems: expiryData.items.slice(0, 50),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch traceability data';
    console.error('[api:traceability:get:error]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
