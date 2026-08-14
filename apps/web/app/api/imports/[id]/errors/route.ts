import { NextResponse } from 'next/server';
import { listIngestionErrors } from '@/lib/db/repositories/ingestion-errors';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const search = new URL(request.url).searchParams;
  const after = parseBoundedInteger(search.get('afterRow'), 0, 2_147_483_647, 0);
  const limit = parseBoundedInteger(search.get('limit'), 1, 100, 50);
  try {
    const errors = await listIngestionErrors(id, after, limit);
    return NextResponse.json({ errors });
  } catch {
    return NextResponse.json({ error: 'Failed to read ingestion errors.' }, { status: 500 });
  }
}

function parseBoundedInteger(
  input: string | null,
  minimum: number,
  maximum: number,
  fallback: number
): number {
  if (!input || !/^\d+$/.test(input)) return fallback;
  const parsed = parseInt(input, 10);
  return parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
