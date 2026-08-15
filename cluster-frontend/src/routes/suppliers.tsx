import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import { DataTable, type Column } from "@/components/cluster/DataTable";
import { PageHeader, StatusChip, type ChipTone } from "@/components/cluster/primitives";
import { suppliers, type SupplierRow } from "@/lib/ui-fixtures";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — Cluster Resolve" },
      {
        name: "description",
        content:
          "Supplier reliability only: fill rate, OTIF, cancellation, partial fill and lead time measured against each supplier's own baseline.",
      },
      { property: "og:title", content: "Suppliers — Cluster Resolve" },
      {
        property: "og:description",
        content: "Reliability signals for every supplier with enough evaluated orders.",
      },
    ],
  }),
  component: SuppliersLayout,
});

function SuppliersLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/suppliers") return <Outlet />;
  return <SuppliersIndex />;
}

const statusTone: Record<SupplierRow["status"], ChipTone> = {
  HEALTHY: "success",
  WATCH: "caution",
  HIGH: "danger",
  "INSUFFICIENT DATA": "neutral",
};

const columns: Column<SupplierRow>[] = [
  {
    key: "supplier",
    header: "Supplier",
    cell: (r) => (
      <Link
        to="/suppliers/$supplierId"
        params={{ supplierId: r.id }}
        className="font-semibold text-cluster-bright hover:text-cluster-deep"
      >
        {r.name}
        <span className="ml-2 font-normal text-body">{r.id}</span>
      </Link>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusChip label={r.status} tone={statusTone[r.status]} />,
  },
  { key: "evaluated", header: "Evaluated Orders", align: "right", cell: (r) => r.evaluated },
  { key: "fill", header: "Fill Rate", align: "right", cell: (r) => <span className="text-ink">{r.fillRate}</span> },
  { key: "otif", header: "OTIF", align: "right", cell: (r) => r.otif },
  { key: "cancel", header: "Cancellation", align: "right", cell: (r) => r.cancellation },
  { key: "partial", header: "Partial Fill", align: "right", cell: (r) => r.partialFill },
  { key: "p95", header: "P95 Lead Time", align: "right", cell: (r) => r.p95Lead },
  { key: "change", header: "Recent Change", cell: (r) => r.recentChange },
];

function SuppliersIndex() {
  return (
    <AppShell>
      <TopContextBar title="Suppliers" subtitle="Reliability against own baseline" />
      <PageBody wide>
        <PageHeader
          title="Suppliers"
          subtitle="Reliability only — measured against each supplier's own baseline, not a market ranking."
        />
        <DataTable
          columns={columns}
          rows={suppliers}
          rowKey={(r) => r.id}
          caption="Supplier reliability"
          emptyMessage="No suppliers have enough evaluated orders in this dataset."
        />
      </PageBody>
    </AppShell>
  );
}
