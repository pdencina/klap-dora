/**
 * Script para exportar la BD de Supabase a un archivo SQL compatible con Aurora PostgreSQL.
 * Uso: node scripts/export-db.js
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env o variables de entorno.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string directa de Supabase
// Formato: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

if (!DATABASE_URL) {
  console.error('ERROR: Necesitas la variable DATABASE_URL.');
  console.error('Encuéntrala en Supabase → Settings → Database → Connection string (URI)');
  console.error('Ejecución: DATABASE_URL="postgresql://..." node scripts/export-db.js');
  process.exit(1);
}

const OUTPUT_FILE = path.join(__dirname, '..', 'BD', 'export_aurora.sql');

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Conectado a Supabase.');

  let sql = '';
  sql += '-- =====================================================\n';
  sql += '-- Export klap-dora Supabase → Aurora PostgreSQL\n';
  sql += `-- Generado: ${new Date().toISOString()}\n`;
  sql += '-- =====================================================\n\n';

  // 1. Obtener todas las tablas públicas
  const tablesResult = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tables = tablesResult.rows.map(r => r.table_name);
  console.log(`Tablas encontradas: ${tables.length}`);

  // 2. Para cada tabla: obtener DDL y datos
  for (const table of tables) {
    console.log(`  Exportando: ${table}...`);

    // DDL: columnas
    const colsResult = await client.query(`
      SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    sql += `-- ===== ${table} =====\n`;
    sql += `DROP TABLE IF EXISTS ${table} CASCADE;\n`;
    sql += `CREATE TABLE ${table} (\n`;

    const colDefs = colsResult.rows.map(col => {
      let type = col.data_type;
      if (type === 'character varying') type = col.character_maximum_length ? `varchar(${col.character_maximum_length})` : 'text';
      if (type === 'USER-DEFINED') type = 'text';
      if (type === 'ARRAY') type = 'text';
      if (type === 'timestamp with time zone') type = 'timestamptz';
      if (type === 'timestamp without time zone') type = 'timestamp';

      let def = `  ${col.column_name} ${type}`;
      if (col.column_default) {
        let defaultVal = col.column_default;
        // Limpiar defaults de Supabase específicos
        if (defaultVal.includes('gen_random_uuid')) defaultVal = 'gen_random_uuid()';
        if (defaultVal.includes('now()')) defaultVal = 'now()';
        def += ` DEFAULT ${defaultVal}`;
      }
      if (col.is_nullable === 'NO') def += ' NOT NULL';
      return def;
    });

    sql += colDefs.join(',\n');
    sql += '\n);\n\n';

    // Primary keys
    const pkResult = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
    `, [table]);

    if (pkResult.rows.length) {
      const pkCols = pkResult.rows.map(r => r.column_name).join(', ');
      sql += `ALTER TABLE ${table} ADD PRIMARY KEY (${pkCols});\n\n`;
    }

    // Datos
    const dataResult = await client.query(`SELECT * FROM "${table}"`);
    if (dataResult.rows.length > 0) {
      const cols = Object.keys(dataResult.rows[0]);
      for (const row of dataResult.rows) {
        const values = cols.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return String(val);
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')});\n`;
      }
      sql += '\n';
    }
  }

  // 3. Indexes
  const idxResult = await client.query(`
    SELECT indexdef FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname NOT LIKE '%pkey%'
    ORDER BY tablename, indexname
  `);
  if (idxResult.rows.length) {
    sql += '-- ===== INDEXES =====\n';
    for (const row of idxResult.rows) {
      sql += `${row.indexdef};\n`;
    }
    sql += '\n';
  }

  await client.end();

  fs.writeFileSync(OUTPUT_FILE, sql, 'utf-8');
  console.log(`\n✅ Exportado a: ${OUTPUT_FILE}`);
  console.log(`   Tamaño: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
