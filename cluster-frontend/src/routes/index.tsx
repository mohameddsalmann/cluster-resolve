import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  FileStack,
  PackageSearch,
  ScrollText,
  Sparkles,
  Truck,
} from "lucide-react";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import {
  ClusterIconChip,
  linkButtonClass,
  Metric,
  PageHeader,
  SectionHeader,
  SeverityBadge,
  StatusChip,
} from "@/components/cluster/primitives";
import { attentionItems, type AttentionItem } from "@/lib/ui-fixtures";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Resolve — Cluster Resolve procurement reliability" },
      {
        name: "description",
        content:
          "Resolve surfaces what needs attention across pharmacy orders, supplier reliability and regulatory exposure in one operational queue.",
      },
      { property: "og:title", content: "Resolve — Cluster Resolve" },
      {
        property: "og:description",
        content:
          "Procurement reliability and regulatory risk, in one operational queue for Egyptian pharmacy supply.",
      },
    ],
  }),
  component: ResolvePage,
});

const typeIcon = {
  order: PackageSearch,
  supplier: Truck,
  regulatory: ScrollText,
  decision: Sparkles,
  import: FileStack,
} as const;

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = typeIcon[item.type];
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-4 transition-colors duration-150 hover:bg-[rgba(15,110,255,0.03)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-5">
        <ClusterIconChip icon={Icon} size="compact" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={item.severity} />
            <h3 className="text-[1rem] font-semibold text-ink">{item.title}</h3>
            <span className="cl-meta">{item.time}</span>
          </div>
          <p className="mt-1 text-[0.9375rem] text-body">{item.reason}</p>
          <p className="cl-meta mt-1">
            {item.entity} · {item.impact}
          </p>
        </div>
        <div className="col-span-2 md:col-span-1 md:shrink-0">
          <Link
            to={item.href as "/"}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-line bg-white px-3.5 text-[0.875rem] font-semibold text-cluster-bright transition-colors duration-200 hover:border-cluster-bright"
          >
            {item.type === "order"
              ? "View order"
              : item.type === "supplier"
                ? "View supplier"
                : item.type === "decision"
                  ? "Open decision replay"
                  : "Review"}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

function ResolvePage() {
  return (
    <AppShell>
      <TopContextBar
        title="Resolve"
        subtitle="Procurement reliability and regulatory risk"
      />
      <PageBody>
        <PageHeader
          title="Resolve"
          subtitle="Procurement reliability and regulatory risk"
          actions={
            <>
              <Link to="/imports" className={linkButtonClass("secondary", "sm")}>
                Import data
              </Link>
              <Link to="/orders" className={linkButtonClass("primary", "sm")}>
                Open order queue
              </Link>
            </>
          }
        />

        <section aria-labelledby="needs-attention" className="mb-12">
          <SectionHeader
            id="needs-attention"
            title="What needs attention?"
            description="Ranked by operational severity across the active dataset."
            action={
              <StatusChip
                label={`${attentionItems.length} open items`}
                tone="brand"
                icon={AlertTriangle}
              />
            }
          />
          <ul className="cl-panel overflow-hidden">
            {attentionItems.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="pulse">
          <SectionHeader
            id="pulse"
            title="Operational pulse"
            description="Compact coverage-aware metrics for the current evaluation window."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Metric
              label="Orders evaluated"
              value="232"
              coverage="Coverage 232 of 240 imported orders"
              state={{ label: "AVAILABLE", tone: "success" }}
              evidence={{ label: "View orders", to: "/orders" }}
            />
            <Metric
              label="Orders with exceptions"
              value="31"
              coverage="Partial, late or cancelled outcomes"
              state={{ label: "AVAILABLE", tone: "success" }}
              evidence={{ label: "Filter exceptions", to: "/orders" }}
            />
            <Metric
              label="Suppliers under watch"
              value="2"
              coverage="Of 5 suppliers with enough evaluated orders"
              state={{ label: "AVAILABLE", tone: "success" }}
              evidence={{ label: "View suppliers", to: "/suppliers" }}
            />
            <Metric
              label="Decisions evaluable"
              value="64%"
              coverage="148 of 232 decisions have offer context"
              state={{ label: "PARTIAL", tone: "caution" }}
              evidence={{ label: "Improve coverage", to: "/imports" }}
            />
            <Metric
              label="Regulatory exposures"
              value="2 exact · 1 possible"
              coverage="Against 3 active EDA notices"
              state={{ label: "AVAILABLE", tone: "success" }}
              evidence={{ label: "Review exposure", to: "/regulatory" }}
            />
            <Metric
              label="Expiry recovery value"
              value="8,110 EGP"
              coverage="Estimate from recorded batch data"
              state={{ label: "ESTIMATE", tone: "caution" }}
              evidence={{ label: "Open recovery", to: "/regulatory" }}
            />
          </div>
        </section>
      </PageBody>
    </AppShell>
  );
}
