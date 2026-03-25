import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { env } from '@/lib/env';

export default async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: env.auth.secret });
  const isAuthenticated = Boolean(token?.id);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard') && !isAuthenticated) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  if (pathname.startsWith('/auth') && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard/overview', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*']
};
