import { NextResponse } from 'next/server';
import { listOrderReadModels } from '@/lib/operations/read-models';

export async function GET(request: Request) {
  const datasetId = new URL(request.url).searchParams.get('datasetId');
  if (!datasetId) return NextResponse.json({ error: 'datasetId is required.' }, { status: 400 });
  try {
    return NextResponse.json({ orders: await listOrderReadModels(datasetId) });
  } catch {
    return NextResponse.json({ error: 'Failed to load operational orders.' }, { status: 500 });
  }
}
