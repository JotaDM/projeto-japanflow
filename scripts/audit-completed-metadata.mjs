/** Auditoria somente-leitura. Por segurança, recusa produção. */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
if (!host || !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) {
  throw new Error('BLOQUEADO: FIRESTORE_EMULATOR_HOST local obrigatório.');
}
if (!project || !project.startsWith('demo-')) {
  throw new Error('BLOQUEADO: projeto demo-* obrigatório.');
}
initializeApp({ projectId: project });
const db = getFirestore();
let scanned = 0,
  done = 0,
  missing = 0,
  mismatched = 0,
  legacyStatuses = 0;
const examples = [];
let cursor;
while (true) {
  let q = db.collection('tasks').orderBy(FieldPath.documentId()).limit(250);
  if (cursor) q = q.startAfter(cursor);
  const page = await q.get();
  if (page.empty) break;
  for (const doc of page.docs) {
    const d = doc.data();
    scanned++;
    const status = String(d.status || '').toLowerCase();
    if (!['todo', 'in_progress', 'paused', 'done'].includes(status)) legacyStatuses++;
    const completed = d.completed_at;
    if (status === 'done') {
      done++;
      if (!completed) {
        missing++;
        if (examples.length < 12) examples.push(doc.id);
      }
    } else if (completed) mismatched++;
  }
  cursor = page.docs.at(-1);
}
console.log(
  JSON.stringify(
    {
      project,
      scanned,
      done,
      missingCompletedAt: missing,
      activeWithCompletedAt: mismatched,
      legacyStatuses,
      sampleMissingIds: examples,
    },
    null,
    2
  )
);
if (missing || mismatched || legacyStatuses) process.exitCode = 2;
