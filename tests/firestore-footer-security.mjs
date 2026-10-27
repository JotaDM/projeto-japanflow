import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-japanflow-qa';
const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const [emulatorHost, emulatorPort] = host.split(':');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({
  projectId,
  firestore: { host: emulatorHost, port: Number(emulatorPort), rules },
});
const cases = [];
async function check(name, test) {
  try {
    await test();
    cases.push(true);
    console.log(`PASSOU: ${name}`);
  } catch (err) {
    cases.push(false);
    console.error(`FALHOU: ${name}: ${err.message}`);
  }
}
try {
  // IDs específicos para não colidir com outros testes do emulador.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, userId, username, role, active] of [
      ['footer-admin', 'footer-admin-user', 'gestor', 'admin', true],
      ['footer-gas', 'footer-gas-user', 'ryan', 'employee', true],
      ['footer-employee', 'footer-employee-user', 'funcionario', 'employee', true],
      ['footer-inactive', 'footer-inactive-user', 'inativo', 'employee', false],
    ]) {
      await setDoc(doc(db, 'auth_links', uid), { user_id: userId, role, active });
      await setDoc(doc(db, 'users', userId), { username, active, sectors: [] });
    }
    await setDoc(doc(db, 'app_settings', 'system_footer'), {
      message: 'Rodapé de teste',
      updated_at: new Date(),
    });
    await setDoc(doc(db, 'app_settings', 'unrelated_footer_security_test'), { value: 'mantido' });
  });
  const firestore = (uid) => env.authenticatedContext(uid).firestore();
  const footer = (db) => doc(db, 'app_settings', 'system_footer');
  await check('Funcionário ativo lê rodapé', () =>
    assertSucceeds(getDoc(footer(firestore('footer-employee'))))
  );
  await check('Usuário da GAS lê rodapé', () =>
    assertSucceeds(getDoc(footer(firestore('footer-gas'))))
  );
  await check('Anônimo não lê rodapé', () =>
    assertFails(getDoc(footer(env.unauthenticatedContext().firestore())))
  );
  await check('Inativo não lê rodapé', () =>
    assertFails(getDoc(footer(firestore('footer-inactive'))))
  );
  await check('Usuário GAS autorizado edita frase', () =>
    assertSucceeds(
      updateDoc(footer(firestore('footer-gas')), {
        message: 'Novo comunicado no rodapé',
        updated_at: serverTimestamp(),
      })
    )
  );
  await check('Funcionário comum não altera rodapé', () =>
    assertFails(
      updateDoc(footer(firestore('footer-employee')), {
        message: 'Alteração indevida',
        updated_at: serverTimestamp(),
      })
    )
  );
  await check('Mensagem vazia é bloqueada', () =>
    assertFails(updateDoc(footer(firestore('footer-gas')), { message: '' }))
  );
  await check('Mensagem maior que 180 caracteres é bloqueada', () =>
    assertFails(updateDoc(footer(firestore('footer-gas')), { message: 'a'.repeat(181) }))
  );
  await check('Campos extras são bloqueados', () =>
    assertFails(updateDoc(footer(firestore('footer-gas')), { intruder: true }))
  );
  await check('Exclusão do rodapé é bloqueada', () =>
    assertFails(deleteDoc(footer(firestore('footer-admin'))))
  );
  await check('Usuário comum não edita outras configurações', () =>
    assertFails(
      updateDoc(
        doc(firestore('footer-employee'), 'app_settings', 'unrelated_footer_security_test'),
        { value: 'alterado' }
      )
    )
  );
  const passed = cases.filter(Boolean).length;
  console.log(`\nRESULTADO: ${passed} passaram, ${cases.length - passed} falharam`);
  if (passed !== cases.length) process.exitCode = 1;
} finally {
  await env.cleanup();
}
