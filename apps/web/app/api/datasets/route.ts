import { NextResponse } from 'next/server';
import { createDatasetSchema } from '@cluster/schemas';
import { createDataset, listDatasets } from '@/lib/db/repositories/datasets';

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

export async function POST(request: Request) {
  try {
    const parsed = createDatasetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid dataset details.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const dataset = await createDataset(parsed.data);
    return NextResponse.json({ dataset }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create dataset', details: String(error) },
      { status: 500 }
    );
  }
}
