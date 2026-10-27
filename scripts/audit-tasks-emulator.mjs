/** JapanFlow 1.3-A: auditoria SOMENTE LEITURA no emulador Firestore. */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const project = process.env.GCLOUD_PROJECT || 'demo-japanflow-qa';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) {
  console.error(
    'BLOQUEADO: configure FIRESTORE_EMULATOR_HOST=127.0.0.1:8085. Produção não é permitida.'
  );
  process.exit(2);
}
if (!project.startsWith('demo-')) {
  console.error('BLOQUEADO: projeto deve iniciar com demo-.');
  process.exit(2);
}
if (!getApps().length) initializeApp({ projectId: project });
const db = getFirestore();
const result = await db.collection('tasks').get();
const metric = {
  total: result.size,
  status: {},
  schema: { snake_only: 0, camel_only: 0, both: 0, neither: 0 },
  archived: 0,
  no_created_date: 0,
  no_assignee: 0,
  multi_assignee: 0,
};
for (const d of result.docs) {
  const x = d.data();
  const status = String(x.status ?? 'todo');
  metric.status[status] = (metric.status[status] ?? 0) + 1;
  const snake = 'created_at' in x;
  const camel = 'createdAt' in x;
  metric.schema[
    snake && camel ? 'both' : snake ? 'snake_only' : camel ? 'camel_only' : 'neither'
  ]++;
  if ('archived_at' in x || 'archivedAt' in x) metric.archived++;
  if (!snake && !camel) metric.no_created_date++;
  if (!x.assignee_id && !x.assigneeId && !(Array.isArray(x.assignee_ids) && x.assignee_ids.length))
    metric.no_assignee++;
  if (Array.isArray(x.assignee_ids) && x.assignee_ids.length > 1) metric.multi_assignee++;
}
console.log('AUDITORIA FIRESTORE (EMULADOR)');
console.log(JSON.stringify({ project, ...metric }, null, 2));
console.log(
  'Observação: leitura única de todos os documentos apenas no emulador; métricas não equivalem ao consumo real em produção.'
);
