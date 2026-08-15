import { getSupabaseServerClient } from '../../supabase/server';
import type {
  CanonicalTraceabilityEventRecord,
  PreflightResult,
  TraceabilityFormat,
  TraceabilityOrderInput,
  TraceabilityProductCatalogItem,
  TraceabilityProductLink,
} from '@cluster/core';
import {
  buildProductLinks,
  evaluateExpiryIntelligence,
  reconcileOrdersWithTraceability,
} from '@cluster/core';
import type {
  TraceabilityEventRow,
  TraceabilityFindingRow,
  TraceabilityImportRow,
  TraceabilityProductLinkRow,
  TraceabilityReconciliationRow,
} from '../row-types';

export interface CreateImportParams {
  datasetId: string;
  filename: string;
  format: TraceabilityFormat;
  storagePath: string;
  fileSha256: string;
  fileSizeBytes: number;
  result: PreflightResult;
}

// In-memory fallback stores
const memoryImports = new Map<string, TraceabilityImportRow>();
const memoryFindings = new Map<string, TraceabilityFindingRow[]>();
const memoryEvents = new Map<string, TraceabilityEventRow[]>();
const memoryLinks = new Map<string, TraceabilityProductLinkRow>();
const memoryReconciliations = new Map<string, TraceabilityReconciliationRow>();

export async function createTraceabilityImport(
  params: CreateImportParams
): Promise<{ importRow: TraceabilityImportRow; findings: TraceabilityFindingRow[] }> {
  const supabase = getSupabaseServerClient();
  const importId = `imp_${params.datasetId}_${Date.now()}`;

  const importPayload = {
    id: importId,
    dataset_id: params.datasetId,
    filename: params.filename,
    format: params.format,
    storage_path: params.storagePath,
    file_sha256: params.fileSha256,
    file_size_bytes: params.fileSizeBytes,
    preflight_status: params.result.status,
    total_rows: params.result.totalRows,
    event_count: params.result.eventCount,
    serial_count: params.result.serialCount,
    batch_count: params.result.batchCount,
    finding_count: params.result.findings.length,
    rules_version: params.result.rulesVersion,
    instance_identifier: params.result.instanceIdentifier || null,
    sender_gln: params.result.senderGln || null,
    receiver_gln: params.result.receiverGln || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data: importData, error: importErr } = await supabase
      .from('traceability_imports' as never)
      .upsert(
        {
          dataset_id: params.datasetId,
          filename: params.filename,
          format: params.format,
          storage_path: params.storagePath,
          file_sha256: params.fileSha256,
          file_size_bytes: params.fileSizeBytes,
          preflight_status: params.result.status,
          total_rows: params.result.totalRows,
          event_count: params.result.eventCount,
          serial_count: params.result.serialCount,
          batch_count: params.result.batchCount,
          finding_count: params.result.findings.length,
          rules_version: params.result.rulesVersion,
          instance_identifier: params.result.instanceIdentifier || null,
          sender_gln: params.result.senderGln || null,
          receiver_gln: params.result.receiverGln || null,
        } as never,
        { onConflict: 'dataset_id,file_sha256' }
      )
      .select('*')
      .single();

    if (importErr) {
      if (importErr.code === 'PGRST205') {
        memoryImports.set(importId, importPayload as unknown as TraceabilityImportRow);
        const fRows = createFindingRows(params.datasetId, importId, params.result.findings);
        memoryFindings.set(importId, fRows);
        return { importRow: importPayload as unknown as TraceabilityImportRow, findings: fRows };
      }
      throw importErr;
    }

    const importRow = importData as unknown as TraceabilityImportRow;
    const findingRows = createFindingRows(params.datasetId, importRow.id, params.result.findings);

    let persistedFindings: TraceabilityFindingRow[] = [];
    if (findingRows.length > 0) {
      const { data: fData, error: fErr } = await supabase
        .from('traceability_findings' as never)
        .insert(findingRows as never)
        .select('*');
      if (fErr && fErr.code !== 'PGRST205') throw fErr;
      persistedFindings = (fData as unknown as TraceabilityFindingRow[]) || findingRows;
    }

    return { importRow, findings: persistedFindings };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205') || errObj?.message?.includes('schema cache')) {
      memoryImports.set(importId, importPayload as unknown as TraceabilityImportRow);
      const fRows = createFindingRows(params.datasetId, importId, params.result.findings);
      memoryFindings.set(importId, fRows);
      return { importRow: importPayload as unknown as TraceabilityImportRow, findings: fRows };
    }
    throw err;
  }
}

function createFindingRows(datasetId: string, importId: string, findings: PreflightResult['findings']): TraceabilityFindingRow[] {
  return findings.map((f, i) => ({
    id: `find_${importId}_${i}`,
    dataset_id: datasetId,
    import_id: importId,
    code: f.code,
    severity: (f.severity === 'ERROR' ? 'ERROR' : 'WARNING') as 'ERROR' | 'WARNING',
    row_or_event_index: f.rowOrEventIndex || null,
    field: f.field || null,
    message: f.message,
    evidence: f.evidence || null,
    official_rule_reference: f.officialRuleReference,
    created_at: new Date().toISOString(),
  }));
}

export async function listTraceabilityImports(datasetId: string): Promise<TraceabilityImportRow[]> {
  const supabase = getSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('traceability_imports' as never)
      .select('*')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        return Array.from(memoryImports.values()).filter((i) => i.dataset_id === datasetId);
      }
      throw error;
    }
    return (data as unknown as TraceabilityImportRow[]) || [];
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      return Array.from(memoryImports.values()).filter((i) => i.dataset_id === datasetId);
    }
    throw err;
  }
}

export async function getTraceabilityImport(
  importId: string
): Promise<{ importRow: TraceabilityImportRow; findings: TraceabilityFindingRow[] } | null> {
  const supabase = getSupabaseServerClient();
  try {
    const [importRes, findingsRes] = await Promise.all([
      supabase.from('traceability_imports' as never).select('*').eq('id', importId).maybeSingle(),
      supabase.from('traceability_findings' as never).select('*').eq('import_id', importId).order('row_or_event_index'),
    ]);

    if (importRes.error) {
      if (importRes.error.code === 'PGRST205') {
        const row = memoryImports.get(importId) || null;
        if (!row) return null;
        return { importRow: row, findings: memoryFindings.get(importId) || [] };
      }
      throw importRes.error;
    }

    if (!importRes.data) return null;

    return {
      importRow: importRes.data as unknown as TraceabilityImportRow,
      findings: (findingsRes.data as unknown as TraceabilityFindingRow[]) || [],
    };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      const row = memoryImports.get(importId) || null;
      if (!row) return null;
      return { importRow: row, findings: memoryFindings.get(importId) || [] };
    }
    throw err;
  }
}

export async function persistCanonicalEvents(
  datasetId: string,
  importId: string,
  events: CanonicalTraceabilityEventRecord[]
): Promise<TraceabilityEventRow[]> {
  const supabase = getSupabaseServerClient();
  if (events.length === 0) return [];

  const rows: TraceabilityEventRow[] = events.map((ev, idx) => ({
    id: `ev_${datasetId}_${importId}_${idx + 1}`,
    dataset_id: datasetId,
    import_id: importId,
    event_type: ev.eventType,
    event_time: ev.eventTime,
    timezone_offset: ev.timezoneOffset || null,
    epc: ev.epc,
    gtin: ev.gtin || null,
    serial: ev.serial || null,
    sscc: ev.sscc || null,
    batch: ev.batch || null,
    expiry_date: ev.expiryDate || null,
    manufacturing_date: ev.manufacturingDate || null,
    parent_epc: ev.parentEpc || null,
    read_point_gln: ev.readPointGln,
    biz_location_gln: ev.bizLocationGln,
    source_gln: ev.sourceGln || null,
    destination_gln: ev.destinationGln || null,
    biz_transaction_ref: ev.bizTransactionRef || null,
    source_format: ev.sourceFormat,
    source_index: ev.sourceIndex || idx + 1,
    created_at: new Date().toISOString(),
  }));

  try {
    const { data, error } = await supabase
      .from('traceability_events' as never)
      .upsert(rows as never, {
        onConflict: 'dataset_id,import_id,source_index',
      })
      .select('*');

    if (error) {
      if (error.code === 'PGRST205') {
        const existing = memoryEvents.get(datasetId) || [];
        memoryEvents.set(datasetId, [...existing, ...rows]);
        return rows;
      }
      throw error;
    }
    return (data as unknown as TraceabilityEventRow[]) || [];
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      const existing = memoryEvents.get(datasetId) || [];
      memoryEvents.set(datasetId, [...existing, ...rows]);
      return rows;
    }
    throw err;
  }
}

export async function listCanonicalEvents(
  datasetId: string,
  options: { eventType?: string; gtin?: string; limit?: number; offset?: number } = {}
): Promise<{ events: TraceabilityEventRow[]; totalCount: number }> {
  const supabase = getSupabaseServerClient();
  try {
    let query = supabase
      .from('traceability_events' as never)
      .select('*', { count: 'exact' })
      .eq('dataset_id', datasetId);

    if (options.eventType && options.eventType !== 'ALL') {
      query = query.eq('event_type', options.eventType);
    }
    if (options.gtin) {
      query = query.eq('gtin', options.gtin);
    }

    query = query.order('event_time', { ascending: false });

    if (options.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, count, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return filterMemoryEvents(datasetId, options);
      }
      throw error;
    }

    return {
      events: (data as unknown as TraceabilityEventRow[]) || [],
      totalCount: count ?? 0,
    };
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      return filterMemoryEvents(datasetId, options);
    }
    throw err;
  }
}

function filterMemoryEvents(datasetId: string, options: { eventType?: string; gtin?: string; limit?: number; offset?: number }): { events: TraceabilityEventRow[]; totalCount: number } {
  let list = memoryEvents.get(datasetId) || [];
  if (options.eventType && options.eventType !== 'ALL') list = list.filter((e) => e.event_type === options.eventType);
  if (options.gtin) list = list.filter((e) => e.gtin === options.gtin);
  const total = list.length;
  const offset = options.offset || 0;
  const limit = options.limit || list.length;
  return {
    events: list.slice(offset, offset + limit),
    totalCount: total,
  };
}

export async function listTraceabilityProductLinks(
  datasetId: string
): Promise<Array<TraceabilityProductLinkRow & { product?: { name: string } }>> {
  const supabase = getSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('traceability_product_links' as never)
      .select('*, product:products(name)')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        return Array.from(memoryLinks.values()).filter((l) => l.dataset_id === datasetId);
      }
      throw error;
    }
    return (data as unknown as Array<TraceabilityProductLinkRow & { product?: { name: string } }>) || [];
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      return Array.from(memoryLinks.values()).filter((l) => l.dataset_id === datasetId);
    }
    throw err;
  }
}

export async function upsertTraceabilityProductLink(
  datasetId: string,
  productId: string,
  gtin: string,
  status: 'CONFIRMED' | 'SUGGESTED',
  confidenceReason: string
): Promise<TraceabilityProductLinkRow> {
  const supabase = getSupabaseServerClient();
  const row: TraceabilityProductLinkRow = {
    id: `link_${datasetId}_${productId}_${gtin}`,
    dataset_id: datasetId,
    product_id: productId,
    gtin: gtin.trim(),
    status,
    confidence_reason: confidenceReason,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('traceability_product_links' as never)
      .upsert(
        {
          dataset_id: datasetId,
          product_id: productId,
          gtin: gtin.trim(),
          status,
          confidence_reason: confidenceReason,
        } as never,
        { onConflict: 'dataset_id,product_id,gtin' }
      )
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST205') {
        memoryLinks.set(`${datasetId}:${productId}:${gtin}`, row);
        return row;
      }
      throw error;
    }
    return data as unknown as TraceabilityProductLinkRow;
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      memoryLinks.set(`${datasetId}:${productId}:${gtin}`, row);
      return row;
    }
    throw err;
  }
}

export async function evaluateAndPersistReconciliations(
  datasetId: string,
  asOfDate: string = new Date().toISOString()
): Promise<TraceabilityReconciliationRow[]> {
  const supabase = getSupabaseServerClient();

  // 1. Fetch products & GTIN links
  const [productsRes, linksData, eventsData, ordersRes, itemsRes, outcomesRes] = await Promise.all([
    supabase.from('products').select('id, name, name_normalized, external_product_id').eq('dataset_id', datasetId),
    listTraceabilityProductLinks(datasetId),
    listCanonicalEvents(datasetId),
    supabase.from('orders').select('id, external_order_id, pharmacy_id, placed_at').eq('dataset_id', datasetId),
    supabase.from('order_items').select('order_id, product_id, requested_qty').eq('dataset_id', datasetId),
    supabase.from('order_outcomes').select('order_id, supplier_id, product_id, filled_qty, cancelled').eq('dataset_id', datasetId),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (outcomesRes.error) throw outcomesRes.error;

  const catalog: TraceabilityProductCatalogItem[] = (productsRes.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    nameNormalized: p.name_normalized,
    externalProductId: p.external_product_id,
  }));

  const productLinks: TraceabilityProductLink[] = linksData.map((l) => ({
    id: l.id,
    datasetId: l.dataset_id,
    productId: l.product_id,
    gtin: l.gtin,
    status: l.status,
    confidenceReason: l.confidence_reason,
    createdAt: l.created_at,
  }));

  const eventsList = eventsData.events;
  const distinctGtins = Array.from(
    new Set(eventsList.map((e) => e.gtin).filter(Boolean))
  ) as string[];

  const existingGtins = new Set(productLinks.map((l) => l.gtin));
  for (const gtin of distinctGtins) {
    if (!existingGtins.has(gtin)) {
      const suggested = buildProductLinks(datasetId, [{ gtin }], catalog);
      if (suggested.length > 0) {
        productLinks.push(...suggested);
        await upsertTraceabilityProductLink(
          datasetId,
          suggested[0].productId,
          suggested[0].gtin,
          suggested[0].status,
          suggested[0].confidenceReason
        );
      }
    }
  }

  const productNameMap = new Map(catalog.map((p) => [p.id, p.name]));

  const itemsByOrder = new Map<string, Array<{ productId: string; productName: string; requestedQty: number }>>();
  for (const item of itemsRes.data || []) {
    let list = itemsByOrder.get(item.order_id);
    if (!list) {
      list = [];
      itemsByOrder.set(item.order_id, list);
    }
    list.push({
      productId: item.product_id,
      productName: productNameMap.get(item.product_id) || 'Unknown Product',
      requestedQty: item.requested_qty,
    });
  }

  const outcomesByOrder = new Map<string, Array<{ productId: string; filledQty: number; cancelled: boolean }>>();
  for (const out of outcomesRes.data || []) {
    let list = outcomesByOrder.get(out.order_id);
    if (!list) {
      list = [];
      outcomesByOrder.set(out.order_id, list);
    }
    list.push({
      productId: out.product_id,
      filledQty: out.filled_qty,
      cancelled: out.cancelled,
    });
  }

  const ordersInput: TraceabilityOrderInput[] = (ordersRes.data || []).map((o) => ({
    id: o.id,
    externalOrderId: o.external_order_id,
    pharmacyId: o.pharmacy_id,
    placedAt: o.placed_at,
    items: itemsByOrder.get(o.id) || [],
    outcomes: outcomesByOrder.get(o.id) || [],
  }));

  const canonicalEvents: CanonicalTraceabilityEventRecord[] = eventsList.map((e) => ({
    eventType: e.event_type,
    eventTime: e.event_time,
    timezoneOffset: e.timezone_offset,
    epc: e.epc,
    gtin: e.gtin,
    serial: e.serial,
    sscc: e.sscc,
    batch: e.batch,
    expiryDate: e.expiry_date,
    manufacturingDate: e.manufacturing_date,
    parentEpc: e.parent_epc,
    readPointGln: e.read_point_gln,
    bizLocationGln: e.biz_location_gln,
    sourceGln: e.source_gln,
    destinationGln: e.destination_gln,
    bizTransactionRef: e.biz_transaction_ref,
    sourceFormat: e.source_format,
    sourceIndex: e.source_index,
  }));

  const records = reconcileOrdersWithTraceability(datasetId, ordersInput, canonicalEvents, productLinks, asOfDate);

  const dbRows: TraceabilityReconciliationRow[] = records.map((r) => ({
    id: `recon_${datasetId}_${r.orderId}_${r.productId}`,
    dataset_id: datasetId,
    order_id: r.orderId,
    product_id: r.productId,
    reconciliation_status: r.reconciliationStatus,
    operational_qty: r.operationalQty,
    traceability_qty: r.traceabilityQty,
    difference_qty: r.differenceQty,
    business_ref: r.businessRef,
    linked_import_id: r.linkedImportId ?? null,
    evidence_json: r.evidenceJson,
    reconciled_at: asOfDate,
    created_at: asOfDate,
  }));

  if (dbRows.length > 0) {
    try {
      const { data, error } = await supabase
        .from('traceability_reconciliations' as never)
        .upsert(dbRows as never, {
          onConflict: 'dataset_id,order_id,product_id',
        })
        .select('*');

      if (error) {
        if (error.code === 'PGRST205') {
          for (const row of dbRows) {
            memoryReconciliations.set(`${datasetId}:${row.order_id}:${row.product_id}`, row);
          }
          return dbRows;
        }
        throw error;
      }
      return (data as unknown as TraceabilityReconciliationRow[]) || [];
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
        for (const row of dbRows) {
          memoryReconciliations.set(`${datasetId}:${row.order_id}:${row.product_id}`, row);
        }
        return dbRows;
      }
      throw err;
    }
  }

  return [];
}

export async function listTraceabilityReconciliations(
  datasetId: string,
  options: { status?: string } = {}
): Promise<Array<TraceabilityReconciliationRow & { order?: { external_order_id: string }; product?: { name: string } }>> {
  const supabase = getSupabaseServerClient();
  try {
    let query = supabase
      .from('traceability_reconciliations' as never)
      .select('*, order:orders(external_order_id), product:products(name)')
      .eq('dataset_id', datasetId);

    if (options.status && options.status !== 'ALL') {
      query = query.eq('reconciliation_status', options.status);
    }

    query = query.order('reconciled_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return getMemoryReconciliations(datasetId, options);
      }
      throw error;
    }

    return (data as unknown as Array<TraceabilityReconciliationRow & { order?: { external_order_id: string }; product?: { name: string } }>) || [];
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    if (errObj?.code === 'PGRST205' || errObj?.message?.includes('PGRST205')) {
      return getMemoryReconciliations(datasetId, options);
    }
    throw err;
  }
}

function getMemoryReconciliations(datasetId: string, options: { status?: string }): Array<TraceabilityReconciliationRow & { order?: { external_order_id: string }; product?: { name: string } }> {
  let list = Array.from(memoryReconciliations.values()).filter((r) => r.dataset_id === datasetId);
  if (options.status && options.status !== 'ALL') {
    list = list.filter((r) => r.reconciliation_status === options.status);
  }
  return list;
}

export async function getExpiryIntelligenceSummary(
  datasetId: string,
  asOfDate: string = new Date().toISOString()
) {
  const supabase = getSupabaseServerClient();
  const [eventsData, productsRes, linksData] = await Promise.all([
    listCanonicalEvents(datasetId),
    supabase.from('products').select('id, name').eq('dataset_id', datasetId),
    listTraceabilityProductLinks(datasetId),
  ]);

  if (productsRes.error) throw productsRes.error;

  const prodNameById = new Map((productsRes.data || []).map((p) => [p.id, p.name]));
  const prodNameByGtin = new Map<string, string>();

  for (const l of linksData) {
    const name = prodNameById.get(l.product_id);
    if (name) prodNameByGtin.set(l.gtin, name);
  }

  const canonicalEvents: CanonicalTraceabilityEventRecord[] = eventsData.events.map((e) => ({
    eventType: e.event_type,
    eventTime: e.event_time,
    epc: e.epc,
    gtin: e.gtin,
    serial: e.serial,
    batch: e.batch,
    expiryDate: e.expiry_date,
    readPointGln: e.read_point_gln,
    bizLocationGln: e.biz_location_gln,
    sourceFormat: e.source_format,
    sourceIndex: e.source_index,
  }));

  return evaluateExpiryIntelligence(canonicalEvents, asOfDate, prodNameByGtin);
}
