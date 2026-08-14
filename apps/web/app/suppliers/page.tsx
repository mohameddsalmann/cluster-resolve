'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import { DataTable, type Column } from '@/components/cluster/DataTable';
import { PageHeader, StatusChip, LoadingState, EmptyState, type ChipTone } from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';
import { Truck } from 'lucide-react';

interface SupplierListItem {
  supplier: {
    id: string;
    external_supplier_id: string;
    name: string;
  };
  reliability: {
    supplier_id: string;
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
    recent_lead_time_p95_minutes: number | null;
    baseline_lead_time_p95_minutes: number | null;
    triggers_json: unknown;
  } | null;
}

const statusTone: Record<string, ChipTone> = {
  HEALTHY: 'success',
  WATCH: 'caution',
  HIGH: 'danger',
  INSUFFICIENT_DATA: 'neutral',
};

export default function SuppliersPage() {
  const router = useRouter();
  const { activeDatasetId, activeDataset } = useDataset();
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSuppliers() {
      if (!activeDatasetId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/suppliers?datasetId=${activeDatasetId}`);
        const data = await res.json();
        if (isCancelled) return;
        if (data.error) throw new Error(data.error);
        setSuppliers(data.suppliers ?? []);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Failed to load suppliers.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadSuppliers();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId]);

  const columns: Column<SupplierListItem>[] = [
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (r) => (
        <Link
          href={`/suppliers/${r.supplier.id}`}
          className="font-semibold text-cluster-bright hover:text-cluster-deep"
        >
          {r.supplier.name}
          <span className="ml-2 font-normal text-body">{r.supplier.external_supplier_id}</span>
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => {
        const st = r.reliability?.status ?? 'INSUFFICIENT_DATA';
        const label = st === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT DATA' : st;
        return <StatusChip label={label} tone={statusTone[st] ?? 'neutral'} />;
      },
    },
    {
      key: 'evaluated',
      header: 'Evaluated Orders',
      align: 'right',
      cell: (r) => r.reliability?.recent_evaluated_orders ?? 0,
    },
    {
      key: 'fill',
      header: 'Fill Rate',
      align: 'right',
      cell: (r) => (
        <span className="text-ink">
          {r.reliability?.recent_fill_rate_bps !== null && r.reliability?.recent_fill_rate_bps !== undefined
            ? `${(r.reliability.recent_fill_rate_bps / 100).toFixed(0)}%`
            : '—'}
        </span>
      ),
    },
    {
      key: 'otif',
      header: 'OTIF',
      align: 'right',
      cell: (r) =>
        r.reliability?.recent_otif_rate_bps !== null && r.reliability?.recent_otif_rate_bps !== undefined
          ? `${(r.reliability.recent_otif_rate_bps / 100).toFixed(0)}%`
          : '—',
    },
    {
      key: 'cancel',
      header: 'Cancellation',
      align: 'right',
      cell: (r) =>
        r.reliability?.recent_cancellation_rate_bps !== null &&
        r.reliability?.recent_cancellation_rate_bps !== undefined
          ? `${(r.reliability.recent_cancellation_rate_bps / 100).toFixed(0)}%`
          : '—',
    },
    {
      key: 'partial',
      header: 'Partial Fill',
      align: 'right',
      cell: (r) =>
        r.reliability?.recent_partial_fill_rate_bps !== null &&
        r.reliability?.recent_partial_fill_rate_bps !== undefined
          ? `${(r.reliability.recent_partial_fill_rate_bps / 100).toFixed(0)}%`
          : '—',
    },
    {
      key: 'p95',
      header: 'P95 Lead Time',
      align: 'right',
      cell: (r) =>
        r.reliability?.recent_lead_time_p95_minutes !== null &&
        r.reliability?.recent_lead_time_p95_minutes !== undefined
          ? `${Math.round(r.reliability.recent_lead_time_p95_minutes / 60)}h`
          : '—',
    },
    {
      key: 'change',
      header: 'Recent Change',
      cell: (r) => {
        if (!r.reliability || r.reliability.status === 'INSUFFICIENT_DATA') {
          return <span className="cl-meta">Insufficient history</span>;
        }
        const triggers = Array.isArray(r.reliability.triggers_json)
          ? (r.reliability.triggers_json as Array<{ code: string; delta?: number }>)
          : [];
        if (triggers.length === 0) {
          return <span className="text-success font-medium text-xs">Stable against baseline</span>;
        }
        const topTrigger = triggers[0]!;
        if (topTrigger.code === 'FILL_RATE_DROP') {
          return (
            <span className="text-danger font-medium text-xs">
              Fill rate down {topTrigger.delta ? (topTrigger.delta / 100).toFixed(0) : ''} pts
            </span>
          );
        }
        if (topTrigger.code === 'CANCELLATION_INCREASE') {
          return (
            <span className="text-danger font-medium text-xs">
              Cancellations up {topTrigger.delta ? (topTrigger.delta / 100).toFixed(0) : ''} pts
            </span>
          );
        }
        return <span className="text-warning font-medium text-xs">{topTrigger.code}</span>;
      },
    },
  ];

  return (
    <AppShell>
      <TopContextBar
        title="Suppliers"
        subtitle={`Reliability against own baseline · ${activeDataset?.name ?? ''}`}
      />
      <PageBody wide>
        <PageHeader
          title="Suppliers"
          subtitle="Reliability only — measured against each supplier's own baseline, not a market ranking."
        />

        {loading ? (
          <LoadingState rows={5} label="Loading supplier reliability..." />
        ) : error ? (
          <div className="cl-panel border-[rgba(217,45,32,0.25)] p-6">
            <h3 className="cl-card-title text-danger">Failed to load suppliers</h3>
            <p className="mt-2 text-[0.9375rem] text-body">{error}</p>
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers found"
            description="There are no suppliers in the active dataset yet."
            action={{ label: 'Go to Imports', href: '/imports' }}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={suppliers}
            rowKey={(r) => r.supplier.id}
            caption="Supplier reliability"
            onRowClick={(r) => router.push(`/suppliers/${r.supplier.id}`)}
            emptyMessage="No suppliers have enough evaluated orders in this dataset."
          />
        )}
      </PageBody>
    </AppShell>
  );
}
