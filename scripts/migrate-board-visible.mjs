import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const production = process.argv.includes('--production');
const apply = process.argv.includes('--apply');
if (production) {
  if (project !== 'japanflow-erp' || host || !process.argv.includes('--confirm-production')) throw new Error('Produção exige projeto, confirmação explícita e ausência de emulador');
} else if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !project?.startsWith('demo-')) {
  throw new Error('Execução local exige emulador e projeto demo-*');
}
const app=initializeApp({ projectId: project, ...(production ? { credential: applicationDefault() } : {}) });
const db=getFirestore(app);
const snapshot=await db.collection('tasks').get();
let missing=0, incorrect=0, candidates=0, modified=0;
for (const item of snapshot.docs) {
 const data=item.data();
 const expected= !data.archived_at && !data.archivedAt;
 if (data.board_visible === undefined) missing++;
 else if (data.board_visible !== expected) incorrect++;
 if (data.board_visible !== expected) {
  candidates++;
  if (apply) {
   const changed = await db.runTransaction(async tx => {
    const fresh=await tx.get(item.ref);
    if (!fresh.exists) return false;
    const record=fresh.data();
    const visible=!record.archived_at && !record.archivedAt;
    if (record.board_visible !== visible) { tx.update(item.ref, { board_visible: visible }); return true; }
    return false;
   });
   if (changed) modified++;
  }
 }
}
console.log(JSON.stringify({mode: apply?'APPLY':'PREVIEW',project,scanned:snapshot.size,missing,incorrect,candidates,modified},null,2));
if (production && apply) console.log('CONFIRME nova prévia sem candidatos antes da ativação do listener.');