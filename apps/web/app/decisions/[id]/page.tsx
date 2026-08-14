'use client';

import { use } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  ClusterIconChip,
  PageHeader,
  Panel,
  StatusChip,
} from '@/components/cluster/primitives';

export default function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: decisionId } = use(params);

  return (
    <AppShell>
      <TopContextBar title={`Decision ${decisionId}`} subtitle="Forensic decision replay" />
      <PageBody>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-[0.875rem] font-semibold text-cluster-bright hover:text-cluster-deep"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </nav>

        <PageHeader
          title="Decision Replay"
          subtitle="Forensic reconstruction of supplier selection, alternatives, and operational outcomes."
          actions={<StatusChip label="PHASE 5 ENGINE PENDING" tone="neutral" />}
        />

        <div className="space-y-6">
          <Panel>
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <ClusterIconChip icon={Sparkles} size="large" tone="soft" />
              <h2 className="cl-card-title">Decision Replay Engine Coming in Phase 5</h2>
              <p className="max-w-md text-[0.9375rem] text-body">
                The forensic decision replay engine, multi-offer comparison, and procurement regret analytics are scheduled for Phase 5.
              </p>
              <div className="mt-2 rounded-md bg-surface px-4 py-2 text-xs font-mono text-ink border border-line">
                Decision reference: {decisionId}
              </div>
            </div>
          </Panel>
        </div>
      </PageBody>
    </AppShell>
  );
}
