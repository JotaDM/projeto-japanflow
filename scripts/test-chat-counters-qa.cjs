'use strict';
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (
  project !== 'demo-japanflow-qa' ||
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
)
  throw new Error('BLOQUEADO: configure os emuladores Auth/Firestore e projeto demo-japanflow-qa.');
const base = 'http://127.0.0.1:5001/demo-japanflow-qa/southamerica-east1/getChatUnreadCounts';
async function call(uidEmail, groups, partnerIds) {
  const sign = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uidEmail,
        password: 'Qa14a!Temporary987',
        returnSecureToken: true,
      }),
    }
  );
  const login = await sign.json();
  if (!sign.ok || !login.idToken) throw new Error(`Auth QA: ${JSON.stringify(login)}`);
  const resp = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.idToken}` },
    body: JSON.stringify({ data: { partnerIds, groupIds: groups } }),
  });
  const body = await resp.json();
  return { status: resp.status, body };
}
(async () => {
  const b = await call('qa14a-b@example.test', ['qa14a-group-1', 'qa14a-group-2'], ['qa14a-a']);
  console.log(JSON.stringify(b, null, 2));
  const r = b.body?.result;
  if (
    b.status !== 200 ||
    r?.privateTotal !== 120 ||
    r?.privateByPartner?.['qa14a-a'] !== 120 ||
    r?.groupById?.['qa14a-group-1'] !== 45 ||
    r?.groupById?.['qa14a-group-2'] !== 12
  )
    throw new Error(
      'FALHA: totais da callable divergentes, revise indices e esquema antes de integrar.'
    );
  console.log('PASS: privada 120, grupo1 45, grupo2 12');
  const denied = await call('qa14a-a@example.test', ['qa14a-group-1'], []);
  if (denied.status !== 200) throw new Error('FALHA: contagem do outro usuario');
  console.log('PASS: autenticacao de segundo usuario');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
