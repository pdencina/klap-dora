// Decide la RUTA DE APROBACIÓN de un cambio.
//
//  - 'CAB'     → cambio crítico: se presenta en el comité (martes/miércoles/jueves).
//  - 'DIGITAL' → cambio normal: lo aprueban las áreas en el portal, SIN reunión.
//
// Objetivo: que la CAB presencial se reserve SOLO para lo realmente crítico.
//
// La regla vive acá, en un solo lugar, para que todas las vistas (Agenda CAB,
// detalle, aprobaciones) la usen igual. Ajusta los criterios según la política
// de KLAP si hace falta.

export type CabRoute = 'CAB' | 'DIGITAL';
export type RouteEval = { route: CabRoute; reasons: string[] };

function detailOf(change: any) {
  const d = change?.rdc_details;
  if (Array.isArray(d)) return d[0] || {};
  return d || {};
}

export function evaluateCabRoute(change: any): RouteEval {
  const detail = detailOf(change);
  const fd = detail.form_data || change?.form_data || {};

  const category = String(change?.category || fd.category || '').trim();
  const impact = String(detail.impact || fd.impact || '').trim();
  const urgency = String(fd.urgency || '').trim();
  const business: string[] = Array.isArray(fd.businessImpacted) ? fd.businessImpacted : [];

  const reasons: string[] = [];

  // === Criterios para ir a CAB (críticos) — ajustables ===
  if (/cr[ií]tico/i.test(impact)) reasons.push('Impacto crítico');
  if (/emergencia/i.test(urgency)) reasons.push('Urgencia de emergencia');
  if (/ecab/i.test(category)) reasons.push('Categoría ECAB');
  if (business.some((b) => /pci/i.test(b))) reasons.push('Afecta entorno PCI');

  return { route: reasons.length ? 'CAB' : 'DIGITAL', reasons };
}

export function routeLabel(route: CabRoute) {
  return route === 'CAB' ? 'Requiere CAB' : 'Aprobación digital';
}
