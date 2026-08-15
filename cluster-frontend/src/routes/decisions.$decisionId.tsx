import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, FileSearch } from "lucide-react";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import {
  ClusterButton,
  ClusterIconChip,
  EvidenceLink,
  PageHeader,
  Panel,
  StatusChip,
  Timeline,
} from "@/components/cluster/primitives";
import { offerComparison } from "@/lib/ui-fixtures";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/decisions/$decisionId")({
  head: ({ params }) => ({
    meta: [
      { title: `Decision replay ${params.decisionId} — Cluster Resolve` },
      {
        name: "description",
        content:
          "Forensic decision replay: inputs, available offers, the selected supplier, the actual outcome, the better alternative and decision quality.",
      },
      { property: "og:title", content: `Decision replay ${params.decisionId}` },
      {
        property: "og:description",
        content: "What was known, what was chosen, what happened, and what would have been better.",
      },
    ],
  }),
  component: DecisionReplay,
});

function StageLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.6875rem] font-bold tracking-[0.14em] text-cluster-bright uppercase">
        {label}
      </span>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}

function StageArrow() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <ArrowDown className="h-4 w-4 text-body" />
    </div>
  );
}

function DecisionReplay() {
  const { decisionId } = Route.useParams();

  return (
    <AppShell>
      <TopContextBar title={`Decision ${decisionId}`} subtitle="Forensic replay" />
      <PageBody>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            to="/orders/$orderId"
            params={{ orderId: "ORD-DEMO-1008" }}
            className="text-[0.875rem] font-semibold text-cluster-bright hover:text-cluster-deep"
          >
            ← Order ORD-DEMO-1008
          </Link>
        </nav>

        <PageHeader
          title="Decision replay"
          subtitle="Inputs → available offers → selected → actual outcome → alternative → decision quality"
        />

        <div className="space-y-6">
          <Panel title="Decision header">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-5">
              {[
                ["Decision ID", decisionId],
                ["Time", "14 Aug 2026 09:47"],
                ["Agent", "procurement-selector"],
                ["Agent version", "v1.4.2"],
                ["Confidence", "0.62"],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="cl-meta">{k}</dt>
                  <dd className="text-[0.9375rem] font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <StageLabel label="Inputs" />
          <Panel title="Order context">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-3">
              <div>
                <dt className="cl-meta">Pharmacy</dt>
                <dd className="text-[0.9375rem] font-semibold text-ink">Giza Medic</dd>
              </div>
              <div>
                <dt className="cl-meta">Products</dt>
                <dd className="text-[0.9375rem] font-semibold text-ink">Paracetamol 500mg</dd>
              </div>
              <div>
                <dt className="cl-meta">Requested quantities</dt>
                <dd className="text-[0.9375rem] font-semibold text-ink">120 units</dd>
              </div>
            </dl>
          </Panel>

          <StageArrow />
          <StageLabel label="Available offers" />
          <Panel title="What was known at decision time">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <caption className="sr-only">Offers available at decision time</caption>
                <thead>
                  <tr className="bg-surface">
                    {["Supplier", "Price", "Discount", "Available", "Promised", "Feasible", "Selected"].map(
                      (h) => (
                        <th
                          key={h}
                          scope="col"
                          className="border-b border-line px-4 py-3 text-[0.8125rem] font-semibold whitespace-nowrap text-ink"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {offerComparison.map((o) => (
                    <tr
                      key={o.supplier}
                      className={cn(
                        "border-b border-line/70 text-[0.875rem] text-body last:border-b-0",
                        o.selected && "bg-[rgba(15,110,255,0.06)]",
                      )}
                    >
                      <td
                        className={cn(
                          "h-14 px-4 py-3 text-ink",
                          o.selected && "border-l-2 border-l-cluster-bright font-semibold",
                        )}
                      >
                        {o.supplier}
                      </td>
                      <td className="px-4 py-3">{o.price}</td>
                      <td className="px-4 py-3">{o.discount}</td>
                      <td className="px-4 py-3">{o.available}</td>
                      <td className="px-4 py-3">{o.promised}</td>
                      <td className="px-4 py-3">
                        <StatusChip
                          label={o.feasible ? "Feasible" : "Not feasible"}
                          tone={o.feasible ? "success" : "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {o.selected ? <StatusChip label="Selected" tone="brand" /> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <StageArrow />
          <StageLabel label="Selected" />
          <Panel title="Selection reason">
            <p className="text-[0.9375rem] text-body">No selection reason was provided.</p>
          </Panel>

          <StageArrow />
          <StageLabel label="Actual outcome" />
          <Panel title="What happened">
            <Timeline
              items={[
                { label: "Requested", time: "14 Aug 09:47", detail: "120 units requested" },
                { label: "Accepted", time: "14 Aug 10:20", detail: "Supplier accepted 90 units" },
                { label: "Delivered", time: "16 Aug 08:05", detail: "72 units delivered", tone: "caution" },
                {
                  label: "Partial fulfillment recorded",
                  time: "16 Aug 08:06",
                  detail: "48 units unfilled",
                  tone: "danger",
                },
              ]}
            />
          </Panel>

          <StageArrow />
          <StageLabel label="Alternative" />
          <Panel title="Better alternative" description="Feasible at decision time, not selected.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[8px] border border-line p-4">
                <p className="cl-meta">Selected</p>
                <p className="text-[1rem] font-semibold text-ink">SUP-DEMO-02 · Horus Distribution</p>
                <ul className="mt-3 space-y-1 text-[0.875rem] text-body">
                  <li>Price 18.40 EGP</li>
                  <li>Available 90 units</li>
                  <li>Promised 24h</li>
                </ul>
              </div>
              <div className="rounded-[8px] border border-cluster-bright bg-[rgba(15,110,255,0.04)] p-4">
                <p className="cl-meta">Alternative</p>
                <p className="text-[1rem] font-semibold text-ink">SUP-DEMO-01 · Cairo Medical Supply</p>
                <ul className="mt-3 space-y-1 text-[0.875rem] text-body">
                  <li>Price 17.05 EGP</li>
                  <li>Available 120 units</li>
                  <li>Promised 36h</li>
                </ul>
              </div>
            </div>
          </Panel>

          <StageArrow />
          <StageLabel label="Decision quality" />
          <Panel title="Explainable metrics">
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Price difference", "1.35 EGP / unit"],
                ["Unfilled units", "48"],
                ["Lateness", "+12h beyond promise"],
                ["Cancellation impact", "None recorded"],
              ].map(([k, v]) => (
                <div key={k} className="cl-panel p-4">
                  <dt className="cl-meta">{k}</dt>
                  <dd className="mt-1 text-[1.25rem] font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[8px] bg-surface p-4">
              <StatusChip label="Estimate" tone="caution" />
              <p className="text-[0.9375rem] text-body">
                Operational regret 1,840 EGP — derived from recorded price and quantity only.
              </p>
            </div>
          </Panel>

          <Panel title="Evidence">
            <div className="flex flex-wrap items-center gap-4">
              <ClusterIconChip icon={FileSearch} size="standard" tone="soft" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] text-body">
                  Offers, outcomes and the decision record behind this replay.
                </p>
                <div className="mt-2">
                  <EvidenceLink label="Open imports" to="/imports" />
                </div>
              </div>
              <ClusterButton variant="secondary" size="sm">
                Show underlying records
              </ClusterButton>
            </div>
          </Panel>
        </div>
      </PageBody>
    </AppShell>
  );
}
