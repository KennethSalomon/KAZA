import { createBrowserClient } from '@supabase/ssr';
import { env } from './env';

// note : variable exposée au navigateur — clé "anon", sans privilège.
// La clé service_role vit exclusivement dans les Edge Functions.
const url = env.supabaseUrl;
const anonKey = env.supabaseAnonKey;

// Le JWT (access_token) n'est JAMAIS persisté dans localStorage :
// un XSS malveillant ne peut pas l'exfiltrer durablement. Le token reste
// synchronisé via le cookie SSR (middleware) qui restaure la session au
// chargement de la page — même comportement utilisateur, exposition réduite.
const memory = new Map<string, string>();
const inMemoryStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

// createBrowserClient (SSR) : la session est répliquée dans les cookies
// (document.cookie) pour que le middleware et les Server Components
// (createServerClient) voient la même session que le navigateur.
export const supabase = createBrowserClient(url, anonKey, {
  auth: {
    persistSession: true,
    userStorage: inMemoryStorage,
  },
});
