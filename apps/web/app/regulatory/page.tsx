'use client';

import { useState, useEffect } from 'react';
import {
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusChip,
  type ChipTone,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';

interface NoticeItem {
  id: string;
  notice_number: string;
  title: string;
  year: number;
  notice_type: string;
  recall_class: string | null;
  product_name: string;
  manufacturer: string | null;
  batch_numbers: string[];
  registration_number: string | null;
  reason: string | null;
  source_url: string;
  source_authority: string;
  source_doc_code: string | null;
  source_version: string | null;
  source_checksum: string | null;
  retrieved_at: string;
  exposure: {
    id: string;
    match_status: 'EXACT' | 'POSSIBLE' | 'UNMATCHED';
    match_reason: string;
    affected_orders_count: number;
    affected_pharmacies_count: number;
    affected_suppliers_count: number;
    requested_units: number;
    filled_units: number;
    historical_value_minor: string;
    evidence_json: {
      affectedOrders?: Array<{
        orderId: string;
        externalOrderId: string;
        pharmacyId: string;
        placedAt: string;
        requestedQty: number;
        filledQty: number;
        historicalValueMinor: string;
      }>;
      affectedSuppliers?: string[];
      affectedPharmacies?: string[];
      matchRule?: string;
    };
  } | null;
}

interface RegulatorySummary {
  totalMonitoredNotices: number;
  exactMatchesCount: number;
  possibleMatchesCount: number;
  totalAffectedOrders: number;
  totalExposedValueMinor: string;
}

interface RegulatorySourceStatus {
  totalCount: number;
  page: number;
  pageSize: number;
  sourceStatus: 'PERSISTED_OFFICIAL' | 'NOT_SYNCED' | 'PERSISTENCE_UNAVAILABLE';
  sourceAuthority: string;
  lastSync: string | null;
  statusMessage: string;
}

const PAGE_SIZE = 25;

export default function RegulatoryPage() {
  const { activeDataset, activeDatasetId } = useDataset();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [summary, setSummary] = useState<RegulatorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<RegulatorySourceStatus | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const paginationKey = `${activeDatasetId}|${selectedYear}|${selectedType}|${selectedClass}|${search}`;
  const [pagination, setPagination] = useState({ key: '', page: 1 });
  const page = pagination.key === paginationKey ? pagination.page : 1;

  // Active detail modal
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (activeDatasetId) params.set('datasetId', activeDatasetId);
        if (selectedYear !== 'ALL') params.set('year', selectedYear);
        if (selectedType !== 'ALL') params.set('noticeType', selectedType);
        if (selectedClass !== 'ALL') params.set('recallClass', selectedClass);
        if (search.trim()) params.set('search', search.trim());
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));

        const res = await fetch(`/api/regulatory?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        if (!isCancelled) {
          setNotices(data.notices || []);
          setSummary(data.summary || null);
          setSourceStatus({
            totalCount: data.totalCount || 0,
            page: data.page || page,
            pageSize: data.pageSize || PAGE_SIZE,
            sourceStatus: data.sourceStatus || 'NOT_SYNCED',
            sourceAuthority: data.sourceAuthority || 'Egyptian Drug Authority',
            lastSync: data.lastSync || null,
            statusMessage: data.statusMessage || '',
          });
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load regulatory data';
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId, selectedYear, selectedType, selectedClass, search, page, refreshTrigger]);

  async function handleSyncEda() {
    try {
      setSyncing(true);
      const res = await fetch(`/api/regulatory/sync${activeDatasetId ? `?datasetId=${activeDatasetId}` : ''}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Sync failed: ${await res.text()}`);
      setError(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`EDA sync did not persist data: ${msg}`);
    } finally {
      setSyncing(false);
    }
  }

  const formatCurrency = (minorStr: string | number = '0') => {
    const p = typeof minorStr === 'string' ? BigInt(minorStr || '0') : BigInt(minorStr);
    const egp = Number(p) / 100;
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 2,
    }).format(egp);
  };

  const getMatchBadge = (exposure: NoticeItem['exposure']) => {
    if (!exposure) {
      return <StatusChip label="NOT EVALUATED" tone="neutral" />;
    }
    if (exposure.match_status === 'EXACT') {
      return <StatusChip label="EXACT MATCH" tone="danger" />;
    }
    if (exposure.match_status === 'POSSIBLE') {
      return <StatusChip label="POSSIBLE MATCH" tone="caution" />;
    }
    return <StatusChip label="UNMATCHED" tone="neutral" />;
  };

  const getClassTone = (cls: string | null): ChipTone => {
    if (cls === 'CLASS_I') return 'danger';
    if (cls === 'CLASS_II') return 'caution';
    if (cls === 'CLASS_III') return 'brand';
    return 'neutral';
  };

  return (
    <AppShell>
      <TopContextBar
        title="Official EDA Regulatory Intelligence"
        subtitle="Official public notices matched against the active procurement dataset"
      />
      <PageBody wide>
        <PageHeader
          title="Official EDA Regulatory Intelligence"
          subtitle="Operator-triggered, bounded ingestion of official Egyptian Drug Authority notices, matched deterministically against procurement evidence."
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncEda}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-surface-raised border border-border px-3.5 py-1.5 text-sm font-medium text-heading hover:bg-surface-sunken transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-primary' : ''}`} />
                {syncing ? 'Syncing with EDA...' : 'Sync with EDA'}
              </button>
            </div>
          }
        />

        <Panel className="mb-6 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip
                  label="OFFICIAL EDA DATA"
                  tone={sourceStatus?.sourceStatus === 'PERSISTED_OFFICIAL' ? 'brand' : 'neutral'}
                />
                <StatusChip
                  label={activeDataset?.mode === 'SAMPLE' ? 'FOUNDER DEMO / SAMPLE MATCHING' : 'CUSTOMER DATA MATCHING'}
                  tone={activeDataset?.mode === 'SAMPLE' ? 'caution' : 'brand'}
                />
              </div>
              <p className="mt-2 text-sm text-body">
                Official EDA source matched against {activeDataset?.mode === 'SAMPLE'
                  ? 'synthetic Founder Demo procurement. The notices are public external data; the procurement is sample data.'
                  : 'the selected customer procurement dataset.'}
              </p>
              <p className="mt-1 text-xs text-muted">
                {sourceStatus?.statusMessage || 'Checking persisted official-source status…'}
              </p>
            </div>
            <div className="text-xs text-muted sm:text-right">
              <div>Source: {sourceStatus?.sourceAuthority || 'Egyptian Drug Authority'}</div>
              <div>Total notices: {sourceStatus?.totalCount ?? 0}</div>
              <div>Last sync: {sourceStatus?.lastSync ? new Date(sourceStatus.lastSync).toLocaleString() : 'Never'}</div>
            </div>
          </div>
        </Panel>

        {/* Metric Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            <Panel className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">EDA Notices Ingested</div>
              <div className="mt-2 text-2xl font-bold text-heading">{summary.totalMonitoredNotices}</div>
              <div className="mt-1 text-xs text-muted">Persisted official public notices</div>
            </Panel>

            <Panel className="p-4 border-l-4 border-l-danger">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Exact Product Matches</div>
              <div className="mt-2 text-2xl font-bold text-danger">{summary.exactMatchesCount}</div>
              <div className="mt-1 text-xs text-muted">Confirmed batch / GTIN exposure</div>
            </Panel>

            <Panel className="p-4 border-l-4 border-l-caution">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Possible Matches</div>
              <div className="mt-2 text-2xl font-bold text-caution">{summary.possibleMatchesCount}</div>
              <div className="mt-1 text-xs text-muted">Name overlap / pharmacovigilance watch</div>
            </Panel>

            <Panel className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Affected Orders</div>
              <div className="mt-2 text-2xl font-bold text-heading">{summary.totalAffectedOrders}</div>
              <div className="mt-1 text-xs text-muted">Procurement lines exposed</div>
            </Panel>

            <Panel className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Historical Exposure Value</div>
              <div className="mt-2 text-xl font-bold text-heading">
                {formatCurrency(summary.totalExposedValueMinor)}
              </div>
              <div className="mt-1 text-xs text-muted">Accurate bigint minor units</div>
            </Panel>
          </div>
        )}

        {/* Filter Toolbar */}
        <Panel className="p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search product name, notice number, or manufacturer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-1.5 text-sm text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-heading focus:outline-none"
              >
                <option value="ALL">All Years</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Class:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-heading focus:outline-none"
              >
                <option value="ALL">All Classes</option>
                <option value="CLASS_I">Class I</option>
                <option value="CLASS_II">Class II</option>
                <option value="CLASS_III">Class III</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Type:</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-heading focus:outline-none"
              >
                <option value="ALL">All Types</option>
                <option value="RECALL">Recall</option>
                <option value="ALERT">Alert</option>
                <option value="COMMERCIAL_FRAUD">Commercial Fraud</option>
                <option value="AWARENESS">Awareness</option>
              </select>
            </div>
          </div>
        </Panel>

        {/* Notices Table */}
        {loading ? (
          <LoadingState label="Loading official Egyptian Drug Authority notices..." />
        ) : error ? (
          <Panel className="p-8 text-center text-danger">{error}</Panel>
        ) : notices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No regulatory notices found"
            description="No notices match the selected criteria. Click 'Sync with EDA' to fetch official periodic reports."
          />
        ) : (
          <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-sunken/60 text-xs font-semibold uppercase tracking-wider text-muted border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Notice / Publication year</th>
                    <th className="py-3 px-4">Class / Type</th>
                    <th className="py-3 px-4">Product Name & Manufacturer</th>
                    <th className="py-3 px-4">Operational Status</th>
                    <th className="py-3 px-4">Affected Orders</th>
                    <th className="py-3 px-4">Historical Exposure</th>
                    <th className="py-3 px-4 text-right">Official Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {notices.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedNotice(n)}
                      className="hover:bg-surface-raised/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-heading">{n.notice_number}</div>
                        <div className="text-xs text-muted">{n.year}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {n.recall_class && (
                            <StatusChip
                              label={n.recall_class.replace('_', ' ')}
                              tone={getClassTone(n.recall_class)}
                            />
                          )}
                          <span className="text-xs text-muted font-mono">{n.notice_type}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-heading">{n.product_name}</div>
                        <div className="text-xs text-muted">{n.manufacturer || 'Manufacturer unstated'}</div>
                        {n.batch_numbers && n.batch_numbers.length > 0 && (
                          <div className="text-xs text-muted font-mono mt-0.5">
                            Batch: {n.batch_numbers.join(', ')}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">{getMatchBadge(n.exposure)}</td>

                      <td className="py-3 px-4">
                        {n.exposure && n.exposure.affected_orders_count > 0 ? (
                          <span className="font-semibold text-heading">
                            {n.exposure.affected_orders_count} orders ({n.exposure.affected_pharmacies_count} pharmacies)
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {n.exposure && BigInt(n.exposure.historical_value_minor || '0') > 0n ? (
                          <span className="font-semibold text-danger">
                            {formatCurrency(n.exposure.historical_value_minor)}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={n.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          EDA PDF
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {!loading && !error && sourceStatus && sourceStatus.totalCount > sourceStatus.pageSize && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">
              Page {sourceStatus.page} of {Math.ceil(sourceStatus.totalCount / sourceStatus.pageSize)} · {sourceStatus.totalCount} total notices
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPagination({ key: paginationKey, page: Math.max(1, page - 1) })}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-heading disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * sourceStatus.pageSize >= sourceStatus.totalCount}
                onClick={() => setPagination({ key: paginationKey, page: page + 1 })}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-heading disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Interactive Notice Detail Drawer / Modal */}
        {selectedNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted font-mono">
                      {selectedNotice.source_authority}
                    </span>
                    {selectedNotice.recall_class && (
                      <StatusChip
                        label={selectedNotice.recall_class.replace('_', ' ')}
                        tone={getClassTone(selectedNotice.recall_class)}
                      />
                    )}
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-heading">{selectedNotice.notice_number}</h3>
                  <div className="text-xs text-muted">{selectedNotice.title}</div>
                </div>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-raised hover:text-heading"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Notice Metadata */}
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-surface-sunken p-3 text-xs space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted">Target Product:</span>
                    <span className="font-semibold text-heading">{selectedNotice.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Manufacturer:</span>
                    <span className="text-heading">{selectedNotice.manufacturer || 'Not Specified'}</span>
                  </div>
                  {selectedNotice.batch_numbers && selectedNotice.batch_numbers.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">Affected Batches:</span>
                      <span className="text-heading">{selectedNotice.batch_numbers.join(', ')}</span>
                    </div>
                  )}
                  {selectedNotice.reason && (
                    <div className="flex justify-between">
                      <span className="text-muted">Regulatory Defect:</span>
                      <span className="text-heading">{selectedNotice.reason}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border/50 pt-2">
                    <span className="text-muted">Official Source SHA256:</span>
                    <span className="text-muted truncate max-w-[280px]">
                      {selectedNotice.source_checksum || 'Cached reference digest'}
                    </span>
                  </div>
                </div>

                {/* Operational Exposure Section */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-heading uppercase tracking-wider">
                      Dataset Operational Exposure
                    </h4>
                    {getMatchBadge(selectedNotice.exposure)}
                  </div>

                  {selectedNotice.exposure ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-lg border border-border p-3 text-xs text-body">
                        <span className="font-semibold text-heading">Match Reasoning: </span>
                        {selectedNotice.exposure.match_reason}
                      </div>

                      {selectedNotice.exposure.affected_orders_count > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase text-muted">
                            Impacted Procurement Orders ({selectedNotice.exposure.affected_orders_count})
                          </div>
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-surface-sunken text-muted">
                                <tr>
                                  <th className="p-2">Order ID</th>
                                  <th className="p-2">Date</th>
                                  <th className="p-2">Filled / Requested</th>
                                  <th className="p-2 text-right">Value (EGP)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {selectedNotice.exposure.evidence_json?.affectedOrders?.map((ord) => (
                                  <tr key={ord.orderId}>
                                    <td className="p-2 font-mono font-medium text-heading">
                                      {ord.externalOrderId}
                                    </td>
                                    <td className="p-2 text-muted">{ord.placedAt?.slice(0, 10)}</td>
                                    <td className="p-2">
                                      {ord.filledQty} / {ord.requestedQty} units
                                    </td>
                                    <td className="p-2 text-right font-mono font-semibold text-danger">
                                      {formatCurrency(ord.historicalValueMinor)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-muted italic">
                      No exposure evaluation recorded for active dataset.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-between border-t border-border pt-4">
                <a
                  href={selectedNotice.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-heading hover:bg-surface-raised"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Official Notice (edaegypt.gov.eg)
                </a>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="rounded-lg bg-surface-raised border border-border px-4 py-1.5 text-xs font-medium text-heading hover:bg-surface-sunken"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
