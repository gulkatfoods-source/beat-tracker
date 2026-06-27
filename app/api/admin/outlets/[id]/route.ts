import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {repos} from '@/lib/repos';

export const dynamic = 'force-dynamic';

const updateOutletSchema = z.object({
  name: z.string().min(1).optional(),
  ownerName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  beat: z.string().min(1).optional(),
  type: z.enum(['customer', 'prospect']).optional(),
  notes: z.string().optional(),
});

export async function PUT(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    const existing = await repos.outlets.getById(id);
    if (!existing) return NextResponse.json({error: 'Not found'}, {status: 404});

    const raw = await req.json();
    const parsed = updateOutletSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({error: 'Invalid data', details: parsed.error.flatten()}, {status: 400});
    }
    await repos.outlets.update(id, parsed.data);
    return NextResponse.json({ok: true});
  } catch {
    return NextResponse.json({error: 'Failed to update outlet'}, {status: 500});
  }
}

export async function DELETE(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    const existing = await repos.outlets.getById(id);
    if (!existing) return NextResponse.json({error: 'Not found'}, {status: 404});
    await repos.outlets.delete(id);
    return NextResponse.json({ok: true});
  } catch {
    return NextResponse.json({error: 'Failed to delete outlet'}, {status: 500});
  }
}
