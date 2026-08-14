import { NextResponse } from 'next/server';
import { processStoredImport } from '@/lib/imports/service';
import { jobErrorResponse } from '@/lib/imports/errors';

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await processStoredImport(id);
    return NextResponse.json(result, { status: result.state === 'FAILED' ? 422 : 200 });
  } catch (error) {
    return NextResponse.json({ error: jobErrorResponse(error) }, { status: 400 });
  }
}
