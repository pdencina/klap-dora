import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente con la sesión del usuario (anon key + cookies). Para Server Components
// y Route Handlers. NO confundir con lib/supabase-admin.ts (service role).
export async function createSupabaseServer() {
  const cookieStore = await cookies(); // await funciona en Next 14 y 15

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Llamado desde un Server Component (cookies de solo lectura):
            // la sesión se refresca en el middleware, así que se puede ignorar.
          }
        },
      },
    },
  );
}
