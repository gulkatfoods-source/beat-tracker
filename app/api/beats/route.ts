import {NextResponse} from 'next/server';
import {repos} from '@/lib/repos';

export const dynamic = 'force-dynamic';

export async function GET() {
  const beats = await repos.outlets.listBeats();
  return NextResponse.json({beats});
}
