import { NextResponse } from 'next/server';
import { getOrderReadModel } from '@/lib/operations/read-models';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const datasetId = new URL(request.url).searchParams.get('datasetId');
  if (!datasetId) return NextResponse.json({ error: 'datasetId is required.' }, { status: 400 });
  try {
    const { id } = await context.params;
    const order = await getOrderReadModel(datasetId, id);
    return order
      ? NextResponse.json(order)
      : NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Failed to load the operational order.' }, { status: 500 });
  }
}
