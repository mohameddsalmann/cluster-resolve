import { NextResponse } from 'next/server';
import {
  getRegulatoryLastSync,
  getRegulatoryRepositoryStatus,
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
    const requestedPage = Number.parseInt(url.searchParams.get('page') || '1', 10);
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '25', 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 25;

    const repositoryStatus = await getRegulatoryRepositoryStatus();
    if (!repositoryStatus.available) {
      return NextResponse.json({
        notices: [],
        totalCount: 0,
        page,
        pageSize: limit,
        sourceStatus: 'PERSISTENCE_UNAVAILABLE',
        sourceAuthority: 'Egyptian Drug Authority',
        lastSync: null,
        statusMessage: repositoryStatus.reason,
        summary: {
          totalMonitoredNotices: 0,
          exactMatchesCount: 0,
          possibleMatchesCount: 0,
          totalAffectedOrders: 0,
          totalExposedValueMinor: '0',
        },
      });
    }

    // 1. Fetch global notices
    const [{ notices, totalCount }, lastSync] = await Promise.all([
      listRegulatoryNotices({
        year,
        noticeType,
        recallClass,
        search,
        limit,
        offset: (page - 1) * limit,
      }),
      getRegulatoryLastSync(),
    ]);

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
      notices: notices.map((n) => {
        const rawExp = exposureByNoticeId.get(n.id);
        const exp = rawExp
          ? {
              ...rawExp,
              historical_value_minor: rawExp.historical_value_minor?.toString() ?? '0',
            }
          : null;
        return {
          ...n,
          exposure: exp,
        };
      }),
      totalCount,
      page,
      pageSize: limit,
      sourceStatus: totalCount > 0 ? 'PERSISTED_OFFICIAL' : 'NOT_SYNCED',
      sourceAuthority: 'Egyptian Drug Authority',
      lastSync,
      statusMessage: totalCount > 0
        ? 'Official public notices persisted from the EDA source.'
        : 'No official EDA notices have been persisted yet.',
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
