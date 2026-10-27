/** Auditoria estática conservadora — não acessa serviços externos ou produção. */
import { readFileSync, existsSync } from 'node:fs';
const required = [
  'src/components/KanbanBoard.tsx',
  'src/components/NewTaskPopup.tsx',
  'src/pages/EmployeeBoardPage.tsx',
  'src/pages/BacklogPage.tsx',
  'src/pages/DepartmentalPage.tsx',
  'firestore.rules',
  'storage.rules',
];
const missing = required.filter((x) => !existsSync(x));
const backlog = existsSync('src/pages/BacklogPage.tsx')
  ? readFileSync('src/pages/BacklogPage.tsx', 'utf8')
  : '';
const checks = {
  requiredFiles: missing.length === 0,
  backlogAiExport: backlog.includes('Gerar relatório para IA'),
  backlogNoApiCall: !backlog.includes('fetch('),
};
console.log(JSON.stringify({ checks, missing, mode: 'read-only' }, null, 2));
if (Object.values(checks).some((x) => !x)) process.exitCode = 1;
