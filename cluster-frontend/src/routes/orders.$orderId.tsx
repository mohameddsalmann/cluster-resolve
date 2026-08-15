import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSearch, PackageSearch, ScrollText, Truck } from "lucide-react";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import {
  ClusterIconChip,
  linkButtonClass,
  EvidenceLink,
  PageHeader,
  Panel,
  SeverityBadge,
  StatusChip,
  Timeline,
} from "@/components/cluster/primitives";
import { orders } from "@/lib/ui-fixtures";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderId} — Cluster Resolve` },
      {
        name: "description",
        content:
          "Order detail with requested items, supplier, actual outcome, exceptions, procurement decision and regulatory exposure.",
      },
      { property: "og:title", content: `Order ${params.orderId} — Cluster Resolve` },
      {
        property: "og:description",
        content: "Full operational record for a single evaluated pharmacy order.",
      },
    ],
  }),
  component: OrderDetail,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="cl-meta">{label}</dt>
      <dd className="text-[0.9375rem] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function OrderDetail() {
  const { orderId } = Route.useParams();
  const order = orders.find((o) => o.id === orderId) ?? orders[1]!;

  return (
    <AppShell>
      <TopContextBar title={`Order ${order.id}`} subtitle={order.pharmacy} />
      <PageBody>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            to="/orders"
            className="text-[0.875rem] font-semibold text-cluster-bright hover:text-cluster-deep"
          >
            ← Orders
          </Link>
        </nav>

        <PageHeader
          title={order.id}
          subtitle={`${order.pharmacy} · placed ${order.placed}`}
          actions={
            <Link
              to="/decisions/$decisionId"
              params={{ decisionId: "DEC-DEMO-4410" }}
              className={linkButtonClass("primary", "sm")}
            >
              Open decision replay
            </Link>
          }
        />

        <div className="space-y-6">
          <Panel title="Order summary">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <Field label="Order" value={order.id} />
              <Field label="Pharmacy" value={order.pharmacy} />
              <Field label="Placed" value={order.placed} />
              <Field label="Supplier" value={order.supplier} />
              <Field label="Requested units" value={String(order.requested)} />
              <Field label="Filled units" value={String(order.filled)} />
              <Field label="Delivery" value={order.delivery} />
              <Field label="Exception" value={order.exception} />
            </dl>
          </Panel>

          <Panel title="Requested items">
            <ul className="divide-y divide-line">
              {[
                { name: "Paracetamol 500mg tablets", qty: 80, batch: "B-2291" },
                { name: "Omeprazole 20mg capsules", qty: 40, batch: "O-4410" },
              ].map((item) => (
                <li key={item.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold text-ink">{item.name}</p>
                    <p className="cl-meta">Batch {item.batch}</p>
                  </div>
                  <p className="text-[0.9375rem] text-body">{item.qty} units requested</p>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Supplier">
              <div className="flex items-start gap-4">
                <ClusterIconChip icon={Truck} size="standard" />
                <div className="min-w-0">
                  <p className="text-[1rem] font-semibold text-ink">{order.supplier}</p>
                  <p className="mt-1 text-[0.9375rem] text-body">
                    Reliability status is evaluated from this supplier&apos;s own baseline.
                  </p>
                  <div className="mt-3">
                    <EvidenceLink label="Open supplier reliability" to="/suppliers" />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Regulatory exposure">
              <div className="flex items-start gap-4">
                <ClusterIconChip icon={ScrollText} size="standard" />
                <div className="min-w-0">
                  <StatusChip
                    label={order.regulatory === "Clear" ? "No exposure recorded" : `${order.regulatory} match`}
                    tone={order.regulatory === "Clear" ? "success" : "caution"}
                  />
                  <p className="mt-2 text-[0.9375rem] text-body">
                    {order.regulatory === "Clear"
                      ? "No EDA notice matched the batches recorded on this order."
                      : "A possible match was found. Batch data is incomplete, so this is not a confirmed exposure."}
                  </p>
                  <div className="mt-3">
                    <EvidenceLink label="Review regulatory" to="/regulatory" />
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Actual outcome">
            <Timeline
              items={[
                { label: "Requested", time: order.placed, detail: `${order.requested} units requested` },
                { label: "Accepted", time: "12 Aug 11:40", detail: "Supplier accepted a reduced quantity" },
                {
                  label: "Partially delivered",
                  time: "14 Aug 08:12",
                  detail: `${order.filled} of ${order.requested} units delivered`,
                  tone: "caution",
                },
              ]}
            />
          </Panel>

          <Panel title="Exceptions">
            {order.exception === "None" ? (
              <p className="text-[0.9375rem] text-body">No exceptions were recorded on this order.</p>
            ) : (
              <ul className="space-y-3">
                <li className="flex flex-wrap items-center gap-3">
                  <SeverityBadge severity="HIGH" />
                  <p className="text-[0.9375rem] text-ink">
                    {order.exception} fulfillment — {order.requested - order.filled} units unfilled
                  </p>
                </li>
                {order.delivery === "Late" ? (
                  <li className="flex flex-wrap items-center gap-3">
                    <SeverityBadge severity="MEDIUM" />
                    <p className="text-[0.9375rem] text-ink">
                      Delivered after the promised window
                    </p>
                  </li>
                ) : null}
              </ul>
            )}
          </Panel>

          <Panel
            title="Procurement decision"
            description="How this supplier was chosen, and whether a better feasible offer existed."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[8px] bg-surface p-4">
                <p className="cl-meta">Decision</p>
                <p className="text-[0.9375rem] font-semibold text-ink">DEC-DEMO-4410</p>
              </div>
              <div className="rounded-[8px] bg-surface p-4">
                <p className="cl-meta">Decision quality</p>
                <p className="text-[0.9375rem] font-semibold text-ink">{order.decisionQuality}</p>
              </div>
              <div className="rounded-[8px] bg-surface p-4">
                <p className="cl-meta">Offer context</p>
                <p className="text-[0.9375rem] font-semibold text-ink">3 offers recorded</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                to="/decisions/$decisionId"
                params={{ decisionId: "DEC-DEMO-4410" }}
                className={linkButtonClass("secondary", "sm")}
              >
                Replay this decision
              </Link>
            </div>
          </Panel>

          <Panel title="Evidence">
            <div className="flex items-center gap-4">
              <ClusterIconChip icon={FileSearch} size="standard" tone="soft" />
              <div className="min-w-0">
                <p className="text-[0.9375rem] text-body">
                  Every value above traces back to imported records.
                </p>
                <div className="mt-2">
                  <EvidenceLink label="Show underlying records" to="/imports" />
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-4">
              <ClusterIconChip icon={PackageSearch} size="compact" tone="soft" />
              <p className="text-[0.875rem] text-body">
                Preview fixture record. Values shown here are UI-only and are not sourced from a
                production system.
              </p>
            </div>
          </Panel>
        </div>
      </PageBody>
    </AppShell>
  );
}
