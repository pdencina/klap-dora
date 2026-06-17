/**
 * Mapeo de valores del formulario RDC → valores válidos en Jira.
 *
 * Cuando se ejecute `node scripts/jira-field-options.js` con credenciales,
 * este archivo se regenerará con las opciones reales de Jira.
 * Mientras tanto, estos son los valores conocidos del XML del issue PAP-5913.
 *
 * Si un valor del RDC no está en este mapeo, se envía tal cual a Jira.
 * Si Jira lo rechaza, el fallback sin custom fields garantiza la creación del issue.
 */

/**
 * Opciones válidas en Jira para "Sistema / Producto" (customfield_12332)
 * Extraídas del XML: "Anticipo" aparece como ejemplo. Completar con script.
 */
export const JIRA_SISTEMA_OPTIONS: string[] = [
  'Anticipo',
  // Ejecuta scripts/jira-field-options.js para obtener la lista completa
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
 * Del XML: "SVBO" aparece. También existe customfield_10139 con "Adquirencia H2H".
 */
export const JIRA_CELULA_OPTIONS: string[] = [
  'SVBO',
  'Adquirencia H2H',
  // Ejecuta scripts/jira-field-options.js para obtener la lista completa
];

/**
 * Opciones válidas en Jira para "Tipo de Cambio" (customfield_12331)
 * Del XML: "Recurrente" aparece como ejemplo.
 */
export const JIRA_TIPO_CAMBIO_OPTIONS: string[] = [
  'Recurrente',
  'Software',
  'Infraestructura',
  'Redes',
  'Base de Datos',
  'Seguridad',
  // Ejecuta scripts/jira-field-options.js para obtener la lista completa
];

/**
 * Opciones válidas en Jira para "Prioridad" (customfield_12333)
 * Del XML: "Media" aparece.
 */
export const JIRA_PRIORIDAD_OPTIONS: string[] = [
  'Baja',
  'Media',
  'Alta',
  'Urgente',
];

/**
 * Opciones válidas en Jira para "Grado Severidad" (customfield_10059)
 * Del XML: "Medio" aparece.
 */
export const JIRA_SEVERIDAD_OPTIONS: string[] = [
  'Bajo',
  'Medio',
  'Alto',
  'Crítico',
];

/**
 * Busca la mejor coincidencia de un valor RDC en las opciones de Jira.
 * Usa coincidencia exacta primero, luego case-insensitive, luego sin tildes, luego parcial.
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
 * Clave: valor en el formulario RDC → Valor: valor exacto en Jira.
 * Se completa después de ejecutar scripts/jira-field-options.js y comparar.
 */
export const MANUAL_MAPPINGS: Record<string, Record<string, string>> = {
  sistema: {
    // Ej: 'POS Tradicional Ingenico' → 'POS Ingenico' (si en Jira se llama así)
    // 'Anticipo Klap / Abono Ya' → 'Anticipo' (el XML muestra "Anticipo")
    'Anticipo Klap / Abono Ya': 'Anticipo',
  },
  celula: {
    // Completar tras ejecutar el script
  },
  categoria: {
    'Mantención': 'Mantencion',
  },
  tipoCambio: {
    'Sistema Operativo / Utilidades': 'Sistema Operativo',
  },
  prioridad: {
    // Los valores parecen coincidir directamente
  },
  severidad: {
    'Crítico': 'Crítico',
  },
};

/**
 * Resuelve el valor final a enviar a Jira para un campo select.
 * 1. Busca en mapeo manual
 * 2. Busca coincidencia en opciones de Jira
 * 3. Devuelve el valor tal cual si hay opciones vacías (se prueba suerte)
 * 4. Devuelve null si definitivamente no hay match
 */
export function resolveJiraValue(fieldKey: string, rdcValue: string, jiraOptions: string[]): string | null {
  if (!rdcValue) return null;

  // 1. Mapeo manual tiene prioridad
  const manual = MANUAL_MAPPINGS[fieldKey]?.[rdcValue];
  if (manual) return manual;

  // 2. Si no hay opciones cargadas, enviar tal cual (mejor suerte con Jira)
  if (!jiraOptions.length) return rdcValue;

  // 3. Match automático inteligente
  return matchJiraOption(rdcValue, jiraOptions);
}
