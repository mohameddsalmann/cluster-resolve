'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Truck } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  ComparisonMetric,
  EvidenceLink,
  Metric,
  PageHeader,
  Panel,
  StatusChip,
  LoadingState,
  EmptyState,
  type ChipTone,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';

interface SupplierDetailData {
  supplier: {
    id: string;
    external_supplier_id: string;
    name: string;
  };
  latestReliability: {
    supplier_id: string;
    as_of_date: string;
    status: 'HEALTHY' | 'WATCH' | 'HIGH' | 'INSUFFICIENT_DATA';
    recent_evaluated_orders: number;
    baseline_evaluated_orders: number;
    recent_fill_rate_bps: number | null;
    baseline_fill_rate_bps: number | null;
    recent_otif_rate_bps: number | null;
    baseline_otif_rate_bps: number | null;
    recent_cancellation_rate_bps: number | null;
    baseline_cancellation_rate_bps: number | null;
    recent_partial_fill_rate_bps: number | null;
    baseline_partial_fill_rate_bps: number | null;
    recent_lead_time_p50_minutes: number | null;
    recent_lead_time_p95_minutes: number | null;
    baseline_lead_time_p95_minutes: number | null;
    triggers_json: unknown;
  } | null;
  snapshots: Array<Record<string, unknown>>;
  exceptions: Array<{
    id: string;
    order_id: string;
    type: string;
    severity: string;
    detected_at: string;
  }>;
  affectedOrders: Array<{
    id: string;
    external_order_id: string;
    status: string;
    placed_at: string;
  }>;
  decisions: Array<{
    id: string;
    external_decision_id: string;
    order_id: string;
    decided_at: string;
  }>;
}

const statusTone: Record<string, ChipTone> = {
  HEALTHY: 'success',
  WATCH: 'caution',
  HIGH: 'danger',
  INSUFFICIENT_DATA: 'neutral',
};

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params);
  const { activeDatasetId } = useDataset();
  const [data, setData] = useState<SupplierDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSupplierDetail() {
      if (!activeDatasetId || !supplierId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/suppliers/${supplierId}?datasetId=${activeDatasetId}`);
        const json = await res.json();
        if (isCancelled) return;
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Failed to load supplier detail.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadSupplierDetail();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId, supplierId]);

  if (loading) {
    return (
      <AppShell>
        <TopContextBar title="Supplier Detail" subtitle="Loading..." />
        <PageBody>
          <LoadingState rows={6} label="Loading supplier reliability detail..." />
        </PageBody>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <TopContextBar title="Supplier Not Found" />
        <PageBody>
          <EmptyState
            icon={Truck}
            title="Supplier not found"
            description={error ?? 'The requested supplier does not exist in the active dataset.'}
            action={{ label: 'Back to Suppliers', href: '/suppliers' }}
          />
        </PageBody>
      </AppShell>
    );
  }

  const { supplier, latestReliability, affectedOrders, decisions } = data;
  const status = latestReliability?.status ?? 'INSUFFICIENT_DATA';
  const label = status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT DATA' : status;

  const fillRateRecent =
    latestReliability?.recent_fill_rate_bps !== null && latestReliability?.recent_fill_rate_bps !== undefined
      ? `${(latestReliability.recent_fill_rate_bps / 100).toFixed(0)}%`
      : '—';
  const fillRateBaseline =
    latestReliability?.baseline_fill_rate_bps !== null && latestReliability?.baseline_fill_rate_bps !== undefined
      ? `${(latestReliability.baseline_fill_rate_bps / 100).toFixed(0)}%`
      : '—';

  const otifRecent =
    latestReliability?.recent_otif_rate_bps !== null && latestReliability?.recent_otif_rate_bps !== undefined
      ? `${(latestReliability.recent_otif_rate_bps / 100).toFixed(0)}%`
      : '—';
  const otifBaseline =
    latestReliability?.baseline_otif_rate_bps !== null && latestReliability?.baseline_otif_rate_bps !== undefined
      ? `${(latestReliability.baseline_otif_rate_bps / 100).toFixed(0)}%`
      : '—';

  const cancelRecent =
    latestReliability?.recent_cancellation_rate_bps !== null &&
    latestReliability?.recent_cancellation_rate_bps !== undefined
      ? `${(latestReliability.recent_cancellation_rate_bps / 100).toFixed(0)}%`
      : '—';
  const cancelBaseline =
    latestReliability?.baseline_cancellation_rate_bps !== null &&
    latestReliability?.baseline_cancellation_rate_bps !== undefined
      ? `${(latestReliability.baseline_cancellation_rate_bps / 100).toFixed(0)}%`
      : '—';

  const p95LeadRecent =
    latestReliability?.recent_lead_time_p95_minutes !== null &&
    latestReliability?.recent_lead_time_p95_minutes !== undefined
      ? `${Math.round(latestReliability.recent_lead_time_p95_minutes / 60)}h`
      : '—';

  const triggers = Array.isArray(latestReliability?.triggers_json)
    ? (latestReliability.triggers_json as Array<{
        code: string;
        delta?: number;
        recent?: number;
        baseline?: number;
        threshold?: number;
        severe?: boolean;
      }>)
    : [];

  return (
    <AppShell>
      <TopContextBar
        title={supplier.name}
        subtitle={`${supplier.external_supplier_id} · reliability detail`}
      />
      <PageBody>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/suppliers"
            className="text-[0.875rem] font-semibold text-cluster-bright hover:text-cluster-deep"
          >
            ← Suppliers
          </Link>
        </nav>

        <PageHeader
          title={supplier.name}
          subtitle={`${supplier.external_supplier_id} · ${latestReliability?.recent_evaluated_orders ?? 0} recent evaluated orders`}
          actions={<StatusChip label={label} tone={statusTone[status] ?? 'neutral'} />}
        />

        <div className="space-y-6">
          <section aria-label="Reliability overview">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Fill rate" value={fillRateRecent} coverage="Recent window" />
              <Metric label="OTIF" value={otifRecent} coverage="Recent window" />
              <Metric label="Cancellation" value={cancelRecent} coverage="Recent window" />
              <Metric label="P95 lead time" value={p95LeadRecent} coverage="Recent window" />
            </div>
          </section>

          {status !== 'INSUFFICIENT_DATA' ? (
            <Panel
              title="Recent vs baseline"
              description="Comparison against this supplier's own historical baseline."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <ComparisonMetric label="Fill rate" baseline={fillRateBaseline} recent={fillRateRecent} />
                <ComparisonMetric label="OTIF" baseline={otifBaseline} recent={otifRecent} />
                <ComparisonMetric
                  label="Cancellation"
                  baseline={cancelBaseline}
                  recent={cancelRecent}
                  direction="up-bad"
                />
              </div>
            </Panel>
          ) : (
            <Panel title="Insufficient History">
              <p className="text-[0.9375rem] text-body">
                This supplier has fewer evaluated orders than the minimum required baseline sample (10 orders). Reliability signals will activate once additional order outcomes are recorded.
              </p>
            </Panel>
          )}

          <Panel title="Why flagged / Deterioration triggers">
            {triggers.length === 0 ? (
              <p className="text-[0.9375rem] text-body">
                {status === 'HEALTHY'
                  ? 'No deterioration triggers detected. Performance remains stable against baseline.'
                  : 'No active triggers recorded.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {triggers.map((t, idx) => (
                  <li key={idx} className="flex flex-wrap items-center gap-3">
                    <StatusChip
                      label={t.code}
                      tone={t.severe ? 'danger' : 'caution'}
                    />
                    <p className="text-[0.9375rem] text-ink">
                      {t.code === 'FILL_RATE_DROP'
                        ? `Fill rate fell ${t.delta ? (t.delta / 100).toFixed(1) : ''} pts below baseline.`
                        : t.code === 'OTIF_DROP'
                          ? `On-time in-full rate fell ${t.delta ? (t.delta / 100).toFixed(1) : ''} pts below baseline.`
                          : t.code === 'CANCELLATION_INCREASE'
                            ? `Cancellations increased by ${t.delta ? (t.delta / 100).toFixed(1) : ''} pts.`
                            : t.code === 'PARTIAL_FILL_INCREASE'
                              ? `Partial fulfillment increased by ${t.delta ? (t.delta / 100).toFixed(1) : ''} pts.`
                              : t.code === 'LEAD_TIME_P95_DETERIORATION'
                                ? `P95 delivery lead time increased by ${t.delta ? Math.round(t.delta / 60) : ''}h.`
                                : `Trigger condition: ${t.code}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Affected orders">
              {affectedOrders.length === 0 ? (
                <p className="text-[0.9375rem] text-body">No orders assigned to this supplier in this dataset.</p>
              ) : (
                <ul className="divide-y divide-line max-h-72 overflow-y-auto">
                  {affectedOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="text-[0.9375rem] font-semibold text-ink">
                        {o.external_order_id}
                      </span>
                      <EvidenceLink label="View order" href={`/orders/${o.id}`} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Affected decisions">
              {decisions.length === 0 ? (
                <p className="text-[0.9375rem] text-body">No decisions selected this supplier yet.</p>
              ) : (
                <ul className="divide-y divide-line max-h-72 overflow-y-auto">
                  {decisions.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="text-[0.9375rem] font-semibold text-ink">
                        {d.external_decision_id}
                      </span>
                      <EvidenceLink label="Open decision" href={`/decisions/${d.id}`} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </AppShell>
  );
}
