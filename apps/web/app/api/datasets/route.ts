import { NextResponse } from 'next/server';
import { listDatasets } from '@/lib/db/repositories/datasets';

export async function GET() {
  try {
    const datasets = await listDatasets();
    return NextResponse.json({ datasets });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list datasets', details: String(error) },
      { status: 500 }
    );
  }
}
