import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = readFileSync('src/components/CustomizableWorkspace.tsx', 'utf8');
assert.match(
  src,
  /editingRef\.current \|\| !snapshot\.exists\(\)/,
  'Sincronizacao remota nao pode substituir edicao em curso'
);
assert.match(
  src,
  /await setDoc\(preferenceDoc\(userId\), \{ items: draft/,
  'Salvar deve aguardar a confirmacao do Firestore'
);
assert.match(
  src,
  /await setDoc\(preferenceDoc\(userId\), \{ items: defaults/,
  'Restaurar deve aguardar a confirmacao do Firestore'
);
assert.match(src, /disabled=\{saving\}/, 'Evitar cliques simultaneos durante persistencia');
console.log('OK: verificacoes estruturais de sincronizacao e salvamento');
