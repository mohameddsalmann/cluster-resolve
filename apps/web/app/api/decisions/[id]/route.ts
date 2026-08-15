import { NextResponse } from 'next/server';
import { getDecisionReplay } from '@/lib/decisions/service';

function serializeReplayResult(result: unknown): unknown {
  return JSON.parse(
    JSON.stringify(result, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const datasetId = new URL(request.url).searchParams.get('datasetId');
  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId query parameter is required.' }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const replay = await getDecisionReplay(datasetId, id);
    if (!replay) {
      return NextResponse.json(
        { error: 'Decision not found in the active dataset.' },
        { status: 404 }
      );
    }
    return NextResponse.json(serializeReplayResult(replay));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate decision replay.' },
      { status: 500 }
    );
  }
}
