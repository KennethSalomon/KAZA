import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from './lib/env';
import { logger } from './lib/logger';

// Routes accessibles sans authentification.
const PUBLIC_PATHS = [
  '/',
  '/auth/callback',
  '/login',
  '/register',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
  '/explorer',
  '/residences',
  '/confidentialite',
  '/mentions-legales',
];
const PUBLIC_PREFIXES = ['/residences/', '/confidentialite', '/mentions-legales'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function generateRequestId(): string {
  return 'req_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = generateRequestId();

  const response = NextResponse.next({ request });
  response.headers.set('x-request-id', requestId);

  if (isPublic(pathname) && !['/login', '/register', '/verify-otp'].includes(pathname)) {
    logger.debug('public_access', { requestId, message: `path: ${pathname}` });
    return response;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? undefined;

  if (user && ['/login', '/register', '/verify-otp'].includes(pathname)) {
    logger.info('authenticated_auth_page_redirect', { requestId, userId, metadata: { redirect_to: '/explorer' } });
    const url = request.nextUrl.clone();
    url.pathname = '/explorer';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-request-id', requestId);
    return redirectResponse;
  }

  if (!user && !isPublic(pathname)) {
    logger.warn('unauthenticated_protected_access', { requestId, metadata: { redirect_to: '/login', path: pathname } });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-request-id', requestId);
    return redirectResponse;
  }

  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') {
      logger.warn('admin_access_denied', { requestId, userId, metadata: { profile_role: profile?.role, path: pathname } });
      const url = request.nextUrl.clone();
      url.pathname = '/forbidden';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }
    logger.info('admin_access_granted', { requestId, userId });
  }

  supabaseResponse.headers.set('x-request-id', requestId);
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Exclut les routes API (les route handlers gèrent leur propre auth),
     * les assets statiques, images et fichiers Next internes. Toutes les
     * autres routes passent par le middleware.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|css|woff2?|txt|xml)$).*)',
  ],
};