/**
 * Funciones de formateo compartidas.
 * Antes estaban duplicadas en 6+ páginas.
 */

/**
 * Formatea una fecha ISO a formato local chileno (corto).
 */
export function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-CL', { dateStyle: 'short' });
  } catch {
    return String(value);
  }
}

/**
 * Formatea una fecha ISO con hora incluida.
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(value);
  }
}

/**
 * Convierte un status de RDC a un label legible.
 */
export function humanRdcStatus(status?: string | null): string {
  if (!status) return 'Sin estado';

  const labels: Record<string, string> = {
    PENDIENTE_APROBACIONES: 'Pendiente aprobación',
    APROBADO_PARA_EJECUCION: 'Aprobado para ejecución',
    PAP_CREADO: 'Plan PAP creado',
    EN_IMPLEMENTACION: 'En implementación',
    IMPLEMENTADO_EXITOSO: 'Implementado exitoso',
    CERRADO: 'Cerrado',
    OBSERVADO: 'Observado',
    RECHAZADO: 'Rechazado',
  };

  return labels[status] || status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Cuenta aprobaciones completadas de un cambio.
 */
export function approvedCount(change?: { approval_requests?: Array<{ status: string }> } | null): number {
  return (change?.approval_requests || []).filter((a) => a.status === 'APROBADO').length;
}

/**
 * Total de aprobaciones de un cambio.
 */
export function totalApprovals(change?: { approval_requests?: Array<unknown> } | null): number {
  return change?.approval_requests?.length || 0;
}
