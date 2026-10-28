import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = read('src/App.tsx');
const workspace = read('src/components/CustomizableWorkspace.tsx');
const sentinel = read('src/pages/SentinelPage.tsx');
assert.match(app, /path="\/sentinel"/);
assert.match(workspace, /localStorage\.setItem/);
assert.match(workspace, /Restaurar padrão/);
assert.match(workspace, /Painel lateral/);
assert.match(workspace, /Salvar layout/);
assert.match(sentinel, /useCostGuard/);
assert.match(sentinel, /!authorized/);
for (const page of ['src/pages/EmployeeBoardPage.tsx', 'src/pages/AdminPage.tsx']) {
  assert.match(read(page), /CustomizableWorkspace/);
  assert.match(read(page), /EmployeeCalendar/);
}
console.log('Patch 1.8 + Sentinel: verificações estruturais aprovadas.');
