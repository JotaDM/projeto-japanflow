
import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = 'japanflow-erp';
const apply = process.argv.includes('--apply');

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT === 'demo-japanflow-qa') {
  throw new Error('Ambiente inesperado. Confira o projeto antes de continuar.');
}

initializeApp({
  projectId,
  credential: applicationDefault(),
});

const db = getFirestore();

const [usersSnapshot, groupsSnapshot] = await Promise.all([
  db.collection('users').get(),
  db.collection('custom_groups').get(),
]);

const users = usersSnapshot.docs.map((doc) => ({
  id: doc.id,
  username: String(doc.data().username || '').trim(),
}));

const normalize = (value) => String(value || '').trim().toLowerCase();

function resolveUser(value) {
  const input = String(value || '').trim();
  const matches = users.filter(
    (user) =>
      user.id === input ||
      (user.username && normalize(user.username) === normalize(input))
  );

  const ids = [...new Set(matches.map((user) => user.id))];
  return ids.length === 1 ? ids[0] : null;
}

const changes = [];
const problems = [];
const backup = [];

for (const doc of groupsSnapshot.docs) {
  const data = doc.data();

  backup.push({ id: doc.id, data });

  const participants = Array.isArray(data.participants)
    ? data.participants
    : [];

  const existingIds = Array.isArray(data.participant_ids)
    ? data.participant_ids
    : [];

  const creatorId = resolveUser(data.created_by);
  const resolved = participants.map(resolveUser);
  const unresolved = participants.filter((_, i) => !resolved[i]);

  if (!creatorId || unresolved.length) {
    problems.push({
      groupId: doc.id,
      name: data.name || '',
      creatorResolved: Boolean(creatorId),
      unresolved,
    });
    continue;
  }

  const participantIds = [...new Set([...resolved, creatorId])].sort();

  if (
    JSON.stringify([...existingIds].sort()) !==
    JSON.stringify(participantIds)
  ) {
    changes.push({
      id: doc.id,
      name: data.name || '',
      participantIds,
    });
  }
}

const backupDir = path.resolve('local-backups');
fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(
  backupDir,
  `custom-groups-${timestamp}.json`
);

fs.writeFileSync(
  backupFile,
  JSON.stringify({
    projectId,
    createdAt: new Date().toISOString(),
    groups: backup,
    changes,
    problems,
  }, null, 2)
);

console.log('\n=== GROUPS MIGRATION ===');
console.log('Projeto:', projectId);
console.log('Grupos:', groupsSnapshot.size);
console.log('Precisam atualizar:', changes.length);
console.log('Problemas encontrados:', problems.length);
console.log('Backup:', backupFile);

for (const item of problems) {
  console.warn('REVISAR:', JSON.stringify(item));
}

if (!apply) {
  console.log('\nDRY RUN: nenhum documento foi alterado.');
  process.exit(0);
}

if (problems.length) {
  throw new Error('Migração bloqueada: existem participantes não resolvidos.');
}

if (process.env.CONFIRM_JAPANFLOW_MIGRATION !== projectId) {
  throw new Error('Confirmação explícita do projeto ausente.');
}

for (let i = 0; i < changes.length; i += 400) {
  const batch = db.batch();

  for (const group of changes.slice(i, i + 400)) {
    batch.update(db.collection('custom_groups').doc(group.id), {
      participant_ids: group.participantIds,
      updated_at: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
}

console.log(`MIGRAÇÃO CONCLUÍDA: ${changes.length} grupo(s) atualizado(s).`);