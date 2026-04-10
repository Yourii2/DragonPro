const fs = require('fs');
const path = require('path');

const dumpPath = path.join(__dirname, '..', 'Database', 'Schema998877.sql');
const reportPath = path.join(__dirname, '..', 'Database', 'schema_comparison_report.json');
const outPath = path.join(__dirname, '..', 'migrations', '20260213_add_missing_tables_from_schema.sql');

if (!fs.existsSync(dumpPath)) { console.error('Missing dump:', dumpPath); process.exit(1); }
if (!fs.existsSync(reportPath)) { console.error('Missing report:', reportPath); process.exit(1); }

const dump = fs.readFileSync(dumpPath, 'utf8');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const tables = report.tables_only_in_current || [];

function extractCreate(tableName) {
  const re = new RegExp("CREATE TABLE `" + tableName + "`[\\s\\S]*?;", 'i');
  const m = dump.match(re);
  if (!m) return null;
  // replace "CREATE TABLE `name`" -> "CREATE TABLE IF NOT EXISTS `name`"
  return m[0].replace(/CREATE TABLE `/i, 'CREATE TABLE IF NOT EXISTS `');
}

let out = [];
out.push('-- Generated migration: add missing tables from Database/Schema998877.sql');
out.push('-- Date: 2026-02-13');
out.push('SET FOREIGN_KEY_CHECKS=0;');

tables.forEach(t => {
  const sql = extractCreate(t);
  if (sql) {
    out.push('\n-- Table: ' + t + '\n');
    out.push(sql);
  } else {
    out.push('-- WARNING: CREATE TABLE for ' + t + ' not found in dump');
  }
});

out.push('\nSET FOREIGN_KEY_CHECKS=1;');

fs.writeFileSync(outPath, out.join('\n'));
console.log('Wrote migration to', outPath);
