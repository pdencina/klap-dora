/**
 * Mapeo de valores del formulario RDC → valores válidos en Jira.
 * Generado tras sincronizar opciones con scripts/jira-sync-options.js
 * Fecha: 2026-06-17
 *
 * Las opciones ahora coinciden 1:1 con el formulario RDC.
 */

/**
 * Opciones válidas en Jira para "Sistema / Producto" (customfield_12332)
 */
export const JIRA_SISTEMA_OPTIONS: string[] = [
  'POS',
  'Anticipo',
  'Abono Ya',
  'Bridge',
  'H2H',
  'BO',
  'Contabilidad',
  'POS Tradicional Ingenico',
  'POS Tradicional Verifone',
  'SmartPago',
  'POS Integrado Android',
  'App Klap (TTP)',
  'API Tarjetas (E-Commerce)',
  'API H2H',
  'API Transit',
  'Checkout / Link de Pago',
  'Boleta Electrónica',
  'SmartVista',
  'Web Privada (Portal Comercios)',
  'Web Pública (klap.cl)',
  'Backoffice',
  'Multiservicios (PDC/Recargas/JDA)',
  'Alimentación (Pluxee/Edenred/Amipass)',
  'Clearing (Visa/Mastercard/Amex)',
  'Anticipo Klap / Abono Ya',
  'R2 Crédito Emprende',
  'Cuota Comercio',
  'Data Analytics (Redshift/S3)',
  'Redes',
  'Infraestructura / Ingeniería',
  'Afiliación y Contrato',
  'IMED',
];

/**
 * Opciones válidas en Jira para "Categoría de Cambio" (customfield_12321)
 */
export const JIRA_CATEGORIA_OPTIONS: string[] = [
  'Mantencion',
  'Proyecto',
  'Incidente',
  'Hotfix',
  'ECAB',
  'Recurrente',
];

/**
 * Opciones válidas en Jira para "Célula" (customfield_12330)
 */
export const JIRA_CELULA_OPTIONS: string[] = [
  'SVA',
  'SVBO',
  'SVXP',
  'CNLS',
  'H2H',
  'TRX',
  'ESV',
  'Adquirencia Transaccional',
  'Adquirencia Clearing',
  'Adquirencia H2H',
  'E-Commerce API',
  'E-Commerce Checkout',
  'Boleta Electrónica y Multiservicios',
  'SmartVista',
  'Desarrollo POS',
  'Canales Presenciales',
  'App Klap',
  'Alimentación',
  'APM',
  'Facturación y Servicios Financieros',
  'BO y Multiservicios Central',
  'Multiservicios',
  'Web Privada',
  'Web Pública',
  'Salud',
  'Retail',
  'Afiliación y Contrato',
  'Redes',
  'Ingeniería de Sistemas',
  'Clientes',
  'Integraciones',
  'Arquitectura',
  'Ciberdefensa',
];

/**
 * Opciones válidas en Jira para "Tipo de Cambio" (customfield_12331)
 */
export const JIRA_TIPO_CAMBIO_OPTIONS: string[] = [
  'Normal',
  'Recurrente',
  'Hotfix',
  'ECAB',
  'Urgente',
  'Software',
  'Infraestructura',
  'Redes',
  'Sistema Operativo / Utilidades',
  'Base de Datos',
  'Procedimiento',
  'Seguridad',
  'Datos',
];

/**
 * Opciones válidas en Jira para "Prioridad" (customfield_12333)
 */
export const JIRA_PRIORIDAD_OPTIONS: string[] = [
  'Baja',
  'Media',
  'Alta',
  'Crítica',
  'Urgente',
];

/**
 * Opciones válidas en Jira para "Grado Severidad" (customfield_10059)
 */
export const JIRA_SEVERIDAD_OPTIONS: string[] = [
  'Bajo',
  'Medio',
  'Alto',
  'Crítico',
];

/**
 * Busca la mejor coincidencia de un valor RDC en las opciones de Jira.
 */
export function matchJiraOption(rdcValue: string, jiraOptions: string[]): string | null {
  if (!rdcValue || !jiraOptions.length) return null;
  const trimmed = rdcValue.trim();

  // Coincidencia exacta
  const exact = jiraOptions.find((o) => o === trimmed);
  if (exact) return exact;

  // Case-insensitive
  const lower = trimmed.toLowerCase();
  const ci = jiraOptions.find((o) => o.toLowerCase() === lower);
  if (ci) return ci;

  // Sin tildes
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const norm = normalize(trimmed);
  const noAccent = jiraOptions.find((o) => normalize(o) === norm);
  if (noAccent) return noAccent;

  // Contiene (parcial)
  const partial = jiraOptions.find((o) => normalize(o).includes(norm) || norm.includes(normalize(o)));
  if (partial) return partial;

  return null;
}

/**
 * Mapeo manual para valores que difieren entre RDC y Jira.
 */
export const MANUAL_MAPPINGS: Record<string, Record<string, string>> = {
  sistema: {
    // Ahora coinciden 1:1, no necesita mapeo manual
  },
  celula: {
    // Ahora coinciden 1:1, no necesita mapeo manual
  },
  categoria: {
    'Mantención': 'Mantencion',
  },
  tipoCambio: {
    // Coinciden directamente
  },
  prioridad: {
    // Coinciden directamente
  },
  severidad: {
    'Media': 'Medio',
    'Alta': 'Alto',
    'Baja': 'Bajo',
    'Urgente': 'Crítico',
    'Crítico': 'Crítico',
  },
};

/**
 * Resuelve el valor final a enviar a Jira para un campo select.
 */
export function resolveJiraValue(fieldKey: string, rdcValue: string, jiraOptions: string[]): string | null {
  if (!rdcValue) return null;

  // 1. Mapeo manual tiene prioridad
  const manual = MANUAL_MAPPINGS[fieldKey]?.[rdcValue];
  if (manual) return manual;

  // 2. Si no hay opciones cargadas, enviar tal cual
  if (!jiraOptions.length) return rdcValue;

  // 3. Match automático inteligente
  return matchJiraOption(rdcValue, jiraOptions);
}
