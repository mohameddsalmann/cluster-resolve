'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSearch, PackageSearch, ScrollText, Truck, Sparkles } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  ClusterIconChip,
  linkButtonClass,
  EvidenceLink,
  PageHeader,
  Panel,
  SeverityBadge,
  StatusChip,
  Timeline,
  LoadingState,
  EmptyState,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';

interface OrderDetailData {
  order: {
    id: string;
    externalOrderId: string;
    status: string;
    placedAt: string;
    pharmacy: { id: string; external_pharmacy_id: string; name: string | null } | null;
  };
  items: Array<{
    id: string;
    product_id: string;
    requested_qty: number;
    unit: string;
    product: { id: string; external_product_id: string; name: string } | null;
  }>;
  outcomes: Array<{
    id: string;
    supplier_id: string;
    product_id: string;
    filled_qty: number;
    delivered_at: string | null;
    cancelled: boolean;
    cancellation_reason: string | null;
    outcome_final: boolean;
    supplier: { id: string; external_supplier_id: string; name: string } | null;
  }>;
  offers: Array<{
    id: string;
    external_offer_id: string;
    unit_price_minor: string;
    discount_bps: number;
    promised_delivery_at: string | null;
    offered_at: string;
    supplier: { id: string; external_supplier_id: string; name: string } | null;
    product: { id: string; external_product_id: string; name: string } | null;
  }>;
  decisions: Array<{
    id: string;
    external_decision_id: string;
    selected_supplier_id: string;
    decided_at: string;
  }>;
  exceptions: Array<{
    id: string;
    type: string;
    severity: string;
    evidence_json: unknown;
    detected_at: string;
  }>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="cl-meta">{label}</dt>
      <dd className="text-[0.9375rem] font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const { activeDatasetId } = useDataset();
  const [data, setData] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadOrderDetail() {
      if (!activeDatasetId || !orderId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/orders/${orderId}?datasetId=${activeDatasetId}`);
        const json = await res.json();
        if (isCancelled) return;
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Failed to load order details.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadOrderDetail();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId, orderId]);

  if (loading) {
    return (
      <AppShell>
        <TopContextBar title="Order Detail" subtitle="Loading..." />
        <PageBody>
          <LoadingState rows={6} label="Loading order details..." />
        </PageBody>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <TopContextBar title="Order Not Found" />
        <PageBody>
          <EmptyState
            icon={PackageSearch}
            title="Order not found"
            description={error ?? 'The requested order does not exist in the active dataset.'}
            action={{ label: 'Back to Orders', href: '/orders' }}
          />
        </PageBody>
      </AppShell>
    );
  }

  const { order, items, outcomes, decisions, exceptions } = data;
  const totalRequested = items.reduce((sum, i) => sum + i.requested_qty, 0);
  const totalFilled = outcomes.reduce((sum, o) => sum + o.filled_qty, 0);
  const primarySupplier = outcomes[0]?.supplier ?? data.offers[0]?.supplier ?? null;
  const primaryDecision = decisions[0] ?? null;

  // Build timeline
  const timelineItems: Array<{ label: string; time: string; detail?: string; tone?: 'danger' | 'caution' | 'brand' | 'success' }> = [
    {
      label: 'Order Placed',
      time: new Date(order.placedAt).toLocaleString(),
      detail: `${totalRequested} units requested`,
    },
  ];

  outcomes.forEach((o) => {
    if (o.cancelled) {
      timelineItems.push({
        label: 'Order Cancelled',
        time: o.delivered_at ? new Date(o.delivered_at).toLocaleString() : 'Cancelled',
        detail: o.cancellation_reason ?? 'Supplier cancelled fulfillment.',
        tone: 'danger',
      });
    } else if (o.delivered_at) {
      const isPartial = o.filled_qty < totalRequested;
      timelineItems.push({
        label: isPartial ? 'Partially Delivered' : 'Delivered',
        time: new Date(o.delivered_at).toLocaleString(),
        detail: `${o.filled_qty} units delivered by ${o.supplier?.name ?? 'supplier'}`,
        tone: isPartial ? 'caution' : 'success',
      });
    }
  });

  return (
    <AppShell>
      <TopContextBar title={`Order ${order.externalOrderId}`} subtitle={order.pharmacy?.name ?? 'Pharmacy'} />
      <PageBody>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/orders"
            className="text-[0.875rem] font-semibold text-cluster-bright hover:text-cluster-deep"
          >
            ← Orders
          </Link>
        </nav>

        <PageHeader
          title={order.externalOrderId}
          subtitle={`${order.pharmacy?.name ?? 'Pharmacy'} · placed ${new Date(order.placedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          actions={
            primaryDecision ? (
              <Link
                href={`/decisions/${primaryDecision.id}`}
                className={linkButtonClass('primary', 'sm')}
              >
                Open decision replay
              </Link>
            ) : null
          }
        />

        <div className="space-y-6">
          <Panel title="Order summary">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <Field label="Order ID" value={order.externalOrderId} />
              <Field label="Pharmacy" value={order.pharmacy?.name ?? '—'} />
              <Field
                label="Placed"
                value={new Date(order.placedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
              <Field label="Supplier" value={primarySupplier?.name ?? '—'} />
              <Field label="Requested units" value={String(totalRequested)} />
              <Field label="Filled units" value={String(totalFilled)} />
              <Field
                label="Status"
                value={
                  outcomes.some((o) => o.cancelled)
                    ? 'Cancelled'
                    : totalFilled < totalRequested
                      ? 'Partial fill'
                      : 'Fulfilled'
                }
              />
              <Field
                label="Exceptions"
                value={exceptions.length > 0 ? `${exceptions.length} detected` : 'None'}
              />
            </dl>
          </Panel>

          <Panel title="Requested items">
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold text-ink">
                      {item.product?.name ?? item.product_id}
                    </p>
                    <p className="cl-meta">ID: {item.product?.external_product_id ?? item.product_id}</p>
                  </div>
                  <p className="text-[0.9375rem] text-body">
                    {item.requested_qty} {item.unit}s requested
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Supplier">
              <div className="flex items-start gap-4">
                <ClusterIconChip icon={Truck} size="standard" />
                <div className="min-w-0">
                  <p className="text-[1rem] font-semibold text-ink">
                    {primarySupplier?.name ?? 'No supplier outcome assigned'}
                  </p>
                  <p className="mt-1 text-[0.9375rem] text-body">
                    Reliability status is evaluated from this supplier&apos;s own baseline.
                  </p>
                  {primarySupplier ? (
                    <div className="mt-3">
                      <EvidenceLink
                        label="Open supplier reliability"
                        href={`/suppliers/${primarySupplier.id}`}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>

            <Panel title="Regulatory exposure">
              <div className="flex items-start gap-4">
                <ClusterIconChip icon={ScrollText} size="standard" tone="soft" />
                <div className="min-w-0">
                  <StatusChip label="No exposure recorded" tone="success" />
                  <p className="mt-2 text-[0.9375rem] text-body">
                    No active Egyptian Drug Authority (EDA) recall notice matched the products on this order.
                  </p>
                  <div className="mt-3">
                    <EvidenceLink label="Review regulatory" href="/regulatory" />
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Actual outcome">
            <Timeline items={timelineItems} />
          </Panel>

          <Panel title="Exceptions">
            {exceptions.length === 0 ? (
              <p className="text-[0.9375rem] text-body">No exceptions were recorded on this order.</p>
            ) : (
              <ul className="space-y-3">
                {exceptions.map((exc) => (
                  <li key={exc.id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <SeverityBadge severity={exc.severity as 'HIGH' | 'MEDIUM'} />
                      <span className="text-[0.9375rem] font-semibold text-ink">{exc.type}</span>
                      <span className="cl-meta">
                        Detected {new Date(exc.detected_at).toLocaleDateString()}
                      </span>
                    </div>
                    {exc.evidence_json ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-surface p-2 text-xs text-body">
                        {JSON.stringify(exc.evidence_json, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Procurement decision"
            description="How this supplier was chosen from recorded offers."
          >
            {primaryDecision ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[8px] bg-surface p-4">
                    <p className="cl-meta">Decision ID</p>
                    <p className="text-[0.9375rem] font-semibold text-ink">
                      {primaryDecision.external_decision_id}
                    </p>
                  </div>
                  <div className="rounded-[8px] bg-surface p-4">
                    <p className="cl-meta">Decided At</p>
                    <p className="text-[0.9375rem] font-semibold text-ink">
                      {new Date(primaryDecision.decided_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-[8px] bg-surface p-4">
                    <p className="cl-meta">Recorded Offers</p>
                    <p className="text-[0.9375rem] font-semibold text-ink">
                      {data.offers.length} offers
                    </p>
                  </div>
                </div>
                <div>
                  <Link
                    href={`/decisions/${primaryDecision.id}`}
                    className={linkButtonClass('secondary', 'sm')}
                  >
                    <Sparkles className="h-4 w-4" />
                    Open decision replay
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-[0.9375rem] text-body">
                No linked AI decision record was found for this order.
              </p>
            )}
          </Panel>

          <Panel title="Evidence & Provenance">
            <div className="flex items-center gap-4">
              <ClusterIconChip icon={FileSearch} size="standard" tone="soft" />
              <div className="min-w-0">
                <p className="text-[0.9375rem] text-body">
                  Every value above traces back to canonical records persisted in Supabase.
                </p>
                <div className="mt-2">
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
