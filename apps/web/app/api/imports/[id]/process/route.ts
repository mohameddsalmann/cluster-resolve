import { NextResponse } from 'next/server';
import { processStoredImport } from '@/lib/imports/service';
import { jobErrorResponse } from '@/lib/imports/errors';

export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    let mapping: Record<string, string | null> | undefined = undefined;

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        if (body && typeof body.mapping === 'object') {
          mapping = body.mapping;
        }
      } catch {
        // Body is optional or empty
      }
    }

    const result = await processStoredImport(id, mapping);
    return NextResponse.json(result, { status: result.state === 'FAILED' ? 422 : 200 });
  } catch (error) {
    return NextResponse.json({ error: jobErrorResponse(error) }, { status: 400 });
  }
}
