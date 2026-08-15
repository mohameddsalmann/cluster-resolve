import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileUp, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import { DataTable, type Column } from "@/components/cluster/DataTable";
import {
  ClusterButton,
  ClusterIconChip,
  FindingBadge,
  PageHeader,
  Panel,
  StatusChip,
} from "@/components/cluster/primitives";
import { preflightFindings } from "@/lib/ui-fixtures";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/traceability")({
  head: () => ({
    meta: [
      { title: "EPTTS Preflight — Cluster Resolve" },
      {
        name: "description",
        content:
          "Prototype traceability validation against verified rules, with blocking findings, advisory findings and items needing human verification.",
      },
      { property: "og:title", content: "EPTTS Preflight — Cluster Resolve" },
      {
        property: "og:description",
        content: "Validate traceability files against verified rules before submission preparation.",
      },
    ],
  }),
  component: TraceabilityPage,
});

type Finding = (typeof preflightFindings)[number];

const columns: Column<Finding>[] = [
  { key: "row", header: "Row", align: "right", cell: (f) => f.row },
  { key: "rule", header: "Rule", cell: (f) => <span className="text-ink">{f.rule}</span> },
  { key: "field", header: "Field", cell: (f) => f.field },
  { key: "actual", header: "Actual", cell: (f) => <code className="text-[0.8125rem]">{f.actual}</code> },
  { key: "expected", header: "Expected", cell: (f) => f.expected },
  { key: "message", header: "Message", cell: (f) => f.message },
  { key: "verification", header: "Verification", cell: (f) => f.verification },
];

function TraceabilityPage() {
  const [file, setFile] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = [
    { kind: "BLOCKING" as const, items: preflightFindings.filter((f) => f.kind === "BLOCKING") },
    { kind: "ADVISORY" as const, items: preflightFindings.filter((f) => f.kind === "ADVISORY") },
    {
      kind: "NEEDS VERIFICATION" as const,
      items: preflightFindings.filter((f) => f.kind === "NEEDS VERIFICATION"),
    },
  ];

  const verdict = file ? (groups[0]!.items.length > 0 ? "FAIL" : "PASS") : "NOT EVALUATED";

  return (
    <AppShell>
      <TopContextBar title="EPTTS Preflight" subtitle="Prototype validation against verified rules" />
      <PageBody wide>
        <PageHeader
          title="EPTTS Preflight"
          subtitle="Prototype validation against verified rules"
          actions={
            <StatusChip
              label={`Verdict: ${verdict}`}
              tone={verdict === "FAIL" ? "danger" : verdict === "PASS" ? "success" : "neutral"}
            />
          }
        />

        <div className="space-y-6">
          <Panel title="Upload traceability file" description="CSV or XML export, up to 20 MB.">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f.name);
              }}
              className={cn(
                "flex flex-col items-center gap-4 rounded-[12px] border border-line bg-surface px-6 py-12 text-center transition-colors duration-200",
                dragging && "border-cluster-bright bg-white",
              )}
            >
              <ClusterIconChip icon={FileUp} size="large" />
              <div>
                <p className="text-[1rem] font-semibold text-ink">
                  {file ?? "Drop your traceability file here"}
                </p>
                <p className="mt-1 text-[0.9375rem] text-body">
                  Files are validated in this prototype only. Nothing is submitted anywhere.
                </p>
              </div>
              <ClusterButton size="sm" onClick={() => inputRef.current?.click()}>
                Choose file
              </ClusterButton>
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                aria-label="Choose traceability file"
                onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
              />
            </div>
          </Panel>

          {verdict === "NOT EVALUATED" ? (
            <Panel>
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <ClusterIconChip icon={ShieldCheck} size="large" />
                <h2 className="cl-card-title">Not evaluated yet</h2>
                <p className="max-w-md text-[0.9375rem] text-body">
                  Upload a file to run the verified rule set. This prototype never states that a file
                  is approved or will be accepted by any authority.
                </p>
              </div>
            </Panel>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {groups.map((g) => (
                  <div key={g.kind} className="cl-panel p-4">
                    <FindingBadge kind={g.kind} />
                    <p className="mt-3 text-[1.75rem] leading-none font-bold text-ink">
                      {g.items.length}
                    </p>
                    <p className="cl-meta mt-1">
                      {g.kind === "BLOCKING"
                        ? "Must be corrected before preparation"
                        : g.kind === "ADVISORY"
                          ? "Recommended corrections"
                          : "Outside the verified rule set"}
                    </p>
                  </div>
                ))}
              </div>

              {groups.map((g) =>
                g.items.length === 0 ? null : (
                  <section key={g.kind} aria-label={`${g.kind} findings`}>
                    <div className="mb-3 flex items-center gap-3">
                      <FindingBadge kind={g.kind} />
                      <h2 className="cl-card-title">
                        {g.kind === "BLOCKING"
                          ? "Blocking findings"
                          : g.kind === "ADVISORY"
                            ? "Advisory findings"
                            : "Needs verification"}
                      </h2>
                    </div>
                    <DataTable
                      columns={columns}
                      rows={g.items}
                      rowKey={(f) => `${f.rule}-${f.row}`}
                      caption={`${g.kind} findings`}
                    />
                  </section>
                ),
              )}

              <Panel>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-cluster-bright" aria-hidden="true" />
                  <p className="text-[0.875rem] text-body">
                    All rules referenced above are verified against published specifications. Rules
                    that could not be verified are reported as needing human verification.
                  </p>
                </div>
              </Panel>
            </>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}
