import { NextResponse } from 'next/server';
import { listPharmacyReadModels } from '@/lib/operations/read-models';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get('datasetId');

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId is required' }, { status: 400 });
  }

  try {
    const pharmacies = await listPharmacyReadModels(datasetId);
    return NextResponse.json({ pharmacies });
  } catch (err) {
    console.error('[api/pharmacies] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load pharmacies.' },
      { status: 500 }
    );
  }
}
