import {NextResponse} from 'next/server';
import {encrypt} from '@/lib/auth-utils';
import bcrypt from 'bcryptjs';
import {z} from 'zod';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({error: 'Invalid data'}, {status: 400});

    const {username, password} = parsed.data;
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim() || 'admin';
    const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH?.trim()?.replace(/\\\$/g, '$');

    if (username !== ADMIN_USERNAME) return NextResponse.json({error: 'Invalid credentials'}, {status: 401});
    if (!ADMIN_PASSWORD_HASH) return NextResponse.json({error: 'Server misconfiguration'}, {status: 500});

    const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!valid) return NextResponse.json({error: 'Invalid credentials'}, {status: 401});

    const token = await encrypt({username, role: 'admin'});
    const res = NextResponse.json({success: true});
    res.cookies.set('beat_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({error: 'Internal server error'}, {status: 500});
  }
}
