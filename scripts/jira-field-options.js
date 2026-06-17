/**
 * Script para obtener las opciones válidas de los campos SELECT de Jira PAP.
 * 
 * Esto permite homologar los valores del formulario RDC con los que acepta Jira.
 * 
 * USO:
 *   node scripts/jira-field-options.js
 * 
 * Requiere en .env:
 *   JIRA_BASE=https://multicaja-cloud.atlassian.net
 *   JIRA_EMAIL=tu-email@klap.cl
 *   JIRA_TOKEN=tu-api-token
 * 
 * SALIDA:
 *   Muestra las opciones de cada campo select y genera un archivo
 *   lib/jira-field-values.ts con el mapeo RDC → Jira listo para usar.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const base = (process.env.JIRA_BASE || process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
const email = process.env.JIRA_EMAIL || process.env.JIRA_USER || '';
const token = process.env.JIRA_TOKEN || process.env.JIRA_API_TOKEN || '';

if (!base || !email || !token) {
  console.error('❌ Configura JIRA_BASE, JIRA_EMAIL y JIRA_TOKEN en tu .env');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

// Campos SELECT que queremos inspeccionar
const SELECT_FIELDS = [
  { id: 'customfield_12332', name: 'Sistema / Producto' },
  { id: 'customfield_12321', name: 'Categoría de Cambio' },
  { id: 'customfield_12330', name: 'Célula' },
  { id: 'customfield_12331', name: 'Tipo de Cambio' },
  { id: 'customfield_12333', name: 'Prioridad' },
  { id: 'customfield_10059', name: 'Grado Severidad' },
  { id: 'customfield_12320', name: 'Resultado Deploy' },
];

// Proyecto y tipo de issue
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'PAP';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getFieldOptions(fieldId) {
  // Método 1: Contexto del issue type en el proyecto
  try {
    const url = `${base}/rest/api/3/field/${fieldId}/context`;
    const data = await fetchJson(url);
    if (data.values && data.values.length > 0) {
      const contextId = data.values[0].id;
      const optUrl = `${base}/rest/api/3/field/${fieldId}/context/${contextId}/option`;
      const optData = await fetchJson(optUrl);
      if (optData.values && optData.values.length > 0) {
        return optData.values.map((v) => ({ id: v.id, value: v.value, disabled: v.disabled || false }));
      }
    }
  } catch (e) {
    // Fallback a método 2
  }

  // Método 2: Obtener opciones vía createmeta
  try {
    const url = `${base}/rest/api/3/issue/createmeta/${PROJECT_KEY}/issuetypes`;
    const data = await fetchJson(url);
    const issueTypes = data.issueTypes || data.values || [];
    const tarea = issueTypes.find((it) => it.name === 'Tarea' || it.name === 'Task') || issueTypes[0];
    if (tarea) {
      const fieldsUrl = `${base}/rest/api/3/issue/createmeta/${PROJECT_KEY}/issuetypes/${tarea.id}`;
      const fieldsData = await fetchJson(fieldsUrl);
      const fieldMeta = (fieldsData.fields || fieldsData.values || []).find((f) => f.fieldId === fieldId || f.key === fieldId);
      if (fieldMeta && fieldMeta.allowedValues) {
        return fieldMeta.allowedValues.map((v) => ({ id: v.id, value: v.value, disabled: false }));
      }
    }
  } catch (e) {
    // Fallback a método 3
  }

  // Método 3: Leer directamente el autocomplete de opciones
  try {
    const url = `${base}/rest/api/3/customFieldOption/${fieldId}/context`;
    const data = await fetchJson(url);
    return (data.values || []).map((v) => ({ id: v.id, value: v.value, disabled: false }));
  } catch (e) {
    // Último intento
  }

  // Método 4: Buscar en JQL issues que tengan el campo con valor
  try {
    const jql = `project = ${PROJECT_KEY} AND "${fieldId}" is not EMPTY ORDER BY created DESC`;
    const url = `${base}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=${fieldId}`;
    const data = await fetchJson(url);
    const uniqueValues = new Map();
    for (const issue of (data.issues || [])) {
      const val = issue.fields?.[fieldId];
      if (val && val.value && !uniqueValues.has(val.value)) {
        uniqueValues.set(val.value, { id: val.id, value: val.value, disabled: false });
      }
    }
    if (uniqueValues.size > 0) return Array.from(uniqueValues.values());
  } catch (e) {
    // Sin resultados
  }

  return null;
}

async function main() {
  console.log('🔍 Obteniendo opciones de campos SELECT del proyecto PAP...\n');
  console.log(`   Base: ${base}`);
  console.log(`   Proyecto: ${PROJECT_KEY}\n`);
  console.log('='.repeat(80));

  const allOptions = {};

  for (const field of SELECT_FIELDS) {
    console.log(`\n📋 ${field.name} (${field.id})`);
    console.log('-'.repeat(60));

    const options = await getFieldOptions(field.id);

    if (!options || options.length === 0) {
      console.log('   ⚠️  No se pudieron obtener opciones');
      allOptions[field.id] = { name: field.name, options: [] };
      continue;
    }

    allOptions[field.id] = { name: field.name, options };
    
    for (const opt of options) {
      const status = opt.disabled ? ' [DESHABILITADO]' : '';
      console.log(`   • "${opt.value}" (id: ${opt.id})${status}`);
    }
    console.log(`   Total: ${options.length} opciones`);
  }

  // Generar archivo de mapeo
  console.log('\n' + '='.repeat(80));
  console.log('\n📝 Generando archivo de mapeo lib/jira-field-values.ts...\n');

  generateMappingFile(allOptions);
}

function generateMappingFile(allOptions) {
  const sistemaOpts = allOptions['customfield_12332']?.options || [];
  const categoriaOpts = allOptions['customfield_12321']?.options || [];
  const celulaOpts = allOptions['customfield_12330']?.options || [];
  const tipoOpts = allOptions['customfield_12331']?.options || [];
  const prioridadOpts = allOptions['customfield_12333']?.options || [];
  const severidadOpts = allOptions['customfield_10059']?.options || [];

  const lines = [
    '/**',
    ' * Mapeo de valores del formulario RDC → valores válidos en Jira.',
    ' * Generado automáticamente por scripts/jira-field-options.js',
    ` * Fecha: ${new Date().toISOString().slice(0, 10)}`,
    ' *',
    ' * Si un valor del RDC no está en este mapeo, se envía tal cual a Jira.',
    ' * Si Jira lo rechaza, el fallback sin custom fields garantiza la creación.',
    ' */',
    '',
    '/**',
    ' * Opciones válidas en Jira para "Sistema / Producto" (customfield_12332)',
    ' */',
    `export const JIRA_SISTEMA_OPTIONS: string[] = ${JSON.stringify(sistemaOpts.map(o => o.value), null, 2)};`,
    '',
    '/**',
    ' * Opciones válidas en Jira para "Categoría de Cambio" (customfield_12321)',
    ' */',
    `export const JIRA_CATEGORIA_OPTIONS: string[] = ${JSON.stringify(categoriaOpts.map(o => o.value), null, 2)};`,
    '',
    '/**',
    ' * Opciones válidas en Jira para "Célula" (customfield_12330)',
    ' */',
    `export const JIRA_CELULA_OPTIONS: string[] = ${JSON.stringify(celulaOpts.map(o => o.value), null, 2)};`,
    '',
    '/**',
    ' * Opciones válidas en Jira para "Tipo de Cambio" (customfield_12331)',
    ' */',
    `export const JIRA_TIPO_CAMBIO_OPTIONS: string[] = ${JSON.stringify(tipoOpts.map(o => o.value), null, 2)};`,
    '',
    '/**',
    ' * Opciones válidas en Jira para "Prioridad" (customfield_12333)',
    ' */',
    `export const JIRA_PRIORIDAD_OPTIONS: string[] = ${JSON.stringify(prioridadOpts.map(o => o.value), null, 2)};`,
    '',
    '/**',
    ' * Opciones válidas en Jira para "Grado Severidad" (customfield_10059)',
    ' */',
    `export const JIRA_SEVERIDAD_OPTIONS: string[] = ${JSON.stringify(severidadOpts.map(o => o.value), null, 2)};`,
    '',
    '/**',
    ' * Busca la mejor coincidencia de un valor RDC en las opciones de Jira.',
    ' * Usa coincidencia exacta primero, luego case-insensitive, luego parcial.',
    ' */',
    'export function matchJiraOption(rdcValue: string, jiraOptions: string[]): string | null {',
    '  if (!rdcValue || !jiraOptions.length) return null;',
    '  const trimmed = rdcValue.trim();',
    '',
    '  // Coincidencia exacta',
    '  const exact = jiraOptions.find((o) => o === trimmed);',
    '  if (exact) return exact;',
    '',
    '  // Case-insensitive',
    '  const lower = trimmed.toLowerCase();',
    '  const ci = jiraOptions.find((o) => o.toLowerCase() === lower);',
    '  if (ci) return ci;',
    '',
    '  // Sin tildes',
    '  const normalize = (s: string) => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();',
    '  const norm = normalize(trimmed);',
    '  const noAccent = jiraOptions.find((o) => normalize(o) === norm);',
    '  if (noAccent) return noAccent;',
    '',
    '  // Contiene (parcial)',
    '  const partial = jiraOptions.find((o) => normalize(o).includes(norm) || norm.includes(normalize(o)));',
    '  if (partial) return partial;',
    '',
    '  return null;',
    '}',
    '',
    '/**',
    ' * Mapeo manual para valores que difieren entre RDC y Jira.',
    ' * Clave: valor en el formulario RDC → Valor: valor exacto en Jira.',
    ' * Agregar aquí excepciones que no se resuelvan con matchJiraOption.',
    ' */',
    'export const MANUAL_MAPPINGS: Record<string, Record<string, string>> = {',
    '  sistema: {',
    '    // Ejemplo: "POS Tradicional Ingenico" en RDC → "POS Ingenico" en Jira',
    '    // Completar después de ejecutar el script y comparar',
    '  },',
    '  celula: {',
    '    // Ejemplo: "Desarrollo POS" en RDC → "POS" en Jira',
    '  },',
    '  categoria: {',
    "    'Mantención': 'Mantencion',",
    '  },',
    '  tipoCambio: {',
    "    'Sistema Operativo / Utilidades': 'Sistema Operativo',",
    '  },',
    '};',
    '',
    '/**',
    ' * Resuelve el valor final a enviar a Jira para un campo select.',
    ' * 1. Busca en mapeo manual',
    ' * 2. Busca coincidencia en opciones de Jira',
    ' * 3. Devuelve null si no hay match (campo no se enviará)',
    ' */',
    'export function resolveJiraValue(fieldKey: string, rdcValue: string, jiraOptions: string[]): string | null {',
    '  if (!rdcValue) return null;',
    '',
    '  // 1. Mapeo manual',
    '  const manual = MANUAL_MAPPINGS[fieldKey]?.[rdcValue];',
    '  if (manual) return manual;',
    '',
    '  // 2. Match automático',
    '  return matchJiraOption(rdcValue, jiraOptions);',
    '}',
    '',
  ];

  const outputPath = path.join(__dirname, '..', 'lib', 'jira-field-values.ts');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log(`✅ Archivo generado: ${outputPath}`);
  console.log('\nPróximos pasos:');
  console.log('1. Revisa las opciones de Jira vs las del formulario RDC');
  console.log('2. Completa MANUAL_MAPPINGS si hay diferencias de nombre');
  console.log('3. El sistema usará matchJiraOption para resolver coincidencias automáticamente');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
