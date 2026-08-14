import { NextResponse } from 'next/server';
import { getSupplierReadModel } from '@/lib/operations/read-models';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const datasetId = new URL(request.url).searchParams.get('datasetId');
  if (!datasetId) return NextResponse.json({ error: 'datasetId is required.' }, { status: 400 });
  try {
    const { id } = await context.params;
    const supplier = await getSupplierReadModel(datasetId, id);
    return supplier
      ? NextResponse.json(supplier)
      : NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Failed to load supplier reliability detail.' }, { status: 500 });
  }
}
