/**
 * Lógica centralizada para calcular el estado de un RDC
 * basado en el estado de sus approval_requests.
 *
 * ANTES: Esta lógica estaba duplicada en:
 * - /api/approvals/action/route.ts
 * - /api/approvals/token-action/route.ts
 */

export type ApprovalStatus = 'PENDIENTE' | 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';

export type RdcStatus =
  | 'PENDIENTE_APROBACIONES'
  | 'APROBADO_PARA_EJECUCION'
  | 'OBSERVADO'
  | 'RECHAZADO';

export interface ApprovalRecord {
  id: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Calcula el estado que debe tener el RDC basándose en todas sus aprobaciones.
 *
 * Reglas:
 * - Si alguna es RECHAZADO → RDC queda RECHAZADO
 * - Si alguna es OBSERVADO (y ninguna rechazada) → RDC queda OBSERVADO
 * - Si TODAS son APROBADO → RDC queda APROBADO_PARA_EJECUCION
 * - En cualquier otro caso → PENDIENTE_APROBACIONES
 */
export function computeRdcStatus(approvals: ApprovalRecord[]): RdcStatus {
  if (!approvals || approvals.length === 0) {
    return 'PENDIENTE_APROBACIONES';
  }

  if (approvals.some((item) => item.status === 'RECHAZADO')) {
    return 'RECHAZADO';
  }

  if (approvals.some((item) => item.status === 'OBSERVADO')) {
    return 'OBSERVADO';
  }

  if (approvals.every((item) => item.status === 'APROBADO')) {
    return 'APROBADO_PARA_EJECUCION';
  }

  return 'PENDIENTE_APROBACIONES';
}
