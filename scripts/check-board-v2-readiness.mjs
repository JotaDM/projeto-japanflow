import { readFileSync, existsSync } from 'node:fs';
const paths = {
  listener: 'src/hooks/useFirebaseTasks.ts',
  context: 'src/contexts/AppContext.tsx',
  archived: 'src/hooks/useArchivedTasksForBoard.ts',
  kanban: 'src/components/KanbanBoard.tsx',
  tracking: 'src/pages/TaskTrackingPage.tsx',
  daily: 'src/components/DailyCompletedCounter.tsx',
};
const get = (k) => (existsSync(paths[k]) ? readFileSync(paths[k], 'utf8') : '');
const checks = [
  ['listener v2 por board_visible', get('listener').includes("where('board_visible', '==', true)")],
  ['chave de ativação explícita', get('listener').includes('VITE_TASKS_BOARD_QUERY_V2')],
  ['contexto usa hook de tarefas', get('context').includes('useFirebaseTasks(')],
  ['Kanban atualiza visibilidade no arquivo', get('kanban').includes('board_visible: false')],
  ['Kanban restaura visibilidade', get('kanban').includes('board_visible: true')],
  ['histórico por responsável', get('archived').includes('where(stream.field,')],
  ['acompanhamento usa consulta por criador', get('tracking').includes('useCreatedTasks')],
  ['contador diário usa consulta de conclusão', get('daily').includes('useDailyCompletedCount')],
];
let failures = 0;
for (const [label, success] of checks) {
  console.log(`${success ? 'OK' : 'BLOQUEIO'}: ${label}`);
  if (!success) failures++;
}
console.log(
  `Verificação estática: ${checks.length - failures}/${checks.length}. Não substitui QA, migração nem segurança.`
);
if (failures) process.exitCode = 2;
