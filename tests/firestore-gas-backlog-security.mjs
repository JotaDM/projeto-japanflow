import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
const env = await initializeTestEnvironment({
  projectId: 'demo-japanflow-gas-qa',
  firestore: { host: '127.0.0.1', port: 8085, rules: fs.readFileSync('firestore.rules', 'utf8') },
});
let passed = 0,
  failed = 0;
async function test(name, fn) {
  try {
    await fn();
    ++passed;
    console.log('PASSOU:', name);
  } catch (e) {
    ++failed;
    console.error('FALHOU:', name, e.message);
  }
}
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [name, sectors, active] of [
      ['ryan', [], true],
      ['joe_', [], true],
      ['japan-ti', ['ti'], true],
      ['normal', [], true],
      ['inactive', [], false],
    ]) {
      await db.doc(`users/${name}`).set({ username: name, active, sectors });
      await db.doc(`auth_links/${name}-uid`).set({ user_id: name, role: 'employee', active });
    }
    await db.doc('system_usage_daily/2026-10-22').set({ reads: 100 });
    await db.doc('user_problem_reports/report-other').set({
      user_id: 'normal',
      description: 'Relato de exemplo suficientemente longo',
      status: 'new',
    });
  });
  const db = (name) => env.authenticatedContext(`${name}-uid`).firestore();
  for (const name of ['ryan', 'joe_', 'japan-ti'])
    await test(`${name} pode ler GAS`, () =>
      assertSucceeds(db(name).doc('system_usage_daily/2026-10-22').get()));
  for (const name of ['normal', 'inactive'])
    await test(`${name} bloqueado no GAS`, () =>
      assertFails(db(name).doc('system_usage_daily/2026-10-22').get()));
  await test('anônimo bloqueado no GAS', () =>
    assertFails(
      env.unauthenticatedContext().firestore().doc('system_usage_daily/2026-10-22').get()
    ));
  await test('joe_ nao pode ler backlog alheio', () =>
    assertFails(db('joe_').doc('user_problem_reports/report-other').get()));
  await test('ryan pode ler backlog', () =>
    assertSucceeds(db('ryan').doc('user_problem_reports/report-other').get()));
  await test('japan-ti pode ler backlog', () =>
    assertSucceeds(db('japan-ti').doc('user_problem_reports/report-other').get()));
  await test('normal pode ler proprio relato', () =>
    assertSucceeds(db('normal').doc('user_problem_reports/report-other').get()));
  await test('normal nao pode ler metrica GAS', () =>
    assertFails(db('normal').doc('system_usage_daily/2026-10-22').get()));
} finally {
  await env.cleanup();
}
console.log(`GAS/BACKLOG: ${passed} passaram, ${failed} falharam`);
if (failed) process.exitCode = 1;
