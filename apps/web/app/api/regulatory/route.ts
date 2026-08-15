import { NextResponse } from 'next/server';
import {
  listRegulatoryExposures,
  listRegulatoryNotices,
} from '@/lib/db/repositories/regulatory';
import type { RegulatoryExposureRow, RegulatoryNoticeRow } from '@/lib/db/row-types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const datasetId = url.searchParams.get('datasetId');
    const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!, 10) : undefined;
    const noticeType = url.searchParams.get('noticeType') || undefined;
    const recallClass = url.searchParams.get('recallClass') || undefined;
    const search = url.searchParams.get('search') || undefined;

    // 1. Fetch global notices
    const { notices, totalCount } = await listRegulatoryNotices({
      year,
      noticeType,
      recallClass,
      search,
    });

    // 2. Fetch dataset exposures if datasetId provided
    let exposures: Array<RegulatoryExposureRow & { notice: RegulatoryNoticeRow }> = [];
    if (datasetId) {
      exposures = await listRegulatoryExposures(datasetId);
    }

    // Exposure map by notice ID
    const exposureByNoticeId = new Map<string, RegulatoryExposureRow>();
    let exactCount = 0;
    let possibleCount = 0;
    let totalAffectedOrders = 0;
    let totalExposedMinor = 0n;

    for (const exp of exposures) {
      exposureByNoticeId.set(exp.notice_id, exp);
      if (exp.match_status === 'EXACT') exactCount++;
      if (exp.match_status === 'POSSIBLE') possibleCount++;
      totalAffectedOrders += exp.affected_orders_count || 0;
      totalExposedMinor += BigInt(exp.historical_value_minor?.toString() || '0');
    }

    return NextResponse.json({
      notices: notices.map((n) => ({
        ...n,
        exposure: exposureByNoticeId.get(n.id) || null,
      })),
      totalCount,
      summary: {
        totalMonitoredNotices: totalCount,
        exactMatchesCount: exactCount,
        possibleMatchesCount: possibleCount,
        totalAffectedOrders,
        totalExposedValueMinor: totalExposedMinor.toString(),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch regulatory data';
    console.error('[api:regulatory:get:error]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
