import { createBrowserClient } from '@supabase/ssr';

// note : variable exposée au navigateur — clé "anon", sans privilège.
// La clé service_role vit exclusivement dans les Edge Functions.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

// createBrowserClient (SSR) : la session est répliquée dans les cookies
// (document.cookie) pour que le middleware et les Server Components
// (createServerClient) voient la même session que le navigateur.
export const supabase = createBrowserClient(url, anonKey);