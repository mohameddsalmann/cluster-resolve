import { NextResponse } from 'next/server';
import { initializeImport } from '@/lib/imports/service';
import { jobErrorResponse } from '@/lib/imports/errors';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await initializeImport({
      datasetId: typeof body.datasetId === 'string' ? body.datasetId : '',
      kind: typeof body.kind === 'string' ? body.kind : '',
      filename: typeof body.filename === 'string' ? body.filename : '',
      size: typeof body.size === 'number' ? body.size : -1,
      contentType: typeof body.contentType === 'string' ? body.contentType : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const safe = jobErrorResponse(error);
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
