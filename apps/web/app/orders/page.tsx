'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import { DataTable, FilterBar, type Column } from '@/components/cluster/DataTable';
import { PageHeader, StatusChip, LoadingState, EmptyState, type ChipTone } from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';
import { PackageSearch } from 'lucide-react';

interface OrderRow {
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

const orderFilters = ['All', 'Healthy', 'Exceptions', 'Late', 'Partial', 'Cancelled'] as const;

export default function OrdersPage() {
  const router = useRouter();
  const { activeDatasetId, activeDataset } = useDataset();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('All');

  useEffect(() => {
    let isCancelled = false;

    async function loadOrders() {
      if (!activeDatasetId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/orders?datasetId=${activeDatasetId}`);
        const data = await res.json();
        if (isCancelled) return;
        if (data.error) throw new Error(data.error);
        setOrders(data.orders ?? []);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Failed to load orders.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadOrders();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId]);

  const filteredOrders = useMemo(() => {
    switch (filter) {
      case 'Healthy':
        return orders.filter((r) => r.exceptionSummary.count === 0);
      case 'Exceptions':
        return orders.filter((r) => r.exceptionSummary.count > 0);
      case 'Late':
        return orders.filter(
          (r) =>
            r.exceptionSummary.types.includes('LATE_DELIVERY') ||
            r.deliveryState === 'LATE'
        );
      case 'Partial':
        return orders.filter(
          (r) =>
            r.exceptionSummary.types.includes('PARTIAL_FILL') ||
            r.deliveryState === 'PARTIAL_FILL'
        );
      case 'Cancelled':
        return orders.filter(
          (r) =>
            r.exceptionSummary.types.includes('CANCELLED') ||
            r.deliveryState === 'CANCELLED'
        );
      default:
        return orders;
    }
  }, [orders, filter]);

  const columns: Column<OrderRow>[] = [
    {
      key: 'id',
      header: 'Order',
      cell: (r) => (
        <Link
          href={`/orders/${r.id}`}
          className="font-semibold text-cluster-bright hover:text-cluster-deep"
        >
          {r.externalOrderId}
        </Link>
      ),
    },
    {
      key: 'pharmacy',
      header: 'Pharmacy',
      cell: (r) => <span className="text-ink">{r.pharmacy?.name ?? '—'}</span>,
    },
    {
      key: 'placed',
      header: 'Placed',
      cell: (r) =>
        new Date(r.placedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (r) => r.suppliers.map((s) => s.name).join(', ') || '—',
    },
    {
      key: 'requested',
      header: 'Requested',
      align: 'right',
      cell: (r) => r.requestedUnits,
    },
    {
      key: 'filled',
      header: 'Filled',
      align: 'right',
      cell: (r) => (
        <span className={r.filledUnits < r.requestedUnits ? 'font-semibold text-danger' : 'text-ink'}>
          {r.filledUnits}
        </span>
      ),
    },
    {
      key: 'delivery',
      header: 'Delivery State',
      cell: (r) => {
        const tone: ChipTone =
          r.deliveryState === 'DELIVERED'
            ? 'success'
            : r.deliveryState === 'PARTIAL_FILL' || r.deliveryState === 'LATE'
              ? 'caution'
              : r.deliveryState === 'CANCELLED' || r.deliveryState === 'UNFULFILLED'
                ? 'danger'
                : 'neutral';
        return <StatusChip label={r.deliveryState} tone={tone} />;
      },
    },
    {
      key: 'exception',
      header: 'Exception',
      cell: (r) => {
        if (r.exceptionSummary.count === 0) {
          return <StatusChip label="None" tone="success" />;
        }
        const label = r.exceptionSummary.types.join(', ');
        const tone: ChipTone = r.exceptionSummary.highestSeverity === 'HIGH' ? 'danger' : 'caution';
        return <StatusChip label={label} tone={tone} />;
      },
    },
  ];

  return (
    <AppShell>
      <TopContextBar title="Orders" subtitle={`Evaluated pharmacy orders · ${activeDataset?.name ?? ''}`} />
      <PageBody wide>
        <PageHeader
          title="Orders"
          subtitle="Every evaluated order with its fulfillment, delivery state, and detected exceptions."
        >
          <FilterBar
            options={[...orderFilters]}
            value={filter}
            onChange={setFilter}
            label="Order filters"
          />
        </PageHeader>

        {loading ? (
          <LoadingState rows={6} label="Loading evaluated orders..." />
        ) : error ? (
          <div className="cl-panel border-[rgba(217,45,32,0.25)] p-6">
            <h3 className="cl-card-title text-danger">Failed to load orders</h3>
            <p className="mt-2 text-[0.9375rem] text-body">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No orders found"
            description="There are no orders in the active dataset yet. You can import order records in the Imports tab."
            action={{ label: 'Go to Imports', href: '/imports' }}
          />
        ) : (
          <>
            <p className="cl-meta mb-3">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>
            <DataTable
              columns={columns}
              rows={filteredOrders}
              rowKey={(r) => r.id}
              caption="Evaluated orders"
              onRowClick={(r) => router.push(`/orders/${r.id}`)}
              emptyMessage="No orders match this filter in the active dataset."
            />
          </>
        )}
      </PageBody>
    </AppShell>
  );
}
