import { NextResponse } from 'next/server';
import { getPharmacyReadModel } from '@/lib/operations/read-models';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const datasetId = new URL(request.url).searchParams.get('datasetId');
  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId is required.' }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const pharmacy = await getPharmacyReadModel(datasetId, id);
    if (!pharmacy) {
      return NextResponse.json({ error: 'Pharmacy not found.' }, { status: 404 });
    }
    return NextResponse.json(pharmacy);
  } catch (error) {
    console.error('[api/pharmacies/detail]', error);
    return NextResponse.json({ error: 'Failed to load pharmacy evidence.' }, { status: 500 });
  }
}
