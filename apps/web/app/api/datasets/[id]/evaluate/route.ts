import { NextResponse } from 'next/server';
import { evaluateDatasetSchema } from '@cluster/schemas/operations';
import { evaluateDatasetOperations } from '@/lib/operations/evaluate';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const text = await request.text();
    const parsed = evaluateDatasetSchema.safeParse(text ? JSON.parse(text) : {});
    if (!parsed.success) {
      return NextResponse.json({ error: 'Request must contain only an optional explicit-timezone asOf timestamp.' }, { status: 400 });
    }
    return NextResponse.json({ evaluation: await evaluateDatasetOperations(id, parsed.data.asOf) });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    if (error instanceof Error && error.message === 'Dataset not found.') {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Dataset operational evaluation failed safely.' }, { status: 500 });
  }
}
