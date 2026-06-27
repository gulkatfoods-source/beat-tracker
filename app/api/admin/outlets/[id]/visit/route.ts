import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {repos} from '@/lib/repos';

export const dynamic = 'force-dynamic';

const visitSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  salesperson: z.string().optional(),
});

export async function POST(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    const existing = await repos.outlets.getById(id);
    if (!existing) return NextResponse.json({error: 'Not found'}, {status: 404});

    const raw = await req.json();
    const parsed = visitSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({error: 'Invalid data', details: parsed.error.flatten()}, {status: 400});
    }
    await repos.outlets.addVisit(id, parsed.data);
    return NextResponse.json({ok: true});
  } catch {
    return NextResponse.json({error: 'Failed to record visit'}, {status: 500});
  }
}
