import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return req.cookies.get(name)?.value; },
        set(name, value, options) { res.cookies.set({ name, value, ...options }); },
        remove(name, options) { res.cookies.set({ name, value: '', ...options }); },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;

  if (path.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url));
    if (session.user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

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