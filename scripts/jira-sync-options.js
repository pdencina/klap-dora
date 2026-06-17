/**
 * Script para sincronizar las opciones de los campos SELECT de Jira
 * con los valores del formulario RDC.
 *
 * Agrega opciones faltantes a cada campo custom en Jira.
 *
 * USO:
 *   node scripts/jira-sync-options.js --base https://multicaja-cloud.atlassian.net --email tu@klap.cl --token XXXXX
 *
 * O con .env / .env.local configurado:
 *   node scripts/jira-sync-options.js
 *
 * FLAGS:
 *   --dry-run    Solo muestra lo que haría, sin crear opciones (default)
 *   --apply      Crea las opciones faltantes en Jira
 */

const fs = require('fs');
const path = require('path');

// === Cargar env ===
function loadEnvFile() {
  const envPaths = ['.env', '.env.local', '.env.production.local'];
  for (const envPath of envPaths) {
    const fullPath = path.join(__dirname, '..', envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
      console.log(`   📄 Leído: ${envPath}`);
      return;
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { apply: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) process.env.JIRA_BASE = args[++i];
    if (args[i] === '--email' && args[i + 1]) process.env.JIRA_EMAIL = args[++i];
    if (args[i] === '--token' && args[i + 1]) process.env.JIRA_TOKEN = args[++i];
    if (args[i] === '--apply') flags.apply = true;
  }
  return flags;
}

loadEnvFile();
const flags = parseArgs();

const base = (process.env.JIRA_BASE || process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
const email = process.env.JIRA_EMAIL || process.env.JIRA_USER || '';
const token = process.env.JIRA_TOKEN || process.env.JIRA_API_TOKEN || '';

if (!base || !email || !token) {
  console.error('❌ Configura JIRA_BASE, JIRA_EMAIL y JIRA_TOKEN');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

// === Definición de campos y opciones deseadas ===

const FIELDS_TO_SYNC = [
  {
    fieldId: 'customfield_12332',
    contextId: '13027',
    name: 'Sistema / Producto',
    desiredOptions: [
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
    ],
  },
  {
    fieldId: 'customfield_12321',
    contextId: '13015',
    name: 'Categoría de Cambio',
    desiredOptions: [
      'Mantencion',
      'Proyecto',
      'Incidente',
      'Hotfix',
      'ECAB',
      'Recurrente',
    ],
  },
  {
    fieldId: 'customfield_12330',
    contextId: '13025',
    name: 'Célula',
    desiredOptions: [
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
      'SVA',
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
    ],
  },
  {
    fieldId: 'customfield_12331',
    contextId: '13026',
    name: 'Tipo de Cambio',
    desiredOptions: [
      'Software',
      'Infraestructura',
      'Redes',
      'Sistema Operativo / Utilidades',
      'Base de Datos',
      'Procedimiento',
      'Seguridad',
      'Datos',
      'Recurrente',
    ],
  },
  {
    fieldId: 'customfield_12333',
    contextId: '13028',
    name: 'Prioridad',
    desiredOptions: [
      'Baja',
      'Media',
      'Alta',
      'Urgente',
    ],
  },
];

// === API helpers ===

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { ok: res.ok, status: res.status, data: json, text };
}

async function getExistingOptions(fieldId, contextId) {
  const url = `${base}/rest/api/3/field/${fieldId}/context/${contextId}/option?maxResults=200`;
  const { ok, data } = await fetchJson(url);
  if (!ok || !data?.values) return [];
  return data.values.map((v) => v.value);
}

async function createOptions(fieldId, contextId, newOptions) {
  const url = `${base}/rest/api/3/field/${fieldId}/context/${contextId}/option`;
  const payload = {
    options: newOptions.map((value) => ({ value, disabled: false })),
  };
  const { ok, status, data, text } = await fetchJson(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ok, status, data, text };
}

// === Main ===

async function main() {
  console.log('');
  console.log(flags.apply ? '🚀 MODO APPLY — Se crearán opciones en Jira' : '🔍 MODO DRY-RUN — Solo muestra lo que haría');
  console.log(`   Base: ${base}`);
  console.log('');
  console.log('='.repeat(80));

  let totalAdded = 0;

  for (const field of FIELDS_TO_SYNC) {
    console.log(`\n📋 ${field.name} (${field.fieldId}, context: ${field.contextId})`);
    console.log('-'.repeat(60));

    const existing = await getExistingOptions(field.fieldId, field.contextId);
    console.log(`   Opciones actuales en Jira: ${existing.length}`);
    if (existing.length) {
      existing.forEach((v) => console.log(`     ✓ "${v}"`));
    }

    // Determinar cuáles faltan
    const existingLower = new Set(existing.map((v) => v.toLowerCase()));
    const missing = field.desiredOptions.filter((v) => !existingLower.has(v.toLowerCase()));

    if (missing.length === 0) {
      console.log(`   ✅ Todas las opciones ya existen`);
      continue;
    }

    console.log(`\n   Opciones a AGREGAR (${missing.length}):`);
    missing.forEach((v) => console.log(`     + "${v}"`));

    if (flags.apply) {
      console.log(`\n   Creando ${missing.length} opciones...`);
      const result = await createOptions(field.fieldId, field.contextId, missing);
      if (result.ok) {
        console.log(`   ✅ ${missing.length} opciones creadas exitosamente`);
        totalAdded += missing.length;
      } else {
        console.log(`   ❌ Error ${result.status}: ${result.text?.slice(0, 300)}`);
      }
    } else {
      totalAdded += missing.length;
    }
  }

  console.log('\n' + '='.repeat(80));
  if (flags.apply) {
    console.log(`\n✅ Total opciones agregadas: ${totalAdded}`);
  } else {
    console.log(`\n📝 Total opciones que se agregarían: ${totalAdded}`);
    console.log('\n   Para aplicar los cambios, ejecuta:');
    console.log('   node scripts/jira-sync-options.js --apply');
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
