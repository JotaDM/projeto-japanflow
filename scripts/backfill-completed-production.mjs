/** Backfill conservador: somente completed_at de tarefas atualmente concluídas.
 * Por padrão: PREVIEW (nenhuma gravação). Usa ADC. Aplique apenas após backup.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = 'japanflow-erp';
const apply = process.argv.includes('--apply');
const explicit = process.argv.includes('--confirm-project=japanflow-erp');
const allowed = new Set(['--apply', '--confirm-project=japanflow-erp', '--strict']);
if (process.argv.slice(2).some((arg) => !allowed.has(arg)))
  throw new Error('Argumento desconhecido.');
if (apply && !explicit)
  throw new Error('Para aplicar, informe --apply --confirm-project=japanflow-erp.');
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Emulador detectado; abra terminal separado para produção.');
for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[key] && process.env[key] !== PROJECT_ID)
    throw new Error(`${key} não corresponde a ${PROJECT_ID}`);
}
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const doneStatuses = new Set(['done', 'completed', 'complete', 'concluido', 'concluído']);
const parseDate = (value) => {
  if (!value) return null;
  const d = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};
const candidates = [];
const review = [];
const strict = process.argv.includes('--strict');
const counts = {
  project: PROJECT_ID,
  mode: apply ? 'APPLY_PRODUCTION' : 'PREVIEW_ONLY',
  scanned: 0,
  alreadyPopulated: 0,
  candidates: 0,
  uncertain: 0,
  conflictingHistory: 0,
  modified: 0,
  skippedConcurrentChange: 0,
  skippedMissing: 0,
};
let cursor;
while (true) {
  let q = db.collection('tasks').orderBy(FieldPath.documentId()).limit(200);
  if (cursor) q = q.startAfter(cursor);
  const page = await q.get();
  if (page.empty) break;
  for (const snap of page.docs) {
    counts.scanned++;
    const row = snap.data();
    if (
      !doneStatuses.has(
        String(row.status ?? '')
          .trim()
          .toLowerCase()
      )
    )
      continue;
    if (parseDate(row.completed_at ?? row.completedAt)) {
      counts.alreadyPopulated++;
      continue;
    }
    const history = Array.isArray(row.status_history)
      ? row.status_history
      : Array.isArray(row.statusHistory)
        ? row.statusHistory
        : [];
    // Mantem a ordem registrada, valida datas e a transicao final.
    const events = history.map((e) => ({
      status: String(e?.status ?? '')
        .trim()
        .toLowerCase(),
      entered: parseDate(e?.enteredAt ?? e?.entered_at ?? e?.timestamp ?? e?.changedAt ?? e?.date),
      exited: parseDate(e?.exitedAt ?? e?.exited_at),
    }));
    const completedEvents = events.filter((e) => doneStatuses.has(e.status));
    if (!completedEvents.length) {
      counts.uncertain++;
      continue;
    }
    if (completedEvents.length > 1) counts.conflictingHistory++;
    const last = events.at(-1);
    const datesValid = events.every(
      (e, i) =>
        e.entered &&
        (!e.exited || e.exited >= e.entered) &&
        (i === 0 || e.entered >= events[i - 1].entered)
    );
    const timelineValid = events.every(
      (e, i) =>
        i === events.length - 1 ||
        !e.exited ||
        e.exited.getTime() === events[i + 1].entered.getTime()
    );
    if (!datesValid || !timelineValid || !last || !doneStatuses.has(last.status) || last.exited) {
      review.push({
        id: snap.id,
        completionEvents: completedEvents.length,
        reason: 'inconsistent_status_history',
      });
      continue;
    }
    // Uma reabertura seguida de nova conclusao valida a ultima entrada em done.
    candidates.push({ id: snap.id, completed: last.entered, updateTime: snap.updateTime });
  }
  cursor = page.docs.at(-1);
}
counts.candidates = candidates.length;
counts.reviewRequired = review.length;
counts.review = review;
if (apply && strict && review.length)
  throw new Error('Backfill bloqueado: existe historico ambiguo; revise primeiro.');
if (apply) {
  for (const item of candidates) {
    const ref = db.collection('tasks').doc(item.id);
    try {
      // Precondição otimista: não sobrescrever se outro usuário editou a tarefa desde a leitura.
      await ref.update(
        { completed_at: Timestamp.fromDate(item.completed) },
        { lastUpdateTime: item.updateTime }
      );
      counts.modified++;
    } catch (error) {
      const code = error?.code;
      if (code === 5 || code === 'not-found') counts.skippedMissing++;
      else if (code === 9 || code === 'failed-precondition') counts.skippedConcurrentChange++;
      else throw error;
    }
  }
}
console.log(JSON.stringify(counts, null, 2));
if (!apply)
  console.log('PRÉVIA: nenhuma alteração realizada. Faça backup do Firestore antes de --apply.');
else
  console.log(
    'Aplicação concluída. Execute novamente a auditoria somente leitura e confira os números.'
  );
if (
  counts.uncertain ||
  counts.reviewRequired ||
  counts.skippedConcurrentChange ||
  counts.skippedMissing
)
  process.exitCode = 2;
