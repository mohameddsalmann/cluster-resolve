'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileSearch,
  Truck,
  XCircle,
  TrendingDown,
  Scale,
} from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  ClusterIconChip,
  EvidenceLink,
  PageHeader,
  Panel,
  StatusChip,
  LoadingState,
  EmptyState,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';
import type { DecisionReplayResult } from '@cluster/core/decisions';

function formatEgpMinor(minor: bigint | string | number | null | undefined): string {
  if (minor === null || minor === undefined) return '—';
  const val = typeof minor === 'bigint' ? minor : BigInt(minor);
  const whole = val / 100n;
  const frac = val % 100n;
  return `EGP ${whole.toLocaleString()}.${frac.toString().padStart(2, '0')}`;
}

export default function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: decisionId } = use(params);
  const { activeDatasetId } = useDataset();
  const [data, setData] = useState<DecisionReplayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadReplay() {
      if (!activeDatasetId || !decisionId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/decisions/${decisionId}?datasetId=${activeDatasetId}`);
        const json = await res.json();
        if (isCancelled) return;
        if (!res.ok || json.error) {
          throw new Error(json.error ?? 'Failed to load decision replay.');
        }
        setData(json);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Error loading replay.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadReplay();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId, decisionId]);

  if (loading) {
    return (
      <AppShell>
        <TopContextBar title="Decision Replay" subtitle="Reconstructing decision-time facts..." />
        <PageBody>
          <LoadingState rows={6} label="Reconstructing procurement decision evidence..." />
        </PageBody>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <TopContextBar title="Decision Replay" subtitle="Error" />
        <PageBody>
          <EmptyState
            icon={Scale}
            title="Decision replay unavailable"
            description={error ?? 'The requested decision could not be found in the active dataset.'}
            action={{ label: 'Back to Orders', href: '/orders' }}
          />
        </PageBody>
      </AppShell>
    );
  }

  const {
    classification,
    classificationReason,
    orderId,
    externalOrderId,
    orderPlacedAt,
    pharmacyName,
    decidedAt,
    agentName,
    agentVersion,
    confidence,
    selectionReason,
    orderItems,
    totalRequestedUnits,
    selectedSupplier,
    selectedCandidate,
    selectedActualOutcome,
    dominatingSupplier,
    quotedPriceGapMinor,
    promisedDeliveryGapMinutes,
    actualSelectedShortfallUnits,
    actualSelectedLatenessMinutes,
    consideredOffersCount,
    futureOffersExcludedCount,
    candidates,
  } = data;

  const classificationTone =
    classification === 'DOMINATED'
      ? 'danger'
      : classification === 'NON_DOMINATED'
        ? 'success'
        : classification === 'SELECTED_NOT_FEASIBLE'
          ? 'danger'
          : 'neutral';

  return (
    <AppShell>
      <TopContextBar
        title={`Decision ${data.externalDecisionId}`}
        subtitle={`Order ${externalOrderId} · ${pharmacyName ?? 'Pharmacy'} · ${classification}`}
      />
      <PageBody wide>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href={`/orders/${orderId}`}
            className="inline-flex items-center gap-1 text-[0.875rem] font-semibold text-cluster-bright hover:text-cluster-deep"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Order {externalOrderId}
          </Link>
        </nav>

        <PageHeader
          title={`Forensic Decision Replay — ${data.externalDecisionId}`}
          subtitle={`Order placed ${new Date(orderPlacedAt).toLocaleDateString()} · Decided ${new Date(decidedAt).toLocaleString()} by ${agentName ?? 'AI Agent'} (${agentVersion ?? 'v1.0'})${confidence ? ` · Confidence: ${confidence}` : ''}`}
          actions={<StatusChip label={classification.replace(/_/g, ' ')} tone={classificationTone} />}
        />

        <div className="space-y-6">
          {/* Quality Classification & Factual Regret Banner */}
          <Panel
            title="Decision Quality Assessment"
            description="Evaluated against feasible supplier offers submitted at or before the decision timestamp."
            action={<StatusChip label={classification} tone={classificationTone} />}
          >
            <div className="space-y-4">
              <div
                className={`rounded-[8px] p-4 border ${
                  classification === 'DOMINATED'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : classification === 'NON_DOMINATED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  {classification === 'DOMINATED' ? (
                    <TrendingDown className="h-5 w-5 shrink-0 text-danger mt-0.5" />
                  ) : classification === 'NON_DOMINATED' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{classificationReason}</p>
                    {classification === 'DOMINATED' && dominatingSupplier && (
                      <p className="mt-1 text-xs">
                        Alternative supplier <strong>{dominatingSupplier.supplierName}</strong> was fully feasible,
                        cheaper or faster, and strictly dominated the chosen supplier.
                      </p>
                    )}
                    {classification === 'NON_DOMINATED' && (
                      <p className="mt-1 text-xs">
                        No dominating alternative existed among decision-time quotes (any alternative was either more expensive, slower, or infeasible).
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Factual Regret Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-[8px] bg-surface p-4 border border-line">
                  <dt className="cl-meta">Quoted Price Gap</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">
                    {quotedPriceGapMinor ? formatEgpMinor(quotedPriceGapMinor) : '0.00 EGP'}
                  </dd>
                  <p className="text-xs text-body mt-1">
                    {quotedPriceGapMinor ? 'Direct quote difference vs dominating quote' : 'No price regret detected'}
                  </p>
                </div>

                <div className="rounded-[8px] bg-surface p-4 border border-line">
                  <dt className="cl-meta">Promised Delivery Gap</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">
                    {promisedDeliveryGapMinutes !== null ? `${promisedDeliveryGapMinutes} min` : '0 min'}
                  </dd>
                  <p className="text-xs text-body mt-1">
                    {promisedDeliveryGapMinutes ? 'Alternative promised earlier delivery' : 'No delivery delay vs alternative'}
                  </p>
                </div>

                <div className="rounded-[8px] bg-surface p-4 border border-line">
                  <dt className="cl-meta">Actual Fill Shortfall</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">
                    {actualSelectedShortfallUnits !== null ? `${actualSelectedShortfallUnits} units` : '—'}
                  </dd>
                  <p className="text-xs text-body mt-1">
                    {actualSelectedShortfallUnits && actualSelectedShortfallUnits > 0
                      ? 'Realized units undelivered by chosen supplier'
                      : 'Full delivery realized or pending'}
                  </p>
                </div>

                <div className="rounded-[8px] bg-surface p-4 border border-line">
                  <dt className="cl-meta">Actual Selected Lateness</dt>
                  <dd className="mt-1 text-lg font-bold text-ink">
                    {actualSelectedLatenessMinutes !== null && actualSelectedLatenessMinutes > 0
                      ? `${actualSelectedLatenessMinutes} min`
                      : 'On-time / Not late'}
                  </dd>
                  <p className="text-xs text-body mt-1">
                    {actualSelectedLatenessMinutes && actualSelectedLatenessMinutes > 0
                      ? 'Realized delivery time past promised quote'
                      : 'Delivered within promised window'}
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          {/* Temporal Guarantee Notice */}
          <div className="rounded-[8px] border border-blue-200 bg-blue-50/70 p-4 text-blue-900 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold">Temporal Guarantee:</span> Only offers submitted at or before{' '}
                <span className="font-mono">{new Date(decidedAt).toISOString()}</span> were considered.
              </div>
            </div>
            <div className="text-xs font-mono font-semibold text-blue-800">
              {consideredOffersCount} offers evaluated · {futureOffersExcludedCount} future offers strictly excluded
            </div>
          </div>

          {/* Two-Column: Selected Choice vs Realized Outcome */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Selected Decision Card */}
            <Panel title="Selected Decision & Quote">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <ClusterIconChip icon={Truck} size="standard" tone="brand" />
                  <div>
                    <h3 className="text-base font-bold text-ink">
                      {selectedSupplier?.name ?? 'Unknown Supplier'}
                    </h3>
                    <p className="cl-meta">ID: {selectedSupplier?.externalSupplierId ?? '—'}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-4 pt-2 border-t border-line">
                  <div>
                    <dt className="cl-meta">Total Quoted Price</dt>
                    <dd className="text-base font-bold text-ink">
                      {formatEgpMinor(selectedCandidate?.totalQuotedPriceMinor)}
                    </dd>
                  </div>
                  <div>
                    <dt className="cl-meta">Promised Delivery</dt>
                    <dd className="text-sm font-semibold text-ink">
                      {selectedCandidate?.maxPromisedDeliveryAt
                        ? new Date(selectedCandidate.maxPromisedDeliveryAt).toLocaleString()
                        : 'Unstated'}
                    </dd>
                  </div>
                  <div>
                    <dt className="cl-meta">Order Requirements</dt>
                    <dd className="text-sm text-body">
                      {orderItems.map((i) => `${i.requestedQty}x ${i.productName}`).join(', ')} ({totalRequestedUnits} units)
                    </dd>
                  </div>
                  <div>
                    <dt className="cl-meta">Selection Reason</dt>
                    <dd className="text-sm text-body italic">{selectionReason ?? 'None recorded'}</dd>
                  </div>
                </dl>
              </div>
            </Panel>

            {/* Actual Realized Execution */}
            <Panel title="Actual Selected Outcome">
              {selectedActualOutcome ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <ClusterIconChip
                      icon={selectedActualOutcome.cancelled ? XCircle : CheckCircle2}
                      size="standard"
                      tone="soft"
                    />
                    <div>
                      <h3 className="text-base font-bold text-ink">
                        {selectedActualOutcome.cancelled ? 'Order Cancelled' : 'Order Delivered'}
                      </h3>
                      <p className="cl-meta">
                        {selectedActualOutcome.deliveredAt
                          ? `Delivered ${new Date(selectedActualOutcome.deliveredAt).toLocaleString()}`
                          : selectedActualOutcome.cancelled
                            ? `Reason: ${selectedActualOutcome.cancellationReason ?? 'Cancelled'}`
                            : 'Outcome recorded'}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-4 pt-2 border-t border-line">
                    <div>
                      <dt className="cl-meta">Delivered Units</dt>
                      <dd className="text-base font-bold text-ink">
                        {selectedActualOutcome.filledQty} / {totalRequestedUnits}
                      </dd>
                    </div>
                    <div>
                      <dt className="cl-meta">Realized Fill Rate</dt>
                      <dd className="text-base font-bold text-ink">
                        {(selectedActualOutcome.fillRateBps / 100).toFixed(1)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="cl-meta">Outcome Status</dt>
                      <dd className="text-sm text-body">
                        {selectedActualOutcome.isFinal ? 'Final & Complete' : 'Interim'}
                      </dd>
                    </div>
                    <div>
                      <dt className="cl-meta">Supplier Reliability</dt>
                      <dd className="text-sm">
                        {selectedSupplier ? (
                          <EvidenceLink
                            label="View supplier profile"
                            href={`/suppliers/${selectedSupplier.id}`}
                          />
                        ) : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-body py-8 text-center">
                  No realized outcome record has been ingested for this order yet.
                </p>
              )}
            </Panel>
          </div>

          {/* Decision-Time Alternatives Table */}
          <Panel
            title="Decision-Time Supplier Quotes & Alternatives"
            description="Comparing all candidate suppliers with valid quotes submitted prior to the decision timestamp."
          >
            <div className="overflow-x-auto rounded-[8px] border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface border-b border-line text-xs font-semibold text-ink">
                  <tr>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Feasibility</th>
                    <th className="py-3 px-4">Total Quoted Price</th>
                    <th className="py-3 px-4">Promised Delivery</th>
                    <th className="py-3 px-4">Dominates Selected?</th>
                    <th className="py-3 px-4">Quote Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-white">
                  {candidates.map((cand) => {
                    const isSelected = cand.isSelected;
                    const isDom = cand.dominatesSelected;

                    return (
                      <tr
                        key={cand.supplierId}
                        className={
                          isSelected
                            ? 'bg-blue-50/40'
                            : isDom
                              ? 'bg-red-50/30'
                              : 'hover:bg-surface/50'
                        }
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-ink flex items-center gap-1.5">
                            {cand.supplierName}
                            {isSelected && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-blue-100 text-blue-800">
                                SELECTED
                              </span>
                            )}
                          </div>
                          <span className="cl-meta">ID: {cand.externalSupplierId}</span>
                        </td>

                        <td className="py-3 px-4">
                          {cand.isFeasible ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Feasible
                            </span>
                          ) : (
                            <div className="text-xs text-danger">
                              <span className="font-semibold inline-flex items-center gap-1">
                                <XCircle className="h-3.5 w-3.5" /> Infeasible
                              </span>
                              <p className="cl-meta mt-0.5 text-body">{cand.infeasibleReasons.join('; ')}</p>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-ink">
                          {formatEgpMinor(cand.totalQuotedPriceMinor)}
                        </td>

                        <td className="py-3 px-4 text-xs text-body font-mono">
                          {cand.maxPromisedDeliveryAt
                            ? new Date(cand.maxPromisedDeliveryAt).toLocaleString()
                            : 'Unstated'}
                        </td>

                        <td className="py-3 px-4">
                          {isSelected ? (
                            <span className="text-xs text-body italic">— (Selected choice)</span>
                          ) : isDom ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
                                DOMINATING
                              </span>
                              <p className="text-[0.6875rem] text-danger mt-1">
                                {cand.dominationReasons.join('; ')}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-body">No (Non-dominating)</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-xs font-mono text-body">
                          {cand.offers.map((o) => (
                            <div key={o.offerId} className="truncate max-w-xs">
                              {o.availableQty} units @ {formatEgpMinor(o.unitPriceMinor)} ({o.discountBps / 100}% off)
                            </div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Visual Price Comparison */}
          <Panel title="Quoted Price Comparison (EGP)">
            <div className="space-y-3">
              {candidates
                .filter((c) => c.isFeasible && c.totalQuotedPriceMinor !== null)
                .map((c) => {
                  const val = Number(BigInt(c.totalQuotedPriceMinor!) / 100n);
                  const maxVal = Math.max(...candidates.map((x) => Number(BigInt(x.totalQuotedPriceMinor ?? 0n) / 100n)), 1);
                  const widthPct = Math.max(10, Math.round((val / maxVal) * 100));

                  return (
                    <div key={c.supplierId} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-ink flex items-center gap-1.5">
                          {c.supplierName} {c.isSelected ? '(Selected)' : ''}
                          {c.dominatesSelected && (
                            <span className="text-[0.625rem] text-danger font-bold">DOMINATES</span>
                          )}
                        </span>
                        <span className="font-mono text-ink">{formatEgpMinor(c.totalQuotedPriceMinor)}</span>
                      </div>
                      <div className="h-4 rounded bg-surface overflow-hidden border border-line">
                        <div
                          className={`h-full rounded transition-all duration-300 ${
                            c.isSelected
                              ? 'bg-cluster-bright'
                              : c.dominatesSelected
                                ? 'bg-emerald-500'
                                : 'bg-slate-400'
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Panel>

          {/* Forensic Evidence & Data Provenance */}
          <Panel title="Forensic Evidence & Data Provenance">
            <div className="flex items-center gap-4">
              <ClusterIconChip icon={FileSearch} size="standard" tone="soft" />
              <div className="min-w-0">
                <p className="text-sm text-body">
                  All timestamps, quoted prices, and delivered quantities are verified from canonical records persisted in Supabase.
                </p>
                <div className="mt-2 flex items-center gap-4">
                  <EvidenceLink label="View order details" href={`/orders/${orderId}`} />
                  <EvidenceLink label="View dataset imports" href="/imports" />
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </PageBody>
    </AppShell>
  );
}
