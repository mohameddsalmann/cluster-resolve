import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getDatasetById } from '@/lib/db/repositories/datasets';
import { getTraceabilityRepositoryStatus } from '@/lib/db/repositories/traceability';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { datasetId, filename, sourceType } = body;

    if (!datasetId || !filename) {
      return NextResponse.json(
        { error: 'Missing required parameters: datasetId and filename' },
        { status: 400 }
      );
    }

    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }


    const repositoryStatus = await getTraceabilityRepositoryStatus();
    if (!repositoryStatus.available) {
      return NextResponse.json({ error: repositoryStatus.reason }, { status: 503 });
    }

    const timestamp = Date.now();
    const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sourcePrefix = sourceType === 'OFFICIAL_REFERENCE_TEST' ? 'reference-test' : 'customer';
    const storagePath = `${sourcePrefix}/${datasetId}/${timestamp}_${sanitizedName}`;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from('traceability-imports')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[traceability:upload-url:storage-error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create upload URL';
    console.error('[traceability:upload-url:error]', error);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
