import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Gavel,
  Layers,
  UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AppShell, PageBody, TopContextBar } from "@/components/cluster/AppShell";
import { DataTable, type Column } from "@/components/cluster/DataTable";
import {
  ClusterButton,
  ClusterIconChip,
  CoverageMetric,
  DatasetModeChip,
  ErrorState,
  PageHeader,
  Panel,
  StatusChip,
} from "@/components/cluster/primitives";
import { importRowErrors } from "@/lib/ui-fixtures";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/imports")({
  head: () => ({
    meta: [
      { title: "Imports — Cluster Resolve" },
      {
        name: "description",
        content:
          "Select a dataset and import type, upload orders, offers, outcomes or decisions, and review processing results and data quality coverage.",
      },
      { property: "og:title", content: "Imports — Cluster Resolve" },
      {
        property: "og:description",
        content: "Bring procurement records in, then see exactly what became evaluable.",
      },
    ],
  }),
  component: ImportsPage,
});

const importTypes: { key: string; label: string; icon: LucideIcon; hint: string }[] = [
  { key: "orders", label: "Orders", icon: ClipboardList, hint: "Requested products and quantities" },
  { key: "offers", label: "Offers", icon: Layers, hint: "Supplier offers at decision time" },
  { key: "outcomes", label: "Outcomes", icon: CheckCircle2, hint: "What was actually delivered" },
  { key: "decisions", label: "Decisions", icon: Gavel, hint: "Selections made by the agent" },
];

type ErrorRow = (typeof importRowErrors)[number];

const errorColumns: Column<ErrorRow>[] = [
  { key: "row", header: "Row", align: "right", cell: (r) => r.row },
  { key: "field", header: "Field", cell: (r) => <span className="text-ink">{r.field}</span> },
  { key: "code", header: "Code", cell: (r) => <code className="text-[0.8125rem]">{r.code}</code> },
  { key: "message", header: "Message", cell: (r) => r.message },
  { key: "raw", header: "Raw Value", cell: (r) => <code className="text-[0.8125rem]">{r.raw}</code> },
];

type Phase = "idle" | "uploading" | "validating" | "processing" | "complete";

function ImportsPage() {
  const [dataset, setDataset] = useState("demo-eg-01");
  const [type, setType] = useState("orders");
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function accept(f: File) {
    setFile({ name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` });
    setPhase("uploading");
    window.setTimeout(() => setPhase("validating"), 700);
    window.setTimeout(() => setPhase("processing"), 1400);
    window.setTimeout(() => setPhase("complete"), 2200);
  }

  const phaseLabel: Record<Phase, string> = {
    idle: "Waiting for a file",
    uploading: "Uploading",
    validating: "Validating",
    processing: "Processing",
    complete: "Complete",
  };
  const progress = { idle: 0, uploading: 40, validating: 65, processing: 85, complete: 100 }[phase];

  return (
    <AppShell>
      <TopContextBar
        title="Imports"
        subtitle="Dataset, import type, file, processing, result"
        dataset={`Dataset · ${dataset}`}
      />
      <PageBody wide>
        <PageHeader
          title="Imports"
          subtitle="Bring procurement records in, then see exactly what became evaluable."
        />

        <div className="space-y-6">
          <Panel title="Dataset" description="Imports are always scoped to a single dataset.">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_auto] sm:items-end">
              <div>
                <label htmlFor="dataset" className="cl-label mb-1.5 block">
                  Active dataset
                </label>
                <select
                  id="dataset"
                  className="cl-field"
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                >
                  <option value="demo-eg-01">demo-eg-01 · sample</option>
                  <option value="cairo-pilot">cairo-pilot · imported real</option>
                  <option value="live-eg">live-eg · live</option>
                </select>
              </div>
              <div className="flex pb-2.5">
                <DatasetModeChip
                  mode={
                    dataset === "demo-eg-01"
                      ? "SAMPLE"
                      : dataset === "cairo-pilot"
                        ? "IMPORTED REAL"
                        : "LIVE"
                  }
                />
              </div>
            </div>
          </Panel>

          <Panel title="Import type" description="Each type unlocks a different part of the evaluation.">
            <div
              role="radiogroup"
              aria-label="Import type"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {importTypes.map((t) => {
                const active = t.key === type;
                return (
                  <button
                    key={t.key}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(t.key)}
                    className={cn(
                      "flex min-h-11 flex-col items-start gap-3 rounded-[12px] border p-4 text-left transition-colors duration-200",
                      active
                        ? "border-cluster-bright bg-[rgba(15,110,255,0.04)]"
                        : "border-line bg-white hover:border-cluster-bright",
                    )}
                  >
                    <ClusterIconChip icon={t.icon} size="compact" tone={active ? "brand" : "soft"} />
                    <div>
                      <p className="text-[1rem] font-semibold text-ink">{t.label}</p>
                      <p className="cl-meta">{t.hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="File" description="CSV export matching the documented column set.">
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
                if (f) accept(f);
              }}
              className={cn(
                "flex flex-col items-center gap-4 rounded-[12px] border-[1.5px] border-line bg-surface px-6 py-14 text-center transition-colors duration-200",
                dragging && "border-cluster-bright bg-white",
              )}
            >
              <ClusterIconChip icon={UploadCloud} size="large" />
              <div>
                <p className="text-[1.125rem] font-semibold text-ink">
                  Drop your {type} file here
                </p>
                <p className="mt-1 text-[0.9375rem] text-body">or choose a file from your device</p>
              </div>
              <ClusterButton size="sm" onClick={() => inputRef.current?.click()}>
                Choose file
              </ClusterButton>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="sr-only"
                aria-label="Choose import file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) accept(f);
                }}
              />
            </div>

            {file ? (
              <div className="mt-4 rounded-[12px] border border-line p-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                  <ClusterIconChip icon={FileSpreadsheet} size="compact" tone="soft" />
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">{file.name}</p>
                    <p className="cl-meta">{file.size}</p>
                  </div>
                  <StatusChip
                    label={phaseLabel[phase]}
                    tone={phase === "complete" ? "success" : "brand"}
                  />
                </div>
                <div
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                >
                  <div
                    className="h-full rounded-full bg-cluster-bright transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </Panel>

          {phase === "complete" ? (
            <>
              <Panel
                title="Processing result"
                action={<StatusChip label="PARTIAL SUCCESS" tone="caution" />}
              >
                <dl className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["Processed", "412"],
                    ["Accepted", "409"],
                    ["Rejected", "3"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[8px] bg-surface p-4">
                      <dt className="cl-meta">{k}</dt>
                      <dd className="mt-1 text-[1.5rem] font-bold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>

              <ErrorState
                title="We couldn't process every row."
                detail="3 rows contain invalid values. Everything else was imported."
              />

              <section aria-label="Row errors">
                <h2 className="cl-card-title mb-3">Row errors</h2>
                <DataTable
                  columns={errorColumns}
                  rows={importRowErrors}
                  rowKey={(r) => `${r.row}-${r.field}`}
                  caption="Rejected rows"
                />
              </section>
            </>
          ) : null}

          <section aria-label="Data quality">
            <h2 className="cl-section-title mb-4">Data quality</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CoverageMetric label="Orders ready for evaluation" value={232} total={240} state="AVAILABLE" />
              <CoverageMetric label="Outcome coverage" value={188} total={240} state="PARTIAL" />
              <CoverageMetric label="Decisions with offer context" value={148} total={232} state="PARTIAL" />
              <CoverageMetric
                label="Comparative replay coverage"
                value={0}
                total={0}
                state="INSUFFICIENT DATA"
              />
            </div>
          </section>
        </div>
      </PageBody>
    </AppShell>
  );
}
