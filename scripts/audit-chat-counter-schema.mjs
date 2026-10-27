// Somente emulador, sem escritas. Não extrapolar esta amostra para produção.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;

const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!host || !project?.startsWith('demo-'))
  throw new Error('Execute apenas em projeto demo com FIRESTORE_EMULATOR_HOST definido');
initializeApp({ projectId: project });

const db = getFirestore();

const [privateDocs, groups] = await Promise.all([
  db.collection('messages').get(),
  db.collection('group_messages').get(),
]);

const report = {
  project,
  private: { total: 0, missingRead: 0, missingDeleted: 0 },
  groups: { total: 0, missingSenderId: 0, missingDeleted: 0, invalidCreatedAt: 0 },
};
privateDocs.forEach((doc) => {
  const d = doc.data();
  report.private.total++;
  if (typeof d.read !== 'boolean') report.private.missingRead++;
  if (typeof d.deleted !== 'boolean') report.private.missingDeleted++;
});
groups.forEach((doc) => {
  const d = doc.data();
  report.groups.total++;
  if (!d.sender_id) report.groups.missingSenderId++;
  if (typeof d.deleted !== 'boolean') report.groups.missingDeleted++;
  if (!d.created_at?.toDate) report.groups.invalidCreatedAt++;
});
console.log(JSON.stringify(report, null, 2));
if (
  report.private.missingRead ||
  report.private.missingDeleted ||
  report.groups.missingSenderId ||
  report.groups.missingDeleted ||
  report.groups.invalidCreatedAt
)
  process.exitCode = 2;
