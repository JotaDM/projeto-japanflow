import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const source = read('src/hooks/useFirebaseTasks.ts');
const ctx = read('src/contexts/AppContext.tsx');
const stats = read('src/pages/TaskTrackingPage.tsx');
const counter = read('src/components/DailyCompletedCounter.tsx');
const blockers = [];
if (source.includes("onSnapshot(\n        collection(db, 'tasks')"))
  blockers.push('Listener de coleção completa continua ativo no modo normal');
if (ctx.includes('firebaseTasks.tasks.map'))
  blockers.push('Contexto ainda deriva dados do listener global');
if (stats.includes('createdTasks.filter((t) => t.status'))
  blockers.push('Estatísticas dependem de array parcial');
if (counter.includes('relevant.filter((task) =>'))
  blockers.push('Contador diário depende de array parcial');
console.log('Auditoria de prontidão da migração 1.3-A:');
for (const item of blockers) console.log('BLOQUEIO:', item);
if (blockers.length) {
  console.log(`${blockers.length} bloqueios: não habilitar VITE_TASKS_FILTERED_PILOT em produção.`);
  process.exitCode = 2;
} else console.log('Verificações estáticas aprovadas; ainda validar testes funcionais e índices.');
