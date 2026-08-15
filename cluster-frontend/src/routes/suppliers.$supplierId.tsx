import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import {
  ComparisonMetric,
  EvidenceLink,
  Metric,
  PageHeader,
  Panel,
  StatusChip,
} from "@/components/cluster/primitives";
import { reliabilityTrend, suppliers } from "@/lib/ui-fixtures";

export const Route = createFileRoute("/suppliers/$supplierId")({
  head: ({ params }) => ({
    meta: [
      { title: `Supplier ${params.supplierId} — Cluster Resolve` },
      {
        name: "description",
        content:
          "Supplier reliability detail: recent versus baseline fill rate, OTIF and cancellation, with affected orders and decisions.",
      },
      { property: "og:title", content: `Supplier ${params.supplierId} — Cluster Resolve` },
      {
        property: "og:description",
        content: "Why a supplier was flagged, and which orders and decisions it affected.",
      },
    ],
  }),
  component: SupplierDetail,
});

function TrendChart() {
  const max = 100;
  return (
    <div className="flex items-end gap-4" role="img" aria-label="Fill rate and OTIF trend over five weeks">
      {reliabilityTrend.map((p) => (
        <div key={p.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-40 w-full items-end justify-center gap-1.5">
            <div
              className="w-1/3 rounded-t-[4px] bg-cluster-bright"
              style={{ height: `${(p.fill / max) * 100}%` }}
            />
            <div
              className="w-1/3 rounded-t-[4px] bg-cluster-deep/35"
              style={{ height: `${(p.otif / max) * 100}%` }}
            />
          </div>
          <span className="cl-meta">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function SupplierDetail() {
  const { supplierId } = Route.useParams();
  const supplier = suppliers.find((s) => s.id === supplierId) ?? suppliers[1]!;

  return (
    <AppShell>
      <TopContextBar title={supplier.name} subtitle={`${supplier.id} · reliability detail`} />
      <PageBody>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            to="/suppliers"
            className="text-[0.875rem] font-semibold text-cluster-bright hover:text-cluster-deep"
          >
            ← Suppliers
          </Link>
        </nav>

        <PageHeader
          title={supplier.name}
          subtitle={`${supplier.id} · ${supplier.evaluated} evaluated orders`}
          actions={<StatusChip label={supplier.status} tone={supplier.status === "HEALTHY" ? "success" : "caution"} />}
        />

        <div className="space-y-6">
          <section aria-label="Reliability overview">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Fill rate" value={supplier.fillRate} coverage="Recent window" />
              <Metric label="OTIF" value={supplier.otif} coverage="Recent window" />
              <Metric label="Cancellation" value={supplier.cancellation} coverage="Recent window" />
              <Metric label="P95 lead time" value={supplier.p95Lead} coverage="Recent window" />
            </div>
          </section>

          <Panel title="Recent vs baseline" description="Comparison against this supplier's own history.">
            <div className="grid gap-4 sm:grid-cols-3">
              <ComparisonMetric label="Fill rate" baseline="96%" recent="78%" />
              <ComparisonMetric label="OTIF" baseline="91%" recent="76%" />
              <ComparisonMetric label="Cancellation" baseline="2%" recent="9%" direction="up-bad" />
            </div>
          </Panel>

          <Panel title="Reliability trend" description="Fill rate (solid) and OTIF (muted) by week.">
            <TrendChart />
          </Panel>

          <Panel title="Why flagged">
            <ul className="space-y-2 text-[0.9375rem] text-body">
              <li>Fill rate fell 18 points below this supplier&apos;s baseline over the recent window.</li>
              <li>Cancellations rose from 2% to 9% across 41 evaluated orders.</li>
              <li>P95 lead time moved from 44h to 72h.</li>
            </ul>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Affected orders">
              <ul className="divide-y divide-line">
                {["ORD-DEMO-1002", "ORD-DEMO-1004"].map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-[0.9375rem] font-semibold text-ink">{id}</span>
                    <EvidenceLink label="View order" to="/orders" />
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Affected decisions">
              <ul className="divide-y divide-line">
                {["DEC-DEMO-4410"].map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-[0.9375rem] font-semibold text-ink">{id}</span>
                    <EvidenceLink label="Open replay" to="/orders" />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </PageBody>
    </AppShell>
  );
}
