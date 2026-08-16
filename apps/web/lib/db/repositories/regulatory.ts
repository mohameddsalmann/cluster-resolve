import { randomUUID } from 'node:crypto';
import { getSupabaseServerClient } from '../../supabase/server';
import type {
  ProcurementOrderRecord,
  ProcurementProductRecord,
  RegulatoryDatasetEvaluationSummary,
  RegulatoryNoticeSource,
} from '@cluster/core';
import { evaluateRegulatoryExposures } from '@cluster/core';
import type {
  RegulatoryExposureRow,
  RegulatoryNoticeRow,
} from '../row-types';

export interface ListRegulatoryNoticesOptions {
  year?: number;
  noticeType?: string;
  recallClass?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getRegulatoryRepositoryStatus(): Promise<{
  available: boolean;
  reason: string | null;
}> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('regulatory_notices' as never)
    .select('id')
    .limit(1);

  if (!error) return { available: true, reason: null };
  if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
    return {
      available: false,
      reason: 'The regulatory persistence migration has not been applied to this Supabase project.',
    };
  }
  throw error;
}

export async function getRegulatoryLastSync(): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('regulatory_notices' as never)
    .select('retrieved_at')
    .order('retrieved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { retrieved_at: string } | null)?.retrieved_at ?? null;
}

// In-memory fallback stores if hosted Supabase migration 20260815000002 is pending in PostgREST schema cache
const memoryNotices = new Map<string, RegulatoryNoticeRow>();
const memoryExposures = new Map<string, RegulatoryExposureRow>();

export async function upsertRegulatoryNotices(
  notices: RegulatoryNoticeSource[]
): Promise<RegulatoryNoticeRow[]> {
  const supabase = getSupabaseServerClient();
  const rows = notices.map((n) => ({
    id: randomUUID(),
    notice_number: n.noticeNumber,
    title: n.title,
    year: n.year,
    notice_type: n.noticeType,
    recall_class: n.recallClass,
    product_name: n.productName,
    product_name_normalized: n.productName.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim(),
    manufacturer: n.manufacturer,
    manufacturer_normalized: n.manufacturer ? n.manufacturer.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim() : null,
    batch_numbers: n.batchNumbers,
    registration_number: n.registrationNumber,
    reason: n.reason,
    source_url: n.sourceUrl,
    source_authority: n.sourceAuthority,
    source_doc_code: n.sourceDocCode,
    source_version: n.sourceVersion,
    source_checksum: n.sourceChecksum,
    retrieved_at: n.retrievedAt || new Date().toISOString(),
    created_at: new Date().toISOString(),
  }));

  try {
    const insertPayload = rows.map(withoutId);

    const { data, error } = await supabase
      .from('regulatory_notices' as never)
      .upsert(insertPayload as never, {
        onConflict: 'notice_number,year',
      })
      .select('*');

    if (error) {
      if (error.code === 'PGRST205') {
        for (const row of rows) {
          const key = `${row.notice_number}:${row.year}`;
          memoryNotices.set(key, row as unknown as RegulatoryNoticeRow);
        }
        return Array.from(memoryNotices.values());
      }
      throw error;
    }
    return (data as unknown as RegulatoryNoticeRow[]) ?? [];
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205') || errObj?.message?.includes('schema cache')) {
      for (const row of rows) {
        const key = `${row.notice_number}:${row.year}`;
        memoryNotices.set(key, row as unknown as RegulatoryNoticeRow);
      }
      return Array.from(memoryNotices.values());
    }
    throw err;
  }
}

export async function listRegulatoryNotices(
  options: ListRegulatoryNoticesOptions = {}
): Promise<{ notices: RegulatoryNoticeRow[]; totalCount: number }> {
  const supabase = getSupabaseServerClient();
  try {
    let query = supabase.from('regulatory_notices' as never).select('*', { count: 'exact' });

    if (options.year) {
      query = query.eq('year', options.year);
    }
    if (options.noticeType && options.noticeType !== 'ALL') {
      query = query.eq('notice_type', options.noticeType);
    }
    if (options.recallClass && options.recallClass !== 'ALL') {
      query = query.eq('recall_class', options.recallClass);
    }
    if (options.search) {
      const term = options.search.trim();
      query = query.or(`product_name.ilike.%${term}%,notice_number.ilike.%${term}%,title.ilike.%${term}%`);
    }

    query = query.order('year', { ascending: false }).order('created_at', { ascending: false });

    if (options.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, count, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return filterMemoryNotices(options);
      }
      throw error;
    }

    return {
      notices: (data as unknown as RegulatoryNoticeRow[]) ?? [],
      totalCount: count ?? 0,
    };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205') || errObj?.message?.includes('schema cache')) {
      return filterMemoryNotices(options);
    }
    throw err;
  }
}

function filterMemoryNotices(options: ListRegulatoryNoticesOptions): { notices: RegulatoryNoticeRow[]; totalCount: number } {
  let list = Array.from(memoryNotices.values());
  if (options.year) list = list.filter((n) => n.year === options.year);
  if (options.noticeType && options.noticeType !== 'ALL') list = list.filter((n) => n.notice_type === options.noticeType);
  if (options.recallClass && options.recallClass !== 'ALL') list = list.filter((n) => n.recall_class === options.recallClass);
  if (options.search) {
    const s = options.search.toLowerCase();
    list = list.filter((n) => n.product_name.toLowerCase().includes(s) || n.notice_number.toLowerCase().includes(s) || n.title.toLowerCase().includes(s));
  }
  const total = list.length;
  const offset = options.offset || 0;
  const limit = options.limit || list.length;
  return {
    notices: list.slice(offset, offset + limit),
    totalCount: total,
  };
}

export async function getRegulatoryNoticeById(id: string): Promise<RegulatoryNoticeRow | null> {
  const supabase = getSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('regulatory_notices' as never)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') {
        return Array.from(memoryNotices.values()).find((n) => n.id === id) || null;
      }
      throw error;
    }
    return (data as unknown as RegulatoryNoticeRow) || null;
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      return Array.from(memoryNotices.values()).find((n) => n.id === id) || null;
    }
    throw err;
  }
}

export async function evaluateAndPersistExposures(
  datasetId: string,
  asOfDate: string = new Date().toISOString()
): Promise<RegulatoryDatasetEvaluationSummary> {
  const supabase = getSupabaseServerClient();

  // 1. Fetch all notices
  const { notices: dbNotices } = await listRegulatoryNotices();

  const notices: RegulatoryNoticeSource[] = dbNotices.map((n) => ({
    noticeNumber: n.notice_number,
    title: n.title,
    year: n.year,
    noticeType: n.notice_type,
    recallClass: n.recall_class,
    productName: n.product_name,
    manufacturer: n.manufacturer,
    batchNumbers: n.batch_numbers,
    registrationNumber: n.registration_number,
    reason: n.reason,
    sourceUrl: n.source_url,
    sourceAuthority: n.source_authority,
    sourceDocCode: n.source_doc_code,
    sourceVersion: n.source_version,
    sourceChecksum: n.source_checksum || undefined,
    retrievedAt: n.retrieved_at,
  }));

  // 2. Fetch dataset products
  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, name_normalized, external_product_id')
    .eq('dataset_id', datasetId);
  if (prodErr) throw prodErr;

  const products: ProcurementProductRecord[] = (dbProducts || []).map((p) => ({
    id: p.id,
    name: p.name,
    nameNormalized: p.name_normalized,
    externalProductId: p.external_product_id,
  }));

  // 3. Fetch dataset orders, items, offers, outcomes
  const [ordersRes, itemsRes, offersRes, outcomesRes] = await Promise.all([
    supabase.from('orders').select('id, external_order_id, pharmacy_id, placed_at').eq('dataset_id', datasetId),
    supabase.from('order_items').select('order_id, product_id, requested_qty').eq('dataset_id', datasetId),
    supabase.from('supplier_offers').select('order_id, supplier_id, product_id, unit_price_minor').eq('dataset_id', datasetId),
    supabase.from('order_outcomes').select('order_id, supplier_id, product_id, filled_qty, cancelled').eq('dataset_id', datasetId),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (offersRes.error) throw offersRes.error;
  if (outcomesRes.error) throw outcomesRes.error;

  const itemsByOrder = new Map<string, Array<{ productId: string; requestedQty: number }>>();
  for (const item of itemsRes.data || []) {
    let list = itemsByOrder.get(item.order_id);
    if (!list) {
      list = [];
      itemsByOrder.set(item.order_id, list);
    }
    list.push({ productId: item.product_id, requestedQty: item.requested_qty });
  }

  const offersByOrder = new Map<string, Array<{ supplierId: string; productId: string; unitPriceMinor: bigint }>>();
  for (const off of offersRes.data || []) {
    let list = offersByOrder.get(off.order_id);
    if (!list) {
      list = [];
      offersByOrder.set(off.order_id, list);
    }
    list.push({
      supplierId: off.supplier_id,
      productId: off.product_id,
      unitPriceMinor: BigInt(off.unit_price_minor as unknown as string || '0'),
    });
  }

  const outcomesByOrder = new Map<string, Array<{ supplierId: string; productId: string; filledQty: number; cancelled: boolean }>>();
  for (const out of outcomesRes.data || []) {
    let list = outcomesByOrder.get(out.order_id);
    if (!list) {
      list = [];
      outcomesByOrder.set(out.order_id, list);
    }
    list.push({
      supplierId: out.supplier_id,
      productId: out.product_id,
      filledQty: out.filled_qty,
      cancelled: out.cancelled,
    });
  }

  const orderRecords: ProcurementOrderRecord[] = (ordersRes.data || []).map((o) => ({
    id: o.id,
    externalOrderId: o.external_order_id,
    pharmacyId: o.pharmacy_id,
    placedAt: o.placed_at,
    items: itemsByOrder.get(o.id) || [],
    offers: offersByOrder.get(o.id) || [],
    outcomes: outcomesByOrder.get(o.id) || [],
  }));

  // 4. Run deterministic evaluation
  const summary = evaluateRegulatoryExposures(datasetId, notices, products, orderRecords, asOfDate);

  // Map notice numbers to notice DB UUIDs
  const noticeDbMap = new Map<string, string>();
  for (const n of dbNotices) {
    noticeDbMap.set(n.notice_number, n.id);
  }

  // 5. Persist exposures
  const exposureRows = summary.exposures.map((e) => {
    const noticeId = noticeDbMap.get(e.noticeNumber) || `notice_${e.noticeNumber}`;

    return {
      id: randomUUID(),
      dataset_id: datasetId,
      notice_id: noticeId,
      match_status: e.matchStatus,
      match_reason: e.matchReason,
      matched_product_id: e.matchedProductId,
      affected_orders_count: e.affectedOrdersCount,
      affected_pharmacies_count: e.affectedPharmaciesCount,
      affected_suppliers_count: e.affectedSuppliersCount,
      requested_units: e.requestedUnits,
      filled_units: e.filledUnits,
      historical_value_minor: e.historicalValueMinor.toString(),
      evidence_json: e.evidence,
      evaluated_at: asOfDate,
      created_at: asOfDate,
    };
  });

  if (exposureRows.length > 0) {
    try {
      const { error: expErr } = await supabase
        .from('regulatory_exposures' as never)
        .upsert(exposureRows.map(withoutId) as never, {
          onConflict: 'dataset_id,notice_id',
        });
      if (expErr) {
        if (expErr.code === 'PGRST205') {
          for (const row of exposureRows) {
            memoryExposures.set(`${datasetId}:${row.notice_id}`, {
              ...row,
              historical_value_minor: BigInt(row.historical_value_minor),
            } as unknown as RegulatoryExposureRow);
          }
          return summary;
        }
        throw expErr;
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
        for (const row of exposureRows) {
          memoryExposures.set(`${datasetId}:${row.notice_id}`, {
            ...row,
            historical_value_minor: BigInt(row.historical_value_minor),
          } as unknown as RegulatoryExposureRow);
        }
        return summary;
      }
      throw err;
    }
  }

  return summary;
}

export async function listRegulatoryExposures(
  datasetId: string,
  options: { matchStatus?: string; search?: string } = {}
): Promise<Array<RegulatoryExposureRow & { notice: RegulatoryNoticeRow }>> {
  const supabase = getSupabaseServerClient();
  try {
    let query = supabase
      .from('regulatory_exposures' as never)
      .select('*, notice:regulatory_notices(*)')
      .eq('dataset_id', datasetId);

    if (options.matchStatus && options.matchStatus !== 'ALL') {
      query = query.eq('match_status', options.matchStatus);
    }

    query = query.order('evaluated_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return getMemoryExposures(datasetId, options);
      }
      throw error;
    }

    const rawRows = (data as unknown as Array<Record<string, unknown>>) || [];
    return rawRows.map((r) => ({
      id: r.id as string,
      dataset_id: r.dataset_id as string,
      notice_id: r.notice_id as string,
      match_status: r.match_status as RegulatoryExposureRow['match_status'],
      match_reason: r.match_reason as string,
      matched_product_id: (r.matched_product_id as string) || null,
      affected_orders_count: r.affected_orders_count as number,
      affected_pharmacies_count: r.affected_pharmacies_count as number,
      affected_suppliers_count: r.affected_suppliers_count as number,
      requested_units: r.requested_units as number,
      filled_units: r.filled_units as number,
      historical_value_minor: BigInt((r.historical_value_minor as string) || '0'),
      evidence_json: (r.evidence_json as Record<string, unknown>) || {},
      evaluated_at: r.evaluated_at as string,
      created_at: r.created_at as string,
      notice: r.notice as RegulatoryNoticeRow,
    }));
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      return getMemoryExposures(datasetId, options);
    }
    throw err;
  }
}

function getMemoryExposures(datasetId: string, options: { matchStatus?: string }): Array<RegulatoryExposureRow & { notice: RegulatoryNoticeRow }> {
  let list = Array.from(memoryExposures.values()).filter((e) => e.dataset_id === datasetId);
  if (options.matchStatus && options.matchStatus !== 'ALL') {
    list = list.filter((e) => e.match_status === options.matchStatus);
  }
  return list.map((e) => {
    const notice = Array.from(memoryNotices.values()).find((n) => n.id === e.notice_id) || {
      id: e.notice_id,
      notice_number: 'Unknown',
      title: 'Notice',
      year: 2026,
      notice_type: 'RECALL',
      recall_class: 'CLASS_II',
      product_name: 'Unknown',
      product_name_normalized: 'unknown',
      manufacturer: null,
      manufacturer_normalized: null,
      batch_numbers: [],
      registration_number: null,
      reason: null,
      source_url: 'https://edaegypt.gov.eg',
      source_authority: 'Egyptian Drug Authority',
      source_doc_code: null,
      source_version: null,
      source_checksum: null,
      retrieved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    return {
      ...e,
      notice: notice as RegulatoryNoticeRow,
    };
  });
}

function withoutId<T extends { id: string }>(row: T): Omit<T, 'id'> {
  const { id, ...payload } = row;
  void id;
  return payload;
}
