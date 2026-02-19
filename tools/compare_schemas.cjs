const fs = require('fs');
const path = require('path');

function readSQLBlocks(sql) {
  const blocks = {};
  const createRegex = /CREATE TABLE\s+`?([\w_]+)`?\s*\(([^;]+?)\)\s*ENGINE=/gims;
  let m;
  while ((m = createRegex.exec(sql))) {
    const name = m[1];
    const body = m[2];
    blocks[name] = parseCreateBody(body);
  }
  return blocks;
}

function parseCreateBody(body) {
  const lines = body.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const cols = {};
  const pk = [];
  const indexes = {};
  const fks = {};
  for (let line of lines) {
    if (line.endsWith(',')) line = line.slice(0,-1).trim();
    if (line.startsWith('`')) {
      const m = line.match(/^`([^`]+)`\s+(.*)$/);
      if (m) {
        const col = m[1];
        const rest = m[2];
        const type = rest.split(/\s+/)[0];
        const isNull = /NOT NULL/i.test(rest) ? false : true;
        const mdef = rest.match(/DEFAULT\s+([^\s]+)/i);
        const def = mdef ? mdef[1].replace(/,$/,'') : null;
        cols[col] = { type: type, nullable: isNull, default: def, raw: rest };
      }
    } else if (/^PRIMARY KEY/i.test(line)) {
      const m = line.match(/PRIMARY KEY \(([^\)]+)\)/i);
      if (m) {
        const colsList = m[1].split(',').map(s=>s.replace(/`/g,'').trim());
        pk.push(...colsList);
      }
    } else if (/^(UNIQUE )?KEY|^UNIQUE/i.test(line)) {
      const m = line.match(/(?:UNIQUE )?KEY\s+`?([^`\s]+)`?\s*\(([^\)]+)\)/i);
      if (m) {
        const name = m[1];
        const colsList = m[2].split(',').map(s=>s.replace(/`/g,'').trim());
        indexes[name] = colsList;
      } else {
        const mu = line.match(/UNIQUE\s*\(([^\)]+)\)/i);
        if (mu) {
          indexes['unique_'+Object.keys(indexes).length] = mu[1].split(',').map(s=>s.replace(/`/g,'').trim());
        }
      }
    } else if (/^CONSTRAINT/i.test(line) || /FOREIGN KEY/i.test(line)) {
      const m = line.match(/FOREIGN KEY \(([^\)]+)\) REFERENCES `?([\w_]+)`? \(([^\)]+)\)/i);
      if (m) {
        const colsList = m[1].split(',').map(s=>s.replace(/`/g,'').trim());
        const refTable = m[2];
        const refCols = m[3].split(',').map(s=>s.replace(/`/g,'').trim());
        fks[Object.keys(fks).length] = { cols: colsList, refTable, refCols };
      }
    }
  }
  return { columns: cols, pk, indexes, fks };
}

function applyAlterStatements(schema, sql) {
  const alterRegex = /ALTER TABLE\s+`?([\w_]+)`?\s+(.*?);/gims;
  let m;
  while ((m = alterRegex.exec(sql))) {
    const table = m[1];
    const rest = m[2].trim();
    if (!schema[table]) {
      schema[table] = { columns: {}, pk: [], indexes: {}, fks: {} };
    }
    const parts = rest.split(/,\s+(?=ADD|DROP|MODIFY|CHANGE|RENAME|CONVERT|ALTER)/i);
    parts.forEach(p => {
      p = p.trim();
      const addCol = p.match(/ADD\s+COLUMN\s+`?([^`\s]+)`?\s+(.*)/i);
      if (addCol) {
        const col = addCol[1];
        const def = addCol[2].replace(/,$/,'').trim();
        const type = def.split(/\s+/)[0];
        const isNull = /NOT NULL/i.test(def) ? false : true;
        const mdef = def.match(/DEFAULT\s+([^\s]+)/i);
        const defv = mdef ? mdef[1] : null;
        schema[table].columns[col] = { type, nullable: isNull, default: defv, raw: def };
        return;
      }
      const addKey = p.match(/ADD\s+(UNIQUE\s+)?KEY\s+`?([^`\s]+)`?\s*\(([^\)]+)\)/i);
      if (addKey) {
        const name = addKey[2];
        const colsList = addKey[3].split(',').map(s=>s.replace(/`/g,'').trim());
        schema[table].indexes[name] = colsList;
        return;
      }
      const addFk = p.match(/ADD\s+CONSTRAINT\s+`?([^`\s]+)`?\s+FOREIGN KEY\s*\(([^\)]+)\)\s+REFERENCES\s+`?([\w_]+)`?\s*\(([^\)]+)\)/i);
      if (addFk) {
        const name = addFk[1];
        const colsList = addFk[2].split(',').map(s=>s.replace(/`/g,'').trim());
        const refTable = addFk[3];
        const refCols = addFk[4].split(',').map(s=>s.replace(/`/g,'').trim());
        schema[table].fks[name] = { cols: colsList, refTable, refCols };
        return;
      }
      const addKey2 = p.match(/ADD\s+KEY\s*\(([^\)]+)\)/i);
      if (addKey2) {
        const colsList = addKey2[1].split(',').map(s=>s.replace(/`/g,'').trim());
        schema[table].indexes['idx_'+Object.keys(schema[table].indexes).length] = colsList;
        return;
      }
    });
  }
}

function loadMigrationsSchema(migrationsDir) {
  const files = fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort();
  const schema = {};
  for (const f of files) {
    const p = path.join(migrationsDir,f);
    const content = fs.readFileSync(p,'utf8');
    const blocks = readSQLBlocks(content);
    Object.keys(blocks).forEach(t => schema[t] = blocks[t]);
    applyAlterStatements(schema, content);
  }
  return schema;
}

function compareSchemas(base, current) {
  const report = { tables_only_in_current: [], tables_only_in_base: [], diffs: {} };
  const baseTables = new Set(Object.keys(base));
  const currTables = new Set(Object.keys(current));
  for (const t of currTables) if (!baseTables.has(t)) report.tables_only_in_current.push(t);
  for (const t of baseTables) if (!currTables.has(t)) report.tables_only_in_base.push(t);

  const common = [...baseTables].filter(t => currTables.has(t));
  for (const t of common) {
    const bs = base[t];
    const cs = current[t];
    const cd = { missing_columns: [], extra_columns: [], changed_columns: [], missing_indexes: [], extra_indexes: [], pk_diff: false, fk_diff: [] };
    const bcols = bs.columns || {};
    const ccols = cs.columns || {};
    for (const c of Object.keys(bcols)) if (!ccols[c]) cd.missing_columns.push({ column: c, definition: bcols[c] });
    for (const c of Object.keys(ccols)) if (!bcols[c]) cd.extra_columns.push({ column: c, definition: ccols[c] });
    for (const c of Object.keys(bcols)) if (ccols[c]) {
      const bdef = bcols[c]; const cdef = ccols[c];
      if (bdef.type.toLowerCase() !== cdef.type.toLowerCase() || (!!bdef.nullable) !== (!!cdef.nullable) || String(bdef.default) !== String(cdef.default)) {
        cd.changed_columns.push({ column: c, base: bdef, current: cdef });
      }
    }
    const bidx = bs.indexes||{}; const cidx = cs.indexes||{};
    for (const n of Object.keys(bidx)) if (!cidx[n]) cd.missing_indexes.push({ name: n, cols: bidx[n] });
    for (const n of Object.keys(cidx)) if (!bidx[n]) cd.extra_indexes.push({ name: n, cols: cidx[n] });
    const bpk = (bs.pk||[]).join(','); const cpk = (cs.pk||[]).join(',');
    if (bpk !== cpk) cd.pk_diff = { base: bs.pk, current: cs.pk };
    const bfk = JSON.stringify(bs.fks||{}); const cfk = JSON.stringify(cs.fks||{});
    if (bfk !== cfk) cd.fk_diff = { base: bs.fks||{}, current: cs.fks||{} };
    if (cd.missing_columns.length || cd.extra_columns.length || cd.changed_columns.length || cd.missing_indexes.length || cd.extra_indexes.length || cd.pk_diff || (cd.fk_diff && Object.keys(cd.fk_diff).length)) {
      report.diffs[t] = cd;
    }
  }
  return report;
}

function main() {
  const schemaFile = path.join(__dirname,'..','Database','Schema998877.sql');
  if (!fs.existsSync(schemaFile)) { console.error('Missing current schema file:', schemaFile); process.exit(1); }
  const currSql = fs.readFileSync(schemaFile,'utf8');
  const current = readSQLBlocks(currSql);

  const migrationsDir = path.join(__dirname,'..','migrations');
  const base = loadMigrationsSchema(migrationsDir);

  const report = compareSchemas(base, current);
  fs.writeFileSync(path.join(__dirname,'..','Database','schema_comparison_report.json'), JSON.stringify(report,null,2));
  console.log('Comparison finished. Report written to Database/schema_comparison_report.json');
}

main();
