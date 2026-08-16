import { NextResponse } from 'next/server';
import { listOrderReadModels } from '@/lib/operations/read-models';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const datasetId = params.get('datasetId');
  if (!datasetId) return NextResponse.json({ error: 'datasetId is required.' }, { status: 400 });
  try {
    const requestedPage = Number.parseInt(params.get('page') || '1', 10);
    const requestedLimit = Number.parseInt(params.get('limit') || '100', 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isFinite(requestedLimit) ? Math.min(250, Math.max(1, requestedLimit)) : 100;
    const result = await listOrderReadModels(datasetId, {
      limit,
      offset: (page - 1) * limit,
    });
    return NextResponse.json({ ...result, page, pageSize: limit });
  } catch {
    return NextResponse.json({ error: 'Failed to load operational orders.' }, { status: 500 });
  }
}
