import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const failures = [];
const info = [];
function check(condition, success, failure) {
  if (condition) console.log(`OK: ${success}`);
  else {
    console.error(`BLOQUEIO: ${failure}`);
    failures.push(failure);
  }
}
const tasks = read('src/hooks/useFirebaseTasks.ts');
const ctx = read('src/contexts/AppContext.tsx');
const history = read('src/hooks/useCompletedTaskHistory.ts');
const daily = read('src/components/DailyCompletedCounter.tsx');
const tracking = read('src/pages/TaskTrackingPage.tsx');
const dialog = read('src/components/TaskHistoryDialog.tsx');
const indexes = JSON.parse(read('firestore.indexes.json'));
const hasIndex = indexes.indexes.some(
  (i) =>
    i.collectionGroup === 'tasks' &&
    i.fields.some((f) => f.fieldPath === 'status') &&
    i.fields.some((f) => f.fieldPath === 'created_at')
);
check(hasIndex, 'índice status/created_at no arquivo local', 'índice composto das tarefas ausente');
check(
  !/onSnapshot\(\s*collection\(db, ['"]tasks['"]\)/.test(tasks),
  'listener global foi retirado',
  'listener global de tasks ainda existe no modo compatibilidade'
);
check(
  !/import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_TASKS_FILTERED_PILOT/.test(tasks),
  'migração não depende do piloto experimental',
  'piloto experimental não substitui uma migração pronta'
);
check(
  !/const relevant\s*=\s*userId\s*\?\s*tasks\.filter/.test(daily),
  'contador não depende do array histórico global',
  'DailyCompletedCounter depende das tarefas globais para concluir o total'
);
check(
  !/const createdTasks[\s\S]{0,180}return tasks\.filter/.test(tracking),
  'acompanhamento desacoplado do histórico global',
  'TaskTrackingPage calcula estatísticas sobre tasks global'
);
check(
  !/let filtered = tasks\.filter/.test(dialog),
  'histórico do diálogo usa consulta paginada',
  'TaskHistoryDialog ainda depende do array global'
);
check(
  !/const tasks = useMemo\([\s\S]{0,250}firebaseTasks\.tasks\.map/.test(ctx),
  'contexto desacoplado do array integral',
  'AppContext continua centralizando todas as tarefas'
);
check(
  /orderBy\(['"]created_at['"]/.test(history),
  'histórico paginado ordenado por criação',
  'consulta paginada sem cursor temporal'
);
console.log(`\nResultado: ${failures.length} bloqueio(s).`);
if (failures.length) {
  console.error('NÃO publicar o listener filtrado em produção.');
  process.exitCode = 1;
}
