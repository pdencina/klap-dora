/**
 * Script para descubrir los custom fields de Jira en el proyecto PAP.
 * 
 * USO:
 *   node scripts/jira-list-fields.js
 * 
 * Requiere las variables de entorno:
 *   JIRA_BASE=https://multicaja-cloud.atlassian.net
 *   JIRA_EMAIL=tu-email@klap.cl
 *   JIRA_TOKEN=tu-api-token
 * 
 * O puedes pasar un issue key para ver los campos con valores:
 *   node scripts/jira-list-fields.js PAP-5913
 */

require('dotenv').config();

const base = (process.env.JIRA_BASE || process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
const email = process.env.JIRA_EMAIL || process.env.JIRA_USER || '';
const token = process.env.JIRA_TOKEN || process.env.JIRA_API_TOKEN || '';

if (!base || !email || !token) {
  console.error('❌ Configura JIRA_BASE, JIRA_EMAIL y JIRA_TOKEN en tu .env');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
const issueKey = process.argv[2]; // Opcionalmente PAP-5913

async function listAllFields() {
  console.log('📋 Obteniendo todos los campos de Jira...\n');

  const res = await fetch(`${base}/rest/api/3/field`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });

  if (!res.ok) {
    console.error(`❌ Error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const fields = await res.json();
  
  // Filtrar solo custom fields
  const customFields = fields
    .filter((f) => f.custom)
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Total custom fields: ${customFields.length}\n`);
  console.log('='.repeat(90));
  console.log(`${'NOMBRE'.padEnd(40)} | ${'ID'.padEnd(22)} | TIPO`);
  console.log('='.repeat(90));

  // Buscar los que nos interesan
  const keywords = [
    'célula', 'celula', 'tipo', 'cambio', 'sistema', 'producto',
    'prioridad', 'ambiente', 'rollback', 'ventana', 'implementa',
    'resultado', 'deploy', 'responsable', 'severidad', 'categoria',
    'impacto', 'calendario', 'exitoso', 'primera',
  ];

  for (const f of customFields) {
    const nameL = f.name.toLowerCase();
    const isRelevant = keywords.some((k) => nameL.includes(k));
    const marker = isRelevant ? '⭐' : '  ';
    console.log(`${marker} ${f.name.padEnd(38)} | ${f.id.padEnd(22)} | ${f.schema?.type || f.schema?.custom || '-'}`);
  }

  console.log('\n⭐ = Campos probablemente relevantes para el RDC');
}

async function inspectIssue(key) {
  console.log(`🔍 Inspeccionando issue ${key}...\n`);

  const res = await fetch(`${base}/rest/api/3/issue/${key}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });

  if (!res.ok) {
    console.error(`❌ Error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const issue = await res.json();
  const fields = issue.fields;

  console.log(`Summary: ${fields.summary}`);
  console.log(`Status: ${fields.status?.name}`);
  console.log(`Issue Type: ${fields.issuetype?.name}`);
  console.log('\n--- Custom Fields con valor ---\n');

  // Obtener metadata de campos
  const metaRes = await fetch(`${base}/rest/api/3/field`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  const allFields = await metaRes.json();
  const fieldMap = {};
  for (const f of allFields) fieldMap[f.id] = f.name;

  for (const [key, value] of Object.entries(fields)) {
    if (!key.startsWith('customfield_')) continue;
    if (value === null || value === undefined) continue;
    
    const name = fieldMap[key] || key;
    const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
    console.log(`${name} (${key}):`);
    console.log(`  ${display}`);
    console.log('');
  }
}

(async () => {
  try {
    if (issueKey) {
      await inspectIssue(issueKey);
    } else {
      await listAllFields();
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
