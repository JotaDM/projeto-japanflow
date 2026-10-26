'use strict';
// DADOS SINTETICOS. Nunca conecta a producao.
const path = require('node:path');
const { createRequire } = require('node:module');
const requireFunctions = createRequire(path.join(process.cwd(), 'functions', 'package.json'));
const { initializeApp, getApps } = requireFunctions('firebase-admin/app');
const { getFirestore, Timestamp } = requireFunctions('firebase-admin/firestore');
const { getAuth } = requireFunctions('firebase-admin/auth');

const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (
  project !== 'demo-japanflow-qa' ||
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
) {
  throw new Error(
    'BLOQUEADO: exige projeto demo-japanflow-qa e Firestore/Auth em 127.0.0.1 nas portas 8085/9099.'
  );
}
if (!getApps().length) initializeApp({ projectId: project });
const db = getFirestore();
const auth = getAuth();
const uidA = 'qa14a-uid-a',
  uidB = 'qa14a-uid-b';
const a = 'qa14a-a',
  b = 'qa14a-b';
const g1 = 'qa14a-group-1',
  g2 = 'qa14a-group-2';
const t0 = Date.UTC(2026, 9, 20, 12, 0, 0);
const stamp = (offset) => Timestamp.fromMillis(t0 + offset * 60000);
async function createUser(uid, email) {
  try {
    await auth.getUser(uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    await auth.createUser({ uid, email, password: 'Qa14a!Temporary987' });
  }
}
async function main() {
  await Promise.all([
    createUser(uidA, 'qa14a-a@example.test'),
    createUser(uidB, 'qa14a-b@example.test'),
  ]);
  const setup = db.batch();
  for (const [uid, id] of [
    [uidA, a],
    [uidB, b],
  ]) {
    setup.set(db.doc(`auth_links/${uid}`), { user_id: id, active: true }, { merge: true });
    setup.set(db.doc(`users/${id}`), { active: true, username: id }, { merge: true });
  }
  for (const gid of [g1, g2])
    setup.set(
      db.doc(`custom_groups/${gid}`),
      { participant_ids: [a, b], title: `QA ${gid}` },
      { merge: true }
    );
  setup.set(
    db.doc(`chat_read_status/${b}__group__${g1}`),
    { user_id: b, group_id: g1, last_read_at: stamp(14), updated_at: stamp(14) },
    { merge: true }
  );
  await setup.commit();
  const docs = [];
  for (let i = 0; i < 150; i++)
    docs.push([
      `messages/qa14a-private-${String(i).padStart(3, '0')}`,
      {
        senderId: a,
        receiverId: b,
        content: `QA privada ${i}`,
        timestamp: stamp(i),
        read: i >= 120,
        deleted: false,
      },
    ]);
  for (let i = 0; i < 60; i++)
    docs.push([
      `group_messages/qa14a-group1-${String(i).padStart(3, '0')}`,
      {
        group_id: g1,
        sender_id: a,
        sender_username: a,
        content: `QA grupo 1 ${i}`,
        created_at: stamp(i),
        updated_at: stamp(i),
        deleted: false,
      },
    ]);
  for (let i = 0; i < 12; i++)
    docs.push([
      `group_messages/qa14a-group2-${String(i).padStart(3, '0')}`,
      {
        group_id: g2,
        sender_id: a,
        sender_username: a,
        content: `QA grupo 2 ${i}`,
        created_at: stamp(100 + i),
        updated_at: stamp(100 + i),
        deleted: false,
      },
    ]);
  for (let i = 0; i < docs.length; i += 350) {
    const batch = db.batch();
    for (const [key, data] of docs.slice(i, i + 350)) batch.set(db.doc(key), data);
    await batch.commit();
  }
  console.log(
    JSON.stringify(
      {
        project,
        seeded: docs.length,
        expectedForB: {
          privateTotal: 120,
          privateByPartner: { [a]: 120 },
          groupById: { [g1]: 45, [g2]: 12 },
        },
      },
      null,
      2
    )
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
