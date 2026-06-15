/**
 * Normalización de roles a nivel de usuario.
 * Extraído como módulo independiente para uso tanto en middleware (Edge)
 * como en lib/auth.ts (Node runtime).
 */

export type Role = 'client' | 'approver' | 'deployment' | 'rm' | 'super_admin' | 'read_only';

/**
 * Determina el rol de un usuario basándose en su metadata de Supabase Auth.
 */
export function roleOf(user: any): Role {
  const raw = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase();

  if (raw === 'super_admin' || raw === 'super-admin' || raw === 'admin' || raw === 'superadmin') return 'super_admin';
  if (raw === 'rm' || raw === 'release_manager' || raw === 'release-manager') return 'rm';
  if (raw === 'deployment' || raw === 'deploy' || raw === 'implementador') return 'deployment';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';
  if (raw === 'read_only' || raw === 'readonly' || raw === 'solo_lectura') return 'read_only';

  return 'client';
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    super_admin: 'Super Admin',
    rm: 'Release Manager',
    deployment: 'Deployment',
    approver: 'Aprobador',
    read_only: 'Solo Lectura',
    client: 'Cliente Interno',
  };
  return labels[role] || 'Cliente Interno';
}
