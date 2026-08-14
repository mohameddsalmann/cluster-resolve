import { NextResponse } from 'next/server';
import { getImportJob } from '@/lib/db/repositories/ingestion-jobs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const job = await getImportJob(id);
    if (!job) return NextResponse.json({ error: 'Import job not found.' }, { status: 404 });
    return NextResponse.json({
      job: {
        id: job.id,
        datasetId: job.dataset_id,
        kind: job.kind,
        status: job.status,
        result:
          job.status === 'COMPLETED'
            ? job.error_rows > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS'
            : job.status,
        filename: job.original_filename,
        totalRows: job.total_rows,
        processedRows: job.processed_rows,
        acceptedRows: job.valid_rows,
        rejectedRows: job.error_rows,
        errorMessage: job.error_message,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        createdAt: job.created_at,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read the import job.' }, { status: 500 });
  }
}
