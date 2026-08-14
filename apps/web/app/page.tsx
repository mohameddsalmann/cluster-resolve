'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  FileStack,
  PackageSearch,
  ScrollText,
  Sparkles,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  ClusterIconChip,
  linkButtonClass,
  Metric,
  PageHeader,
  SectionHeader,
  SeverityBadge,
  StatusChip,
  LoadingState,
  EmptyState,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';

interface OrderSummary {
  id: string;
  externalOrderId: string;
  status: string;
  placedAt: string;
  pharmacy: { id: string; name: string | null } | null;
  suppliers: Array<{ id: string; name: string }>;
  requestedUnits: number;
  filledUnits: number;
  deliveryState: string;
  exceptionSummary: {
    count: number;
    types: string[];
    highestSeverity: 'HIGH' | 'MEDIUM' | null;
  };
}

interface SupplierSummary {
  supplier: { id: string; external_supplier_id: string; name: string };
  reliability: {
    status: 'HEALTHY' | 'WATCH' | 'HIGH' | 'INSUFFICIENT_DATA';
    recent_evaluated_orders: number;
    baseline_evaluated_orders: number;
    recent_fill_rate_bps: number | null;
    baseline_fill_rate_bps: number | null;
    recent_otif_rate_bps: number | null;
    baseline_otif_rate_bps: number | null;
    recent_cancellation_rate_bps: number | null;
    baseline_cancellation_rate_bps: number | null;
    triggers_json: unknown;
  } | null;
}

interface AttentionItem {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'order' | 'supplier' | 'import';
  title: string;
  reason: string;
  entity: string;
  time: string;
  impact: string;
  href: string;
}

const typeIcon = {
  order: PackageSearch,
  supplier: Truck,
  regulatory: ScrollText,
  decision: Sparkles,
  import: FileStack,
} as const;

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = typeIcon[item.type];
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-4 transition-colors duration-150 hover:bg-[rgba(15,110,255,0.03)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-5">
        <ClusterIconChip icon={Icon} size="compact" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={item.severity} />
            <h3 className="text-[1rem] font-semibold text-ink">{item.title}</h3>
            <span className="cl-meta">{item.time}</span>
          </div>
          <p className="mt-1 text-[0.9375rem] text-body">{item.reason}</p>
          <p className="cl-meta mt-1">
            {item.entity} · {item.impact}
          </p>
        </div>
        <div className="col-span-2 md:col-span-1 md:shrink-0">
          <Link
            href={item.href as never}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-line bg-white px-3.5 text-[0.875rem] font-semibold text-cluster-bright transition-colors duration-200 hover:border-cluster-bright"
          >
            {item.type === 'order'
              ? 'View order'
              : item.type === 'supplier'
                ? 'View supplier'
                : 'Review'}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function ResolvePage() {
  const { activeDatasetId, activeDataset } = useDataset();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!activeDatasetId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const [orderRes, suppRes] = await Promise.all([
          fetch(`/api/orders?datasetId=${activeDatasetId}`).then((r) => r.json()),
          fetch(`/api/suppliers?datasetId=${activeDatasetId}`).then((r) => r.json()),
        ]);
        if (isCancelled) return;
        if (orderRes.error) throw new Error(orderRes.error);
        if (suppRes.error) throw new Error(suppRes.error);
        setOrders(orderRes.orders ?? []);
        setSuppliers(suppRes.suppliers ?? []);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Failed to load operational data.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId]);

  // Compute real attention items
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    // 1. Supplier deterioration alerts (WATCH / HIGH)
    suppliers.forEach((s) => {
      if (s.reliability?.status === 'HIGH') {
        const triggers = Array.isArray(s.reliability.triggers_json)
          ? (s.reliability.triggers_json as Array<{ code: string }>)
          : [];
        const triggerCodes = triggers.map((t) => t.code).join(', ');
        items.push({
          id: `supp-high-${s.supplier.id}`,
          severity: 'HIGH',
          type: 'supplier',
          title: `Supplier ${s.supplier.name} at HIGH risk`,
          reason: triggerCodes ? `Triggers detected: ${triggerCodes}` : 'Severe deterioration against baseline.',
          entity: `${s.supplier.name} (${s.supplier.external_supplier_id})`,
          time: 'Active evaluation',
          impact: `${s.reliability.recent_evaluated_orders} evaluated orders`,
          href: `/suppliers/${s.supplier.id}`,
        });
      } else if (s.reliability?.status === 'WATCH') {
        items.push({
          id: `supp-watch-${s.supplier.id}`,
          severity: 'MEDIUM',
          type: 'supplier',
          title: `Supplier ${s.supplier.name} moved to WATCH`,
          reason: 'Reliability metrics dropped below historical baseline.',
          entity: `${s.supplier.name} (${s.supplier.external_supplier_id})`,
          time: 'Active evaluation',
          impact: `${s.reliability.recent_evaluated_orders} evaluated orders`,
          href: `/suppliers/${s.supplier.id}`,
        });
      }
    });

    // 2. Order exceptions
    orders.forEach((o) => {
      if (o.exceptionSummary.count > 0) {
        const sev = o.exceptionSummary.highestSeverity ?? 'MEDIUM';
        const typeStr = o.exceptionSummary.types.join(', ');
        const pharmName = o.pharmacy?.name ?? 'Pharmacy';
        const suppName = o.suppliers[0]?.name ?? 'Assigned supplier';
        items.push({
          id: `ord-exc-${o.id}`,
          severity: sev,
          type: 'order',
          title: `Order ${o.externalOrderId} — ${typeStr}`,
          reason: `${o.deliveryState} delivery state from ${suppName}`,
          entity: pharmName,
          time: new Date(o.placedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          impact: `Requested ${o.requestedUnits} · Filled ${o.filledUnits}`,
          href: `/orders/${o.id}`,
        });
      }
    });

    return items;
  }, [orders, suppliers]);

  // Real computed pulse metrics
  const totalOrders = orders.length;
  const exceptionOrdersCount = orders.filter((o) => o.exceptionSummary.count > 0).length;
  const suppliersUnderWatch = suppliers.filter(
    (s) => s.reliability?.status === 'WATCH' || s.reliability?.status === 'HIGH'
  ).length;
  const evaluableSuppliers = suppliers.filter((s) => s.reliability && s.reliability.status !== 'INSUFFICIENT_DATA').length;

  return (
    <AppShell>
      <TopContextBar
        title="Resolve"
        subtitle="Procurement reliability and operational risk"
      />
      <PageBody>
        <PageHeader
          title="Resolve"
          subtitle="Procurement reliability and operational exception queue"
          actions={
            <>
              <Link href="/imports" className={linkButtonClass('secondary', 'sm')}>
                Import data
              </Link>
              <Link href="/orders" className={linkButtonClass('primary', 'sm')}>
                Open order queue
              </Link>
            </>
          }
        />

        {loading ? (
          <LoadingState rows={4} label="Loading operational queue..." />
        ) : error ? (
          <div className="cl-panel border-[rgba(217,45,32,0.25)] p-6">
            <h3 className="cl-card-title text-danger">Failed to load active dataset</h3>
            <p className="mt-2 text-[0.9375rem] text-body">{error}</p>
          </div>
        ) : !activeDatasetId ? (
          <EmptyState
            icon={PackageSearch}
            title="No dataset selected"
            description="Select or import a dataset to inspect operational reliability."
            action={{ label: 'Go to imports', href: '/imports' }}
          />
        ) : (
          <>
            <section aria-labelledby="needs-attention" className="mb-12">
              <SectionHeader
                id="needs-attention"
                title="What needs attention?"
                description="Ranked by operational severity across the active dataset."
                action={
                  <StatusChip
                    label={`${attentionItems.length} open items`}
                    tone={attentionItems.length > 0 ? 'brand' : 'success'}
                    icon={attentionItems.length > 0 ? AlertTriangle : CheckCircle2}
                  />
                }
              />
              {attentionItems.length === 0 ? (
                <div className="cl-panel p-8 text-center">
                  <ClusterIconChip icon={CheckCircle2} size="standard" tone="soft" className="mx-auto mb-3" />
                  <h3 className="cl-card-title">All evaluated orders & suppliers are healthy</h3>
                  <p className="mt-1 text-[0.9375rem] text-body">
                    No exceptions or deteriorating supplier trends detected in {activeDataset?.name}.
                  </p>
                </div>
              ) : (
                <ul className="cl-panel overflow-hidden">
                  {attentionItems.map((item) => (
                    <AttentionRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="pulse">
              <SectionHeader
                id="pulse"
                title="Operational pulse"
                description="Compact metrics computed from real active dataset evaluations."
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  label="Orders evaluated"
                  value={String(totalOrders)}
                  coverage={`Evaluated across active dataset`}
                  state={{ label: totalOrders > 0 ? 'AVAILABLE' : 'EMPTY', tone: totalOrders > 0 ? 'success' : 'neutral' }}
                  evidence={{ label: 'View orders', href: '/orders' }}
                />
                <Metric
                  label="Orders with exceptions"
                  value={String(exceptionOrdersCount)}
                  coverage="Partial, late, cancelled or unfulfilled"
                  state={{
                    label: exceptionOrdersCount > 0 ? 'EXCEPTIONS DETECTED' : 'HEALTHY',
                    tone: exceptionOrdersCount > 0 ? 'caution' : 'success',
                  }}
                  evidence={{ label: 'Filter exceptions', href: '/orders' }}
                />
                <Metric
                  label="Suppliers under watch / high risk"
                  value={String(suppliersUnderWatch)}
                  coverage={`Of ${evaluableSuppliers} suppliers with sufficient evaluated orders`}
                  state={{
                    label: suppliersUnderWatch > 0 ? 'ATTENTION NEEDED' : 'STABLE',
                    tone: suppliersUnderWatch > 0 ? 'danger' : 'success',
                  }}
                  evidence={{ label: 'View suppliers', href: '/suppliers' }}
                />
              </div>
            </section>
          </>
        )}
      </PageBody>
    </AppShell>
  );
}
