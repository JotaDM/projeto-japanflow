/**
 * JapanFlow 1.6 — pré-voo de importação. APENAS LEITURA.
 * Uso: node scripts/audit-departmental-import.mjs caminho/arquivo.csv tracking|reverse|warranties
 * Não utiliza credenciais, Firebase nem acesso à rede.
 */
import { readFileSync } from 'node:fs';
const [file, kind] = process.argv.slice(2);
const templates = {
  tracking: ['legacy_id', 'client_name', 'tracking_code', 'status', 'created_at'],
  reverse: ['legacy_id', 'client_name', 'reason', 'status', 'created_at'],
  warranties: ['legacy_id', 'client_name', 'description', 'status', 'created_at'],
};
if (!file || !Object.hasOwn(templates, kind)) {
  console.error(
    'Uso: node scripts/audit-departmental-import.mjs arquivo.csv tracking|reverse|warranties'
  );
  process.exit(2);
}
// Parser CSV com aspas, vírgulas e novas linhas, sem dependências externas.
function parseCsv(input) {
  const out = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && ch === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(Boolean)) out.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('CSV inválido: aspas não fechadas');
  row.push(field);
  if (row.some(Boolean)) out.push(row);
  return out;
}
try {
  const rows = parseCsv(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const headers = rows.shift()?.map((s) => s.trim()) || [];
  const missing = templates[kind].filter((x) => !headers.includes(x));
  const duplicateColumns = headers.filter((x, i) => headers.indexOf(x) !== i);
  const invalidWidth = rows
    .map((r, i) => (r.length !== headers.length ? i + 2 : null))
    .filter(Boolean);
  const idCol = headers.indexOf('legacy_id');
  const ids = idCol < 0 ? [] : rows.map((r) => r[idCol]?.trim());
  const duplicateIds = ids.filter((id, i) => id && ids.indexOf(id) !== i);
  const emptyIds = ids.filter((id) => !id).length;
  const result = {
    type: kind,
    lines: rows.length,
    missingColumns: missing,
    duplicateColumns,
    invalidWidthRows: invalidWidth.slice(0, 20),
    duplicateLegacyIds: [...new Set(duplicateIds)].slice(0, 20),
    emptyLegacyIds: emptyIds,
    readonly: true,
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    missing.length ||
    duplicateColumns.length ||
    invalidWidth.length ||
    duplicateIds.length ||
    emptyIds
  )
    process.exitCode = 1;
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
