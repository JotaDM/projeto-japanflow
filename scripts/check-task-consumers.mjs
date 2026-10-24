import fs from 'node:fs';
import path from 'node:path';
const root = 'src';
const consumers = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
      const body = fs.readFileSync(p, 'utf8');
      if (
        /\b(tasks|getTasksForUser|getSectorTasks)\b/.test(body) &&
        !p.endsWith('useFirebaseTasks.ts')
      )
        consumers.push(p.replaceAll('\\', '/'));
    }
  }
}
walk(root);
console.log('Consumers potenciais do estado global de tarefas:');
consumers.forEach((s) => console.log(' -', s));
console.log('Total de arquivos:', consumers.length);
console.log(
  'A migracao do listener global DEVE preservar contadores, quadros e tarefas concluídas nesses consumidores.'
);
