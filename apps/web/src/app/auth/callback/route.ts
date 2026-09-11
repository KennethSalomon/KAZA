import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

// Route de callback utilisée par les liens de confirmation email et de
// réinitialisation de mot de passe. Supabase redirige vers cette route avec
// un ?code=... que l'on échange contre une session, puis on renvoie
// l'utilisateur vers l'app (ou la page de reset si c'était un reset).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/explorer';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Appelé depuis un Server Component : on ignore (middleware
              // propage les cookies de toute façon).
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
