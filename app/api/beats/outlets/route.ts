import {NextRequest, NextResponse} from 'next/server';
import {repos} from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Accept comma-separated ?beats=Beat1,Beat2 or legacy single ?beat=Beat1
  const beatsParam = req.nextUrl.searchParams.get('beats') ?? req.nextUrl.searchParams.get('beat');
  const type = req.nextUrl.searchParams.get('type');

  if (!beatsParam) {
    return NextResponse.json({error: 'beats param required'}, {status: 400});
  }

  const beatList = beatsParam.split(',').map((b) => b.trim()).filter(Boolean);
  if (beatList.length === 0) {
    return NextResponse.json({error: 'beats param required'}, {status: 400});
  }

  // Fetch all beats in parallel
  const results = await Promise.all(beatList.map((b) => repos.outlets.listByBeat(b)));
  let outlets = results.flat();

  if (type === 'customer' || type === 'prospect') {
    outlets = outlets.filter((o) => o.type === type);
  }

  const today = new Date().toISOString().split('T')[0];
  outlets.sort((a, b) => {
    const aToday = a.lastVisited === today ? 1 : 0;
    const bToday = b.lastVisited === today ? 1 : 0;
    if (aToday !== bToday) return bToday - aToday;
    return (b.lastVisited ?? '').localeCompare(a.lastVisited ?? '');
  });

  return NextResponse.json({outlets, today});
}
