/** Insere APENAS fixtures com prefixo qa-b- num emulador demo-*. */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT;
if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host || '') || !/^demo-[\w-]+$/.test(projectId || '')) {
  throw new Error('BLOQUEADO: apenas Firestore Emulator local e projeto demo-*');
}
initializeApp({ projectId });
const db = getFirestore();
const t = (iso) => Timestamp.fromDate(new Date(iso));
const base = {
  description: 'Fixture B',
  priority: 'medium',
  created_by: 'qa-admin',
  created_at: t('2026-10-01T12:00:00Z'),
  updated_at: t('2026-10-22T12:00:00Z'),
};
const rows = [
  [
    'qa-b-active',
    {
      status: 'todo',
      title: 'Operacional',
      assignee_id: 'qa-admin',
      status_history: [{ status: 'todo', enteredAt: '2026-10-01T12:00:00Z' }],
    },
  ],
  [
    'qa-b-done-good',
    {
      status: 'done',
      title: 'Concluída com data',
      assignee_id: 'qa-admin',
      completed_at: t('2026-10-22T15:00:00Z'),
      status_history: [
        { status: 'todo', enteredAt: '2026-10-01T12:00:00Z' },
        { status: 'done', enteredAt: '2026-10-22T15:00:00Z' },
      ],
    },
  ],
  [
    'qa-b-done-missing',
    {
      status: 'done',
      title: 'Concluída legada',
      assignee_id: 'emp-6',
      assignee_ids: ['emp-6', 'qa-admin'],
      status_history: [{ status: 'done', enteredAt: '2026-10-20T15:00:00Z' }],
    },
  ],
  [
    'qa-b-done-archived',
    {
      status: 'done',
      title: 'Arquivada',
      assignee_id: 'qa-admin',
      archived_at: t('2026-10-22T16:00:00Z'),
      status_history: [{ status: 'done', enteredAt: '2026-10-21T15:00:00Z' }],
    },
  ],
  [
    'qa-b-done-unknown',
    { status: 'done', title: 'Sem data confiável', assignee_id: 'emp-6', status_history: [] },
  ],
  [
    'qa-b-active-stale',
    {
      status: 'in_progress',
      title: 'Reaberta com campo obsoleto',
      assignee_id: 'qa-admin',
      completed_at: t('2026-10-22T10:00:00Z'),
      status_history: [
        { status: 'done', enteredAt: '2026-10-21T15:00:00Z' },
        { status: 'in_progress', enteredAt: '2026-10-22T10:00:00Z' },
      ],
    },
  ],
  [
    'qa-b-legacy',
    {
      status: 'completed',
      title: 'Status legado',
      assignee_id: 'qa-admin',
      status_history: [{ status: 'completed', enteredAt: '2026-10-21T10:00:00Z' }],
    },
  ],
];
for (const [id, data] of rows)
  await db
    .collection('tasks')
    .doc(id)
    .set({ ...base, ...data });
console.log(
  JSON.stringify({ projectId, seeded: rows.map(([id]) => id), count: rows.length }, null, 2)
);
