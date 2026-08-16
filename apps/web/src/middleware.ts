import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from './lib/env';

// Routes accessibles sans authentification.
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
  '/explorer',
  '/residences',
];
const PUBLIC_PREFIXES = ['/residences/'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pages 100% publiques (explorer, annonces, reset/frgt) : pas d'appel
  // auth réseau — on renvoie directement. Seules login/register/verify-otp
  // doivent encore vérifier pour rediriger un utilisateur connecté.
  if (isPublic(pathname) && !['/login', '/register', '/verify-otp'].includes(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Utilisateur authentifié qui visite les pages auth -> redirigé vers l'app.
  if (user && ['/login', '/register', '/verify-otp'].includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/explorer';
    return NextResponse.redirect(url);
  }

  // Page protégée sans session -> redirection vers login avec retour.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Garde admin côté serveur : seuls les profils avec role=admin accèdent à /admin.
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/explorer';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Exclut les assets statiques, images et fichiers Next internes.
     * Toutes les autres routes passent par le middleware.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|css|woff2?|txt|xml)$).*)',
  ],
};
