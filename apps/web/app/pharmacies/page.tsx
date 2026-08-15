'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import { DataTable, type Column } from '@/components/cluster/DataTable';
import {
  EmptyState,
  LoadingState,
  PageHeader,
  StatusChip,
  type ChipTone,
} from '@/components/cluster/primitives';
import { useDataset } from '@/lib/context/dataset-context';

type PharmacyServiceRiskLevel = 'STABLE' | 'AT_RISK' | 'HIGH_RISK';

interface PharmacyListItem {
  pharmacy: {
    id: string;
    external_pharmacy_id: string;
    name: string | null;
  };
  risk: {
    pharmacyId: string;
    totalOrders: number;
    ordersWithExceptions: number;
    exceptionRateBps: number | null;
    cancellationAffected: number;
    partialFillAffected: number;
    highSeverityExceptions: number;
    serviceRiskLevel: PharmacyServiceRiskLevel;
  };
}

const riskTone: Record<PharmacyServiceRiskLevel, ChipTone> = {
  STABLE: 'success',
  AT_RISK: 'caution',
  HIGH_RISK: 'danger',
};

const riskLabel: Record<PharmacyServiceRiskLevel, string> = {
  STABLE: 'Stable',
  AT_RISK: 'At Risk',
  HIGH_RISK: 'High Risk',
};

export default function PharmaciesPage() {
  const router = useRouter();
  const { activeDatasetId, activeDataset } = useDataset();
  const [pharmacies, setPharmacies] = useState<PharmacyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadPharmacies() {
      if (!activeDatasetId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/pharmacies?datasetId=${activeDatasetId}`);
        const data = await res.json();
        if (isCancelled) return;
        if (data.error) throw new Error(data.error);
        // Sort: HIGH_RISK first, then AT_RISK, then STABLE
        const sorted = (data.pharmacies ?? []).sort((a: PharmacyListItem, b: PharmacyListItem) => {
          const order = { HIGH_RISK: 0, AT_RISK: 1, STABLE: 2 };
          return (order[a.risk.serviceRiskLevel] ?? 2) - (order[b.risk.serviceRiskLevel] ?? 2);
        });
        setPharmacies(sorted);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Failed to load pharmacies.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadPharmacies();

    return () => {
      isCancelled = true;
    };
  }, [activeDatasetId]);

  const columns: Column<PharmacyListItem>[] = [
    {
      key: 'pharmacy',
      header: 'Pharmacy',
      cell: (r) => (
        <span className="font-semibold text-ink">
          {r.pharmacy.name ?? r.pharmacy.external_pharmacy_id}
          <span className="ml-2 font-normal text-body text-xs">{r.pharmacy.external_pharmacy_id}</span>
        </span>
      ),
    },
    {
      key: 'risk',
      header: 'Service Risk',
      cell: (r) => (
        <StatusChip
          label={riskLabel[r.risk.serviceRiskLevel]}
          tone={riskTone[r.risk.serviceRiskLevel]}
        />
      ),
    },
    {
      key: 'orders',
      header: 'Total Orders',
      align: 'right',
      cell: (r) => r.risk.totalOrders,
    },
    {
      key: 'exceptions',
      header: 'Orders w/ Exceptions',
      align: 'right',
      cell: (r) => (
        <span className={r.risk.ordersWithExceptions > 0 ? 'text-danger font-semibold' : 'text-body'}>
          {r.risk.ordersWithExceptions}
        </span>
      ),
    },
    {
      key: 'exceptionRate',
      header: 'Exception Rate',
      align: 'right',
      cell: (r) =>
        r.risk.exceptionRateBps !== null
          ? `${(r.risk.exceptionRateBps / 100).toFixed(0)}%`
          : '—',
    },
    {
      key: 'cancellations',
      header: 'Cancellations',
      align: 'right',
      cell: (r) => (
        <span className={r.risk.cancellationAffected > 0 ? 'text-danger' : 'text-body'}>
          {r.risk.cancellationAffected}
        </span>
      ),
    },
    {
      key: 'partials',
      header: 'Partial Fills',
      align: 'right',
      cell: (r) => (
        <span className={r.risk.partialFillAffected > 0 ? 'text-caution' : 'text-body'}>
          {r.risk.partialFillAffected}
        </span>
      ),
    },
    {
      key: 'highSeverity',
      header: 'High-Sev. Exceptions',
      align: 'right',
      cell: (r) => (
        <span className={r.risk.highSeverityExceptions > 0 ? 'text-danger font-semibold' : 'text-body'}>
          {r.risk.highSeverityExceptions}
        </span>
      ),
    },
  ];

  return (
    <AppShell>
      <TopContextBar
        title="Pharmacies"
        subtitle={`Service risk by exception history · ${activeDataset?.name ?? ''}`}
      />
      <PageBody wide>
        <PageHeader
          title="Pharmacies"
          subtitle="Service risk is computed from exception history across all orders. HIGH_RISK: ≥50% exception rate or ≥2 high-severity exceptions. AT_RISK: ≥20% exception rate."
        />

        {loading ? (
          <LoadingState rows={5} label="Loading pharmacy service risk..." />
        ) : error ? (
          <div className="cl-panel border-[rgba(217,45,32,0.25)] p-6">
            <h3 className="cl-card-title text-danger">Failed to load pharmacies</h3>
            <p className="mt-2 text-[0.9375rem] text-body">{error}</p>
          </div>
        ) : pharmacies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No pharmacies found"
            description="There are no pharmacies in the active dataset yet."
            action={{ label: 'Go to Imports', href: '/imports' }}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={pharmacies}
            rowKey={(r) => r.pharmacy.id}
            caption="Pharmacy service risk"
            emptyMessage="No pharmacies in this dataset."
          />
        )}
      </PageBody>
    </AppShell>
  );
}
