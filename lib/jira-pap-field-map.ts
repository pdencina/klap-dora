export const PAP_FIELDS = {
  // === Campos tipo SELECT ===
  sistemaProducto: process.env.CF_SISTEMA || 'customfield_12332',
  categoriaCambio: process.env.CF_TIPO || 'customfield_12321',
  celula: process.env.CF_CELULA || 'customfield_12330',
  tipoCambio: process.env.CF_TIPO_CAMBIO || 'customfield_12331',
  prioridad: process.env.CF_PRIORIDAD || 'customfield_12333',
  gradoSeveridad: process.env.CF_GRADO_SEVERIDAD || 'customfield_10059',
  resultadoDeploy: process.env.CF_RESULTADO || 'customfield_12320',

  // === Campos tipo RADIOBUTTONS ===
  requirioRollback: process.env.CF_ROLLBACK || 'customfield_12335',

  // === Campos tipo DATE ===
  fechaDeploy: process.env.CF_FDEPLOY || 'customfield_12319',
  fechaInicio: process.env.CF_FECHA_INICIO || 'customfield_10177',
  fechaCab: process.env.CF_FECHA_CAB || 'customfield_10172',

  // === Campos tipo URL ===
  calendarioCambios: process.env.CF_CALENDARIO_CAMBIOS || 'customfield_10248',

  // === Campos tipo TEXTAREA (ADF) ===
  consecuencias: process.env.CF_CONSECUENCIAS || 'customfield_10182',
  planDespliegue: process.env.CF_PLAN_DESPLIEGUE || 'customfield_10199',
  planValidacion: process.env.CF_PLAN_VALIDACION || 'customfield_10198',
  planRemediacion: process.env.CF_PLAN_REMEDIACION || 'customfield_10197',
  solucionRequerimiento: process.env.CF_SOLUCION_REQUERIMIENTO || 'customfield_10300',
  razonCambio: process.env.CF_RAZON_CAMBIO || 'customfield_10179',
  adjuntarRdcDeployment: process.env.CF_ADJUNTAR_RDC_DEPLOYMENT || 'customfield_10318',
  listadoComponentes: process.env.CF_LISTADO_COMPONENTES || 'customfield_10189',
};

export const CATEGORY_VALUE_MAP: Record<string, string> = {
  'Mantención': 'Mantencion',
  Mantencion: 'Mantencion',
  Proyecto: 'Proyecto',
  Incidente: 'Incidente',
  Hotfix: 'Hotfix',
  ECAB: 'ECAB',
  Recurrente: 'Recurrente',
};

export const SEVERITY_VALUE_MAP: Record<string, string> = {
  Critico: 'Crítico',
  Crítico: 'Crítico',
  Alto: 'Alto',
  Medio: 'Medio',
  Bajo: 'Bajo',
  Urgente: 'Urgente',
  Alta: 'Alta',
  Media: 'Media',
  Baja: 'Baja',
};

export function jiraSelect(value?: string | null) {
  const clean = String(value || '').trim();
  return clean ? { value: clean } : undefined;
}

export function adfText(text?: string | null) {
  const clean = String(text || '').trim() || 'No informado';
  return {
    type: 'doc',
    version: 1,
    content: clean.split('\n').map((line) => ({
      type: 'paragraph',
      content: line.trim() ? [{ type: 'text', text: line }] : [],
    })),
  };
}

export function textFromHtmlish(value?: string | null) {
  return String(value || '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function normalizeCategory(value?: string | null) {
  const raw = String(value || '').trim();
  return CATEGORY_VALUE_MAP[raw] || raw;
}

export function normalizeSeverity(value?: string | null) {
  const raw = String(value || '').trim();
  return SEVERITY_VALUE_MAP[raw] || raw;
}
