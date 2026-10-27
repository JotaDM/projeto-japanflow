import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST || '';
const project = process.env.GCLOUD_PROJECT || '';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !project.startsWith('demo-'))
  throw new Error('Somente emulador demo-*');
initializeApp({ projectId: project });
const db = getFirestore();
const prefix = `qa-bv2-${Date.now()}`;
const refs = ['active', 'done', 'archived', 'other'].map((s) =>
  db.collection('tasks').doc(`${prefix}-${s}`)
);
const archived = Timestamp.fromDate(new Date('2026-10-21T15:00:00.000Z'));
try {
  const batch = db.batch();
  const data = [
    { status: 'todo', board_visible: true, assignee_id: 'qa-a', assignee_ids: ['qa-a'] },
    { status: 'done', board_visible: true, assignee_id: 'qa-a', assignee_ids: ['qa-a', 'qa-b'] },
    {
      status: 'done',
      board_visible: false,
      archived_at: archived,
      assignee_id: 'qa-a',
      assignee_ids: ['qa-a', 'qa-b'],
    },
    {
      status: 'done',
      board_visible: false,
      archived_at: archived,
      assignee_id: 'qa-c',
      assignee_ids: ['qa-c'],
    },
  ];
  refs.forEach((ref, i) =>
    batch.set(ref, { ...data[i], created_at: Timestamp.now(), title: prefix })
  );
  await batch.commit();
  const board = await db.collection('tasks').where('board_visible', '==', true).get();
  assert(board.docs.some((d) => d.id === refs[0].id));
  assert(board.docs.some((d) => d.id === refs[1].id));
  assert(!board.docs.some((d) => d.id === refs[2].id));
  console.log('PASS: quadro exibe ativo e concluído não arquivado, sem arquivado');
  for (const [field, op, user] of [
    ['assignee_id', '==', 'qa-a'],
    ['assignee_ids', 'array-contains', 'qa-b'],
  ]) {
    const result = await db
      .collection('tasks')
      .where(field, op, user)
      .where('archived_at', '>', Timestamp.fromMillis(0))
      .orderBy('archived_at', 'desc')
      .limit(25)
      .get();
    assert(result.docs.some((d) => d.id === refs[2].id));
    assert(!result.docs.some((d) => d.id === refs[3].id));
  }
  console.log('PASS: paginação por responsável principal e secundário');
  await refs[2].update({ board_visible: true, archived_at: Timestamp.fromMillis(0) });
  assert.equal((await refs[2].get()).data().board_visible, true);
  console.log('PASS: restauração retorna ao quadro');
} finally {
  await Promise.all(refs.map((ref) => ref.delete().catch(() => undefined)));
}
