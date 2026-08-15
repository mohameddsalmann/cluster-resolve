import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import { DataTable, FilterBar, type Column } from "@/components/cluster/DataTable";
import { PageHeader, StatusChip, type ChipTone } from "@/components/cluster/primitives";
import { filterOrders, orderFilters, orders, type OrderRow } from "@/lib/ui-fixtures";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Cluster Resolve" },
      {
        name: "description",
        content:
          "Operational order queue with fulfillment, delivery, exception, decision quality and regulatory signals per pharmacy order.",
      },
      { property: "og:title", content: "Orders — Cluster Resolve" },
      {
        property: "og:description",
        content: "Every evaluated pharmacy order with its fulfillment and regulatory signals.",
      },
    ],
  }),
  component: OrdersLayout,
});

function OrdersLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/orders") return <Outlet />;
  return <OrdersIndex />;
}

const exceptionTone: Record<OrderRow["exception"], ChipTone> = {
  None: "success",
  Partial: "caution",
  Late: "caution",
  Cancelled: "danger",
};

const qualityTone: Record<OrderRow["decisionQuality"], ChipTone> = {
  Aligned: "success",
  Regret: "danger",
  "Not evaluable": "neutral",
};

const regulatoryTone: Record<OrderRow["regulatory"], ChipTone> = {
  Clear: "success",
  Exposure: "danger",
  Possible: "caution",
};

const columns: Column<OrderRow>[] = [
  {
    key: "id",
    header: "Order",
    cell: (r) => (
      <Link
        to="/orders/$orderId"
        params={{ orderId: r.id }}
        className="font-semibold text-cluster-bright hover:text-cluster-deep"
      >
        {r.id}
      </Link>
    ),
  },
  { key: "pharmacy", header: "Pharmacy", cell: (r) => <span className="text-ink">{r.pharmacy}</span> },
  { key: "placed", header: "Placed", cell: (r) => r.placed },
  { key: "supplier", header: "Supplier", cell: (r) => r.supplier },
  { key: "requested", header: "Requested", align: "right", cell: (r) => r.requested },
  {
    key: "filled",
    header: "Filled",
    align: "right",
    cell: (r) => (
      <span className={r.filled < r.requested ? "font-semibold text-danger" : "text-ink"}>
        {r.filled}
      </span>
    ),
  },
  { key: "delivery", header: "Delivery", cell: (r) => r.delivery },
  {
    key: "exception",
    header: "Exception",
    cell: (r) => <StatusChip label={r.exception} tone={exceptionTone[r.exception]} />,
  },
  {
    key: "quality",
    header: "Decision Quality",
    cell: (r) => <StatusChip label={r.decisionQuality} tone={qualityTone[r.decisionQuality]} />,
  },
  {
    key: "regulatory",
    header: "Regulatory",
    cell: (r) => <StatusChip label={r.regulatory} tone={regulatoryTone[r.regulatory]} />,
  },
];

function OrdersIndex() {
  const [filter, setFilter] = useState<string>("All");
  const rows = filterOrders(orders, filter);

  return (
    <AppShell>
      <TopContextBar title="Orders" subtitle="Evaluated pharmacy orders" />
      <PageBody wide>
        <PageHeader
          title="Orders"
          subtitle="Every evaluated order with its fulfillment, decision and regulatory signals."
        >
          <FilterBar
            options={[...orderFilters]}
            value={filter}
            onChange={setFilter}
            label="Order filters"
          />
        </PageHeader>

        <p className="cl-meta mb-3">
          Showing {rows.length} of {orders.length} orders
        </p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          caption="Evaluated orders"
          emptyMessage="No orders match this filter in the active dataset."
        />
      </PageBody>
    </AppShell>
  );
}
