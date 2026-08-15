'use client';

import { use, useEffect, useMemo, useState } from 'react';
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
import { generateCoachingInsights } from '@cluster/core/supplier/coach';
import { calculatePromiseRiskMetrics } from '@cluster/core/supplier/promise-risk';
import type {
  CoachingInsight,
  PromiseRiskMetrics,
  SupplierReliabilityEvaluation,
} from '@cluster/core/supplier/types';

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
    promise_risk_json: unknown;
  } | null;
  productSnapshots: Array<{
    product_id: string;
    status: string;
    recent_evaluated_orders: number;
    recent_fill_rate_bps: number | null;
    recent_otif_rate_bps: number | null;
    recent_cancellation_rate_bps: number | null;
    triggers_json: unknown;
  }>;
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

const statusLabel: Record<string, string> = {
  HEALTHY: 'Healthy',
  WATCH: 'Watch',
  HIGH: 'High Risk',
  INSUFFICIENT_DATA: 'Insufficient Data',
};

const coachingSeverityTone: Record<CoachingInsight['severity'], ChipTone> = {
  CRITICAL: 'danger',
  WARN: 'caution',
  INFO: 'neutral',
};

const promiseRiskTone: Record<string, ChipTone> = {
  LOW: 'success',
  MEDIUM: 'caution',
  HIGH: 'danger',
  INSUFFICIENT_DATA: 'neutral',
};

function bpsToPercent(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return '—';
  return `${(bps / 100).toFixed(0)}%`;
}

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

  // Derive coaching insights and promise risk from the loaded snapshot data
  const { coachingInsights, promiseRisk } = useMemo<{
    coachingInsights: CoachingInsight[];
    promiseRisk: PromiseRiskMetrics | null;
  }>(() => {
    if (!data?.latestReliability) return { coachingInsights: [], promiseRisk: null };
    const rel = data.latestReliability;

    // Reconstruct SupplierReliabilityEvaluation from snapshot
    const triggers = Array.isArray(rel.triggers_json) ? rel.triggers_json : [];
    const evaluation: SupplierReliabilityEvaluation = {
      datasetId: activeDatasetId ?? '',
      supplierId,
      asOf: rel.as_of_date,
      recentWindowDays: 14,
      baselineWindowDays: 30,
      recent: {
        evaluatedOrders: rel.recent_evaluated_orders,
        fillRateBps: rel.recent_fill_rate_bps,
        otifRateBps: rel.recent_otif_rate_bps,
        cancellationRateBps: rel.recent_cancellation_rate_bps,
        partialFillRateBps: rel.recent_partial_fill_rate_bps,
        leadTimeP50Minutes: rel.recent_lead_time_p50_minutes,
        leadTimeP95Minutes: rel.recent_lead_time_p95_minutes,
      },
      baseline: {
        evaluatedOrders: rel.baseline_evaluated_orders,
        fillRateBps: rel.baseline_fill_rate_bps,
        otifRateBps: rel.baseline_otif_rate_bps,
        cancellationRateBps: rel.baseline_cancellation_rate_bps,
        partialFillRateBps: rel.baseline_partial_fill_rate_bps,
        leadTimeP50Minutes: null,
        leadTimeP95Minutes: rel.baseline_lead_time_p95_minutes,
      },
      status: rel.status,
      triggers: triggers as SupplierReliabilityEvaluation['triggers'],
      recentOrderIds: [],
      baselineOrderIds: [],
    };

    // Promise risk from the persisted promise_risk_json field
    let computedPromiseRisk: PromiseRiskMetrics | null = null;
    if (rel.promise_risk_json && typeof rel.promise_risk_json === 'object') {
      const pr = rel.promise_risk_json as Record<string, unknown>;
      if (typeof pr['promiseRiskLevel'] === 'string') {
        computedPromiseRisk = {
          promiseGivenCount: typeof pr['promiseGivenCount'] === 'number' ? pr['promiseGivenCount'] : 0,
          promiseHonouredCount: typeof pr['promiseHonouredCount'] === 'number' ? pr['promiseHonouredCount'] : 0,
          promiseHonouredBps: typeof pr['promiseHonouredBps'] === 'number' ? pr['promiseHonouredBps'] : null,
          promiseRiskLevel: pr['promiseRiskLevel'] as PromiseRiskMetrics['promiseRiskLevel'],
        };
      }
    }

    return {
      coachingInsights: generateCoachingInsights(evaluation, computedPromiseRisk),
      promiseRisk: computedPromiseRisk,
    };
  }, [data, activeDatasetId, supplierId]);

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

  const { supplier, latestReliability, affectedOrders, decisions, productSnapshots } = data;
  const status = latestReliability?.status ?? 'INSUFFICIENT_DATA';
  const label = status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT DATA' : status;

  const fillRateRecent = bpsToPercent(latestReliability?.recent_fill_rate_bps);
  const fillRateBaseline = bpsToPercent(latestReliability?.baseline_fill_rate_bps);
  const otifRecent = bpsToPercent(latestReliability?.recent_otif_rate_bps);
  const otifBaseline = bpsToPercent(latestReliability?.baseline_otif_rate_bps);
  const cancelRecent = bpsToPercent(latestReliability?.recent_cancellation_rate_bps);
  const cancelBaseline = bpsToPercent(latestReliability?.baseline_cancellation_rate_bps);
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
          {/* Reliability overview */}
          <section aria-label="Reliability overview">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Fill rate" value={fillRateRecent} coverage="Recent window" />
              <Metric label="OTIF" value={otifRecent} coverage="Recent window" />
              <Metric label="Cancellation" value={cancelRecent} coverage="Recent window" />
              <Metric label="P95 lead time" value={p95LeadRecent} coverage="Recent window" />
            </div>
          </section>

          {/* Baseline comparison */}
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

          {/* Performance Coach — NEW in Chunk 3 */}
          <Panel
            title="Performance Coach"
            description="Deterministic evidence-backed insights derived from evaluation data."
          >
            {coachingInsights.length === 0 ? (
              <p className="text-[0.9375rem] text-body">No coaching insights available — insufficient evaluation data.</p>
            ) : (
              <ul className="space-y-4">
                {coachingInsights.map((insight, idx) => (
                  <li key={idx} className="flex gap-3">
                    <StatusChip
                      label={insight.severity}
                      tone={coachingSeverityTone[insight.severity]}
                    />
                    <p className="text-[0.9375rem] text-ink leading-relaxed">{insight.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Promise Fidelity — NEW in Chunk 3 */}
          <Panel
            title="Promise fidelity"
            description="How reliably this supplier honours promised delivery dates."
          >
            {promiseRisk === null ? (
              <p className="text-[0.9375rem] text-body">Promise risk data not yet computed. Re-run evaluation to generate.</p>
            ) : promiseRisk.promiseRiskLevel === 'INSUFFICIENT_DATA' ? (
              <p className="text-[0.9375rem] text-body">
                Fewer than 5 orders had a promised delivery date. More data is needed to evaluate promise fidelity.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric
                  label="Promise risk"
                  value={promiseRisk.promiseRiskLevel}
                  coverage="Based on honoured vs given promises"
                  state={{ label: promiseRisk.promiseRiskLevel, tone: promiseRiskTone[promiseRisk.promiseRiskLevel] ?? 'neutral' }}
                />
                <Metric
                  label="Promises given"
                  value={String(promiseRisk.promiseGivenCount)}
                  coverage="Orders with a promised delivery date"
                />
                <Metric
                  label="Promises honoured"
                  value={`${promiseRisk.promiseHonouredCount} (${bpsToPercent(promiseRisk.promiseHonouredBps)})`}
                  coverage="Delivered on or before promised date"
                />
              </div>
            )}
          </Panel>

          {/* Product Breakdown — NEW in Chunk 3 */}
          {productSnapshots && productSnapshots.length > 0 && (
            <Panel
              title="Product breakdown"
              description="Per-product reliability evaluated independently against the same baseline policy."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-[0.875rem]" aria-label="Product reliability breakdown">
                  <thead>
                    <tr className="border-b border-line text-left text-body">
                      <th className="pb-2 pr-4 font-medium">Product</th>
                      <th className="pb-2 pr-4 font-medium text-right">Status</th>
                      <th className="pb-2 pr-4 font-medium text-right">Orders</th>
                      <th className="pb-2 pr-4 font-medium text-right">Fill Rate</th>
                      <th className="pb-2 pr-4 font-medium text-right">OTIF</th>
                      <th className="pb-2 font-medium text-right">Cancellation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {productSnapshots.map((ps) => {
                      const productStatus = (ps.status ?? 'INSUFFICIENT_DATA') as string;
                      return (
                        <tr key={String(ps.product_id)} className="hover:bg-[rgba(15,110,255,0.02)]">
                          <td className="py-3 pr-4 font-mono text-xs text-ink">{String(ps.product_id).slice(0, 8)}…</td>
                          <td className="py-3 pr-4 text-right">
                            <StatusChip
                              label={statusLabel[productStatus] ?? productStatus}
                              tone={statusTone[productStatus] ?? 'neutral'}
                            />
                          </td>
                          <td className="py-3 pr-4 text-right text-ink">{ps.recent_evaluated_orders ?? 0}</td>
                          <td className="py-3 pr-4 text-right text-ink">{bpsToPercent(ps.recent_fill_rate_bps)}</td>
                          <td className="py-3 pr-4 text-right text-ink">{bpsToPercent(ps.recent_otif_rate_bps)}</td>
                          <td className="py-3 text-right text-ink">{bpsToPercent(ps.recent_cancellation_rate_bps)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* Deterioration triggers */}
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
