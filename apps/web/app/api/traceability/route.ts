import { NextResponse } from 'next/server';
import {
  getExpiryIntelligenceSummary,
  getTraceabilityRepositoryStatus,
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

    const repositoryStatus = await getTraceabilityRepositoryStatus();
    if (!repositoryStatus.available) {
      return NextResponse.json({
        imports: [],
        events: [],
        totalEventsCount: 0,
        links: [],
        reconciliations: [],
        expirySummary: null,
        expiryItems: [],
        persistenceStatus: 'UNAVAILABLE',
        statusMessage: repositoryStatus.reason,
      });
    }

    const [imports, eventsData, links, reconciliations, expiryData] = await Promise.all([
      listTraceabilityImports(datasetId),
      listCanonicalEvents(datasetId, { limit: 100 }),
      listTraceabilityProductLinks(datasetId),
      listTraceabilityReconciliations(datasetId),
      getExpiryIntelligenceSummary(datasetId),
    ]);

    return NextResponse.json({
      imports: imports.map((item) => ({
        ...item,
        source_type: item.storage_path.startsWith('reference-test/')
          ? 'OFFICIAL_REFERENCE_TEST'
          : item.storage_path.startsWith('customer/')
            ? 'CUSTOMER'
            : 'TEST',
      })),
      events: eventsData.events,
      totalEventsCount: eventsData.totalCount,
      links,
      reconciliations,
      expirySummary: expiryData.summary,
      expiryItems: expiryData.items.slice(0, 50),
      persistenceStatus: 'AVAILABLE',
      statusMessage: 'Traceability imports and derived evidence are persisted in Supabase.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch traceability data';
    console.error('[api:traceability:get:error]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
