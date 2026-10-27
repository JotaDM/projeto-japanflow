import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST,
  projectId = process.env.GCLOUD_PROJECT;
if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host || '') || !/^demo-[\w-]+$/.test(projectId || ''))
  throw new Error('BLOQUEADO: emulador demo-* obrigatório');
initializeApp({ projectId });
const db = getFirestore();
const expected = {
  'qa-b-active': ['todo', false],
  'qa-b-done-good': ['done', true],
  'qa-b-done-missing': ['done', true],
  'qa-b-done-archived': ['done', true],
  'qa-b-done-unknown': ['done', false],
  'qa-b-active-stale': ['in_progress', false],
  'qa-b-legacy': ['completed', false],
};
let failures = 0;
for (const [id, [status, completed]] of Object.entries(expected)) {
  const snap = await db.collection('tasks').doc(id).get();
  const d = snap.data();
  const pass = snap.exists && d.status === status && Boolean(d.completed_at) === completed;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}`);
  if (!pass) failures++;
}
console.log(
  `Resultado: ${Object.keys(expected).length - failures}/${Object.keys(expected).length}`
);
if (failures) process.exitCode = 1;
