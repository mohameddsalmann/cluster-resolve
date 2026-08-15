import { createFileRoute } from "@tanstack/react-router";
import { AlertOctagon, CalendarClock, Download, ScrollText } from "lucide-react";
import { useState } from "react";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import { DataTable, FilterBar, type Column } from "@/components/cluster/DataTable";
import {
  ClusterButton,
  ClusterIconChip,
  Metric,
  PageHeader,
  Panel,
  SourceBadge,
  StatusChip,
} from "@/components/cluster/primitives";
import { edaAlerts, exactMatches, expiryRows, possibleMatches } from "@/lib/ui-fixtures";

export const Route = createFileRoute("/regulatory")({
  head: () => ({
    meta: [
      { title: "Regulatory — Cluster Resolve" },
      {
        name: "description",
        content:
          "EDA alerts, batch exposure separated into exact and possible matches, and expiry recovery preparation for pharmacy procurement.",
      },
      { property: "og:title", content: "Regulatory — Cluster Resolve" },
      {
        property: "og:description",
        content: "Official EDA notices, matched exposure and expiry recovery value.",
      },
    ],
  }),
  component: RegulatoryPage,
});

const tabs = ["EDA Alerts", "Exposure", "Expiry Recovery"];

type ExpiryRow = (typeof expiryRows)[number];

const expiryColumns: Column<ExpiryRow>[] = [
  { key: "supplier", header: "Supplier", cell: (r) => <span className="text-ink">{r.supplier}</span> },
  { key: "product", header: "Product", cell: (r) => r.product },
  { key: "batch", header: "Batch", cell: (r) => r.batch },
  { key: "expiry", header: "Expiry", cell: (r) => r.expiry },
  { key: "qty", header: "Quantity", align: "right", cell: (r) => r.quantity },
  {
    key: "value",
    header: "Estimated Value",
    align: "right",
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        <span className="text-ink">{r.value}</span>
        <StatusChip label="Estimate" tone="caution" />
      </span>
    ),
  },
  { key: "order", header: "Source Order", cell: (r) => r.order },
];

function RegulatoryPage() {
  const [tab, setTab] = useState(tabs[0]!);

  return (
    <AppShell>
      <TopContextBar title="Regulatory" subtitle="EDA alerts, exposure and expiry recovery" />
      <PageBody wide>
        <PageHeader
          title="Regulatory"
          subtitle="Official notices matched against imported batch data. Nothing here is synchronised automatically."
        >
          <FilterBar options={tabs} value={tab} onChange={setTab} label="Regulatory sections" />
        </PageHeader>

        {tab === "EDA Alerts" ? (
          <section aria-label="EDA alerts" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge label="Official EDA source" verified />
              <SourceBadge label="Manual-assisted ingestion" />
            </div>
            {edaAlerts.map((a) => (
              <article key={a.notice} className="cl-panel p-5">
                <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
                  <ClusterIconChip icon={ScrollText} size="standard" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="cl-card-title">Notice {a.notice}</h2>
                      <StatusChip label={a.type} tone="caution" />
                      <span className="cl-meta">Published {a.published}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <dt className="cl-meta">Product</dt>
                        <dd className="text-[0.9375rem] text-ink">{a.product}</dd>
                      </div>
                      <div>
                        <dt className="cl-meta">Manufacturer</dt>
                        <dd className="text-[0.9375rem] text-ink">{a.manufacturer}</dd>
                      </div>
                      <div>
                        <dt className="cl-meta">Batch</dt>
                        <dd className="text-[0.9375rem] text-ink">{a.batch}</dd>
                      </div>
                      <div>
                        <dt className="cl-meta">Source</dt>
                        <dd className="text-[0.9375rem] text-ink">{a.source}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {tab === "Exposure" ? (
          <section aria-label="Exposure" className="space-y-8">
            <Panel
              title="Exact matches"
              description="Batch, product and manufacturer all matched a notice."
              action={<StatusChip label="Confirmed match" tone="danger" icon={AlertOctagon} />}
            >
              <ul className="divide-y divide-line">
                {exactMatches.map((m) => (
                  <li key={m.order} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-semibold text-ink">{m.order}</p>
                      <p className="cl-meta">
                        {m.product} · batch {m.batch} · notice {m.notice}
                      </p>
                    </div>
                    <p className="text-[0.9375rem] text-body">{m.units} units affected</p>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="rounded-[12px] border border-dashed border-line bg-surface p-1">
              <Panel
                title="Possible matches"
                description="Not confirmed. Batch data is missing or partial, so these require human verification."
                action={<StatusChip label="Unconfirmed" tone="caution" />}
              >
                <ul className="divide-y divide-line">
                  {possibleMatches.map((m) => (
                    <li key={m.order} className="py-3">
                      <p className="text-[0.9375rem] font-semibold text-ink">{m.order}</p>
                      <p className="cl-meta">
                        {m.product} · batch {m.batch} · notice {m.notice}
                      </p>
                      <p className="mt-1 text-[0.875rem] text-body">{m.basis}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </section>
        ) : null}

        {tab === "Expiry Recovery" ? (
          <section aria-label="Expiry recovery" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Expired" value="1 batch" coverage="140 units recorded" state={{ label: "ACTION", tone: "danger" }} />
              <Metric label="Under 30 days" value="1 batch" coverage="60 units recorded" state={{ label: "WATCH", tone: "caution" }} />
              <Metric label="30–90 days" value="1 batch" coverage="220 units recorded" state={{ label: "MONITOR", tone: "brand" }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ClusterIconChip icon={CalendarClock} size="compact" tone="soft" />
                <p className="text-[0.9375rem] text-body">
                  Values are estimates derived from recorded batch quantities and prices.
                </p>
              </div>
              <ClusterButton size="sm">
                <Download className="h-4 w-4" aria-hidden="true" />
                Export recovery preparation CSV
              </ClusterButton>
            </div>
            <DataTable
              columns={expiryColumns}
              rows={expiryRows}
              rowKey={(r) => `${r.batch}-${r.order}`}
              caption="Expiry recovery candidates"
            />
          </section>
        ) : null}
      </PageBody>
    </AppShell>
  );
}
