'use client';

import { ShieldCheck } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  ClusterIconChip,
  PageHeader,
  Panel,
  StatusChip,
} from '@/components/cluster/primitives';

export default function TraceabilityPage() {
  return (
    <AppShell>
      <TopContextBar title="Traceability" subtitle="EPTTS validation against verified rule sets" />
      <PageBody wide>
        <PageHeader
          title="EPTTS Preflight"
          subtitle="Prototype validation against Egyptian Pharmaceutical Track & Trace System specifications."
          actions={<StatusChip label="NOT CONFIGURED" tone="neutral" />}
        />

        <div className="space-y-6">
          <Panel>
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <ClusterIconChip icon={ShieldCheck} size="large" tone="soft" />
              <div className="max-w-lg">
                <h2 className="cl-card-title">Not available until traceability files are uploaded</h2>
                <p className="mt-2 text-[0.9375rem] text-body">
                  EPTTS GS1 format validation and serial verification will execute when a traceability file is provided. No simulated validation findings are displayed.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </PageBody>
    </AppShell>
  );
}
