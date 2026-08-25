import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from './lib/env';

// Routes accessibles sans authentification.
const PUBLIC_PATHS = [
  '/',
  '/welcome',
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
  // Simple UUID v4-like ID for request correlation
  return 'req_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

function logRequest(requestId: string, request: NextRequest, userId: string | null, action: string, meta?: Record<string, unknown>) {
  const logEntry = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    method: request.method,
    path: request.nextUrl.pathname,
    user_id: userId,
    action,
    user_agent: request.headers.get('user-agent')?.slice(0, 200),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip'),
    ...meta,
  };
  // In production, send to structured logger (Sentry, Datadog, etc.)
  // For now, use console with JSON for log aggregation
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(logEntry));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = generateRequestId();

  // Add request ID to response headers for client-side correlation
  const response = NextResponse.next({ request });
  response.headers.set('x-request-id', requestId);

  // Pages 100% publiques (explorer, annonces, reset/frgt) : pas d'appel
  // auth réseau — on renvoie directement. Seules login/register/verify-otp
  // doivent encore vérifier pour rediriger un utilisateur connecté.
  if (isPublic(pathname) && !['/login', '/register', '/verify-otp'].includes(pathname)) {
    logRequest(requestId, request, null, 'public_access', { path: pathname });
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
        setAll(cookiesToSet) {
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

  const userId = user?.id ?? null;

  // Utilisateur authentifié qui visite les pages auth -> redirigé vers l'app.
  if (user && ['/login', '/register', '/verify-otp'].includes(pathname)) {
    logRequest(requestId, request, userId, 'authenticated_auth_page_redirect', { redirect_to: '/explorer' });
    const url = request.nextUrl.clone();
    url.pathname = '/explorer';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-request-id', requestId);
    return redirectResponse;
  }

  // Page protégée sans session -> redirection vers login avec retour.
  if (!user && !isPublic(pathname)) {
    logRequest(requestId, request, null, 'unauthenticated_protected_access', { redirect_to: '/login' });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-request-id', requestId);
    return redirectResponse;
  }

  // Garde admin côté serveur : seuls les profils avec role=admin accèdent à /admin.
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') {
      logRequest(requestId, request, userId, 'admin_access_denied', { profile_role: profile?.role });
      const url = request.nextUrl.clone();
      url.pathname = '/explorer';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }
    logRequest(requestId, request, userId, 'admin_access_granted');
  }

  // Propagate request ID to Supabase response cookies
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