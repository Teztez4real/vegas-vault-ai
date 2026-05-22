import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;

  // Admin route
  if (path.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url));
    if (session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Dashboard requires login + active subscription
  if (path.startsWith('/dashboard')) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url));

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', session.user.id)
      .in('status', ['active', 'trialing'])
      .single();

    if (!sub) return NextResponse.redirect(new URL('/subscribe', req.url));
  }

  // Already logged in with subscription → skip login page
  if (path === '/login' || path === '/') {
    if (session) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .in('status', ['active', 'trialing'])
        .single();

      if (sub) return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/admin/:path*'],
};