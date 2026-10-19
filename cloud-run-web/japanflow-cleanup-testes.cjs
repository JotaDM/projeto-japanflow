/* Limpeza de dados operacionais de teste do JapanFlow.
   Executar dentro de cloud-run-web: node japanflow-cleanup-testes.cjs --delete
   Requer Application Default Credentials para o projeto japanflow-erp.
*/
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT = 'japanflow-erp';
const COLLECTIONS = ['messages', 'group_messages', 'tasks', 'task_comments', 'notifications'];
const EXCLUDED_EMULATOR = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'];
if (EXCLUDED_EMULATOR.some((k) => process.env[k])) {
  console.error(
    'ERRO: variáveis de emulador encontradas. Feche esse terminal e abra outro sem emuladores.'
  );
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore();

function serialize(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value && typeof value.toDate === 'function')
    return { __type: 'Timestamp', iso: value.toDate().toISOString() };
  if (value && typeof value.latitude === 'number' && typeof value.longitude === 'number')
    return { __type: 'GeoPoint', latitude: value.latitude, longitude: value.longitude };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array)
    return { __type: 'Bytes', base64: Buffer.from(value).toString('base64') };
  if (value && typeof value.path === 'string' && value.firestore)
    return { __type: 'DocumentReference', path: value.path };
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
}
async function main() {
  console.log('Projeto Firebase:', PROJECT);
  console.log('Coleções de testes:', COLLECTIONS.join(', '));
  console.log(
    'Preservados: usuários, grupos, permissões, configurações, tokens FCM, assinaturas, despachos e armazenamento de anexos.'
  );
  const all = [];
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    console.log(`${name}: ${snap.size} documentos`);
    for (const d of snap.docs) all.push({ path: d.ref.path, data: serialize(d.data()) });
  }
  if (all.length === 0) {
    console.log('Nenhum documento encontrado nessas coleções.');
    return;
  }
  const dir = path.resolve(process.cwd(), '..', 'backup-limpeza-japanflow');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `backup-testes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(
    file,
    JSON.stringify(
      { project: PROJECT, createdAt: new Date().toISOString(), records: all },
      null,
      2
    ),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 }
  );
  console.log('\nBACKUP LOCAL CRIADO:', file);
  console.log('Total previsto:', all.length);
  if (!process.argv.includes('--delete')) {
    console.log('PRÉVIA APENAS. Para excluir, rode com --delete.');
    return;
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const phrase = await rl.question(
    'Para excluir DEFINITIVAMENTE, digite exatamente LIMPAR TESTES: '
  );
  rl.close();
  if (phrase.trim() !== 'LIMPAR TESTES') {
    console.log('Cancelado. Nada foi apagado.');
    return;
  }
  let deleted = 0;
  for (let i = 0; i < all.length; i += 350) {
    const batch = db.batch();
    for (const record of all.slice(i, i + 350)) batch.delete(db.doc(record.path));
    await batch.commit();
    deleted += Math.min(350, all.length - i);
    console.log(`Excluídos ${deleted}/${all.length}`);
  }
  console.log('\nLimpeza concluída. Backup:', file);
  console.log(
    'ATENÇÃO: arquivos físicos anexados no R2/Storage NÃO foram apagados. Verifique-os separadamente.'
  );
}
main().catch((err) => {
  console.error('FALHA:', err?.message || err);
  process.exitCode = 1;
});
