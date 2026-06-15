/**
 * Utilidades compartidas del proyecto.
 * Funciones que antes estaban duplicadas en múltiples archivos.
 */

/**
 * Normaliza un email a minúsculas sin espacios.
 */
export function normalizeEmail(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

/**
 * Detecta si un error de Supabase indica que una tabla no existe.
 * Útil para manejar migraciones pendientes sin romper el flujo.
 */
export function isTableMissing(error: unknown): boolean {
  const message = String(
    (error as any)?.message || (error as any)?.details || ''
  ).toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('relation')
  );
}

/**
 * Genera un display name a partir de un email.
 * Ejemplo: "pablo.encina@klap.cl" → "Pablo Encina"
 */
export function displayNameFromEmail(email: string): string {
  return String(email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Limpia un string: trim y devuelve string vacío si es null/undefined.
 */
export function clean(value: unknown): string {
  return String(value || '').trim();
}
