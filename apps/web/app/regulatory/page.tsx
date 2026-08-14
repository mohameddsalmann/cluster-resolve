'use client';

import { ScrollText } from 'lucide-react';
import { AppShell, PageBody, TopContextBar } from '@/components/cluster/AppShell';
import {
  ClusterIconChip,
  PageHeader,
  Panel,
  StatusChip,
} from '@/components/cluster/primitives';

export default function RegulatoryPage() {
  return (
    <AppShell>
      <TopContextBar title="Regulatory" subtitle="Egyptian Drug Authority (EDA) notices & batch matching" />
      <PageBody wide>
        <PageHeader
          title="Regulatory"
          subtitle="Official Egyptian Drug Authority notices matched against imported batch data."
          actions={<StatusChip label="UNIMPORTED / PENDING" tone="neutral" />}
        />

        <div className="space-y-6">
          <Panel>
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <ClusterIconChip icon={ScrollText} size="large" tone="soft" />
              <div className="max-w-lg">
                <h2 className="cl-card-title">Not available until regulatory data is imported</h2>
                <p className="mt-2 text-[0.9375rem] text-body">
                  Official Egyptian Drug Authority (EDA) recall and defect notices will appear here once ingested and linked to batch records. No simulated regulatory exposure is displayed.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </PageBody>
    </AppShell>
  );
}
