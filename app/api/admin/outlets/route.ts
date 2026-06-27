import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {repos} from '@/lib/repos';

export const dynamic = 'force-dynamic';

const createOutletSchema = z.object({
  name: z.string().min(1),
  ownerName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  beat: z.string().min(1),
  type: z.enum(['customer', 'prospect']),
  notes: z.string().optional(),
});

export async function GET() {
  const outlets = await repos.outlets.list();
  outlets.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return NextResponse.json({outlets});
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = createOutletSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({error: 'Invalid data', details: parsed.error.flatten()}, {status: 400});
    }
    const outlet = await repos.outlets.create(parsed.data);
    return NextResponse.json({outlet}, {status: 201});
  } catch {
    return NextResponse.json({error: 'Failed to create outlet'}, {status: 500});
  }
}
