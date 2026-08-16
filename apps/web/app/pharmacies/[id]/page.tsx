'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  EmptyState,
  LoadingState,
  Metric,
  PageHeader,
  Panel,
  StatusChip,
  type ChipTone,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';

type RiskLevel = 'STABLE' | 'AT_RISK' | 'HIGH_RISK' | 'INSUFFICIENT_DATA';

interface PharmacyDetail {
  pharmacy: { id: string; external_pharmacy_id: string; name: string | null };
  risk: {
    totalOrders: number;
    evaluatedOrders: number;
    ordersWithExceptions: number;
    exceptionRateBps: number | null;
    cancellationAffected: number;
    partialFillAffected: number;
    lateDeliveryAffected: number;
    highSeverityExceptions: number;
    serviceRiskLevel: RiskLevel;
  };
  topProblematicSuppliers: Array<{
    supplier: { id: string; external_supplier_id: string; name: string } | null;
    exceptionCount: number;
  }>;
  recentAffectedOrders: Array<{
    order: { id: string; external_order_id: string; placed_at: string; status: string };
    exceptions: Array<{
      id: string;
      type: string;
      severity: string;
      supplier: { id: string; external_supplier_id: string; name: string } | null;
    }>;
  }>;
}

const riskTone: Record<RiskLevel, ChipTone> = {
  STABLE: 'success',
  AT_RISK: 'caution',
  HIGH_RISK: 'danger',
  INSUFFICIENT_DATA: 'neutral',
};

export default function PharmacyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeDatasetId, activeDataset } = useDataset();
  const [detail, setDetail] = useState<PharmacyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDatasetId || !id) return;
    let cancelled = false;

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/pharmacies/${id}?datasetId=${activeDatasetId}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load pharmacy evidence.');
        if (!cancelled) setDetail(payload as PharmacyDetail);
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load pharmacy evidence.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [activeDatasetId, id]);

  return (
    <AppShell>
      <TopContextBar
        title="Pharmacy service evidence"
        subtitle={activeDataset?.name ?? ''}
      />
      <PageBody wide>
        {loading ? (
          <LoadingState rows={5} label="Loading pharmacy evidence…" />
        ) : error || !detail ? (
          <EmptyState
            icon={Building2}
            title="Pharmacy evidence unavailable"
            description={error ?? 'This pharmacy is not present in the active dataset.'}
            action={{ label: 'Back to pharmacies', href: '/pharmacies' }}
          />
        ) : (
          <div className="space-y-6">
            <PageHeader
              title={detail.pharmacy.name ?? detail.pharmacy.external_pharmacy_id}
              subtitle={`${detail.pharmacy.external_pharmacy_id} · Supplier service experienced by this pharmacy, derived from persisted order exceptions. This is not a rating of the pharmacy itself.`}
              actions={
                <StatusChip
                  label={detail.risk.serviceRiskLevel.replace('_', ' ')}
                  tone={riskTone[detail.risk.serviceRiskLevel]}
                />
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Orders" value={String(detail.risk.totalOrders)} coverage={`${detail.risk.evaluatedOrders} with final outcomes`} />
              <Metric
                label="Exception rate"
                value={detail.risk.exceptionRateBps === null ? '—' : `${(detail.risk.exceptionRateBps / 100).toFixed(1)}%`}
                coverage={`${detail.risk.ordersWithExceptions} affected orders`}
              />
              <Metric label="Cancelled / partial" value={`${detail.risk.cancellationAffected} / ${detail.risk.partialFillAffected}`} coverage="Orders affected" />
              <Metric label="Late deliveries" value={String(detail.risk.lateDeliveryAffected)} coverage="Orders delivered after recorded promise" />
            </div>

            <Panel
              title="Top problematic suppliers"
              description="Ranked by persisted exception evidence for this pharmacy."
            >
              {detail.topProblematicSuppliers.length === 0 ? (
                <p className="text-sm text-body">No supplier exceptions are recorded.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {detail.topProblematicSuppliers.map((item) => (
                    <li key={item.supplier?.id ?? 'unknown'} className="flex items-center justify-between gap-4 py-3">
                      {item.supplier ? (
                        <Link href={`/suppliers/${item.supplier.id}` as never} className="font-semibold text-cluster-bright hover:underline">
                          {item.supplier.name}
                        </Link>
                      ) : (
                        <span className="text-body">Unknown supplier</span>
                      )}
                      <span className="text-sm font-semibold text-ink">{item.exceptionCount} exceptions</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent affected orders"
              description="Up to 20 recent orders with persisted exception evidence."
            >
              {detail.recentAffectedOrders.length === 0 ? (
                <p className="text-sm text-body">No affected orders are recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-line bg-surface text-xs text-ink">
                      <tr>
                        <th className="p-3">Order</th>
                        <th className="p-3">Placed</th>
                        <th className="p-3">Exceptions</th>
                        <th className="p-3">Supplier evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {detail.recentAffectedOrders.map(({ order, exceptions }) => (
                        <tr key={order.id}>
                          <td className="p-3">
                            <Link href={`/orders/${order.id}` as never} className="font-semibold text-cluster-bright hover:underline">
                              {order.external_order_id}
                            </Link>
                          </td>
                          <td className="p-3 text-body">{new Date(order.placed_at).toLocaleDateString()}</td>
                          <td className="p-3 text-body">{[...new Set(exceptions.map((item) => item.type))].join(', ')}</td>
                          <td className="p-3 text-body">{[...new Set(exceptions.map((item) => item.supplier?.name).filter(Boolean))].join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
