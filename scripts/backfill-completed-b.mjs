/** Backfill limitado e auditável: preview padrão, --apply só emulador demo. */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldPath } from 'firebase-admin/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT;
if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host || '') || !/^demo-[\w-]+$/.test(projectId || ''))
  throw new Error('BLOQUEADO: exige emulador local e projeto demo-*');
if (process.argv.some((x) => x.startsWith('--') && x !== '--apply'))
  throw new Error('Argumento desconhecido');
const apply = process.argv.includes('--apply');
initializeApp({ projectId });
const db = getFirestore();
const doneStatuses = new Set(['done']);
const activeStatuses = new Set(['todo', 'in_progress', 'paused']);
const iso = (v) => {
  if (!v) return null;
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const report = {
  mode: apply ? 'APPLY_EMULATOR' : 'PREVIEW',
  scanned: 0,
  backfilled: 0,
  cleared: 0,
  skippedUnknown: 0,
  skippedLegacy: 0,
  unchanged: 0,
  examples: [],
};
let cursor;
while (true) {
  let q = db.collection('tasks').orderBy(FieldPath.documentId()).limit(200);
  if (cursor) q = q.startAfter(cursor);
  const page = await q.get();
  if (page.empty) break;
  for (const snap of page.docs) {
    report.scanned++;
    const data = snap.data();
    const status = String(data.status || '').toLowerCase();
    let operation = null,
      value = null;
    if (doneStatuses.has(status) && !data.completed_at) {
      const history = Array.isArray(data.status_history)
        ? data.status_history
        : Array.isArray(data.statusHistory)
          ? data.statusHistory
          : [];
      const dates = history
        .filter((x) => String(x?.status || '').toLowerCase() === 'done')
        .map((x) => iso(x.enteredAt ?? x.entered_at ?? x.timestamp ?? x.changedAt ?? x.date))
        .filter(Boolean)
        .sort();
      const last = dates.at(-1);
      if (last) {
        operation = 'backfill';
        value = Timestamp.fromDate(new Date(last));
      } else report.skippedUnknown++;
    } else if (activeStatuses.has(status) && data.completed_at) {
      operation = 'clear';
    } else if (!doneStatuses.has(status) && !activeStatuses.has(status)) report.skippedLegacy++;
    else report.unchanged++;
    if (operation) {
      if (operation === 'backfill') report.backfilled++;
      else report.cleared++;
      if (report.examples.length < 15)
        report.examples.push({ id: snap.id, action: operation, completion: iso(value) });
      if (apply) await snap.ref.update({ completed_at: value });
    }
  }
  cursor = page.docs.at(-1);
}
console.log(JSON.stringify(report, null, 2));
if (report.skippedUnknown || report.skippedLegacy) process.exitCode = 2;
