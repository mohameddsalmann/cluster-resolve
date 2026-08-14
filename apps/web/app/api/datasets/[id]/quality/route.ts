import { NextResponse } from 'next/server';
import { getDatasetById } from '@/lib/db/repositories/datasets';
import { getDatasetQuality } from '@/lib/imports/quality';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    if (!(await getDatasetById(id))) {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }
    return NextResponse.json({ quality: await getDatasetQuality(id) });
  } catch {
    return NextResponse.json({ error: 'Failed to calculate dataset quality.' }, { status: 500 });
  }
}
