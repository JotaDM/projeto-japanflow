import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dialog = readFileSync('src/components/TaskHistoryDialog.tsx', 'utf8');
const tracking = readFileSync('src/pages/TaskTrackingPage.tsx', 'utf8');
const daily = readFileSync('src/components/DailyCompletedCounter.tsx', 'utf8');
assert.match(dialog, /history\.items\.map/);
assert.doesNotMatch(dialog, /const \{ tasks, users \} = useApp/);
assert.match(tracking, /useCreatedTasks/);
assert.match(daily, /useDailyCompletedCount/);
console.log('OK: histórico e indicadores usam consultas independentes.');
console.log(
  'ATENÇÃO: listener global continua ativo para os quadros, não habilitar piloto em produção.'
);
