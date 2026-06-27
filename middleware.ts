import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {decrypt} from '@/lib/auth-utils';

export async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const cookie = request.cookies.get('beat_admin_session');
    const session = cookie ? await decrypt(cookie.value) : null;
    if (!session) return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (pathname === '/admin/login') {
    const cookie = request.cookies.get('beat_admin_session');
    const session = cookie ? await decrypt(cookie.value) : null;
    if (session) return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/login')) {
    const cookie = request.cookies.get('beat_admin_session');
    const session = cookie ? await decrypt(cookie.value) : null;
    if (!session) return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
