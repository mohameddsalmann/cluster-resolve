import { NextResponse } from 'next/server';
import { getDatasetById } from '@/lib/db/repositories/datasets';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dataset = await getDatasetById(id);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }
    return NextResponse.json({ dataset });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch dataset', details: String(error) },
      { status: 500 }
    );
  }
}
