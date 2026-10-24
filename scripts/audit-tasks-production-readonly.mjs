/** Auditoria agregada SOMENTE LEITURA da colecao tasks em producao. */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const PROJECT_ID = 'japanflow-erp';
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Emulador detectado nesta sessao. Abra outro PowerShell para auditar producao.');
}
if (!process.argv.includes('--confirm-readonly-production') || process.argv.length !== 3) {
  throw new Error(
    'Uso: node scripts/audit-tasks-production-readonly.mjs --confirm-readonly-production'
  );
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
  throw new Error('GCLOUD_PROJECT difere do projeto de producao esperado.');
}
if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== PROJECT_ID) {
  throw new Error('GOOGLE_CLOUD_PROJECT difere do projeto esperado.');
}
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const known = new Set(['todo', 'in_progress', 'paused', 'done']);
const done = new Set(['done', 'completed', 'complete', 'concluido', 'concluído']);
const counts = {
  project: PROJECT_ID,
  mode: 'PRODUCTION_READ_ONLY',
  scanned: 0,
  done: 0,
  active: 0,
  missingCompletedAt: 0,
  activeWithCompletedAt: 0,
  legacyStatuses: 0,
  doneWithHistoricalCompletionDate: 0,
  doneWithoutHistoricalCompletionDate: 0,
  withMultipleAssignees: 0,
  withArchiveMarker: 0,
};
const parseDate = (value) => {
  if (!value) return null;
  const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};
let cursor;
while (true) {
  let query = db.collection('tasks').orderBy(FieldPath.documentId()).limit(200);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (page.empty) break;
  for (const snap of page.docs) {
    const row = snap.data();
    counts.scanned++;
    const status = String(row.status ?? '')
      .trim()
      .toLowerCase();
    const isDone = done.has(status);
    if (!known.has(status)) counts.legacyStatuses++;
    if (
      (Array.isArray(row.assignee_ids) && row.assignee_ids.length > 1) ||
      (Array.isArray(row.assigneeIds) && row.assigneeIds.length > 1)
    )
      counts.withMultipleAssignees++;
    if (row.archived_at || row.archivedAt) counts.withArchiveMarker++;
    if (isDone) {
      counts.done++;
      if (!parseDate(row.completed_at ?? row.completedAt)) {
        counts.missingCompletedAt++;
        const history = Array.isArray(row.status_history)
          ? row.status_history
          : Array.isArray(row.statusHistory)
            ? row.statusHistory
            : [];
        const hasHistory = history.some(
          (entry) =>
            done.has(
              String(entry?.status ?? '')
                .trim()
                .toLowerCase()
            ) &&
            parseDate(
              entry.enteredAt ??
                entry.entered_at ??
                entry.timestamp ??
                entry.changedAt ??
                entry.date
            )
        );
        if (hasHistory) counts.doneWithHistoricalCompletionDate++;
        else counts.doneWithoutHistoricalCompletionDate++;
      }
    } else {
      counts.active++;
      if (row.completed_at || row.completedAt) counts.activeWithCompletedAt++;
    }
  }
  cursor = page.docs.at(-1);
}
console.log(JSON.stringify(counts, null, 2));
console.log('Auditoria concluida. Nenhum documento foi alterado.');
