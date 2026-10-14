import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

const env = await initializeTestEnvironment({
  projectId: 'demo-japanflow-qa',
  firestore: { host: '127.0.0.1', port: 8085, rules: fs.readFileSync('firestore.rules', 'utf8') },
  storage: { host: '127.0.0.1', port: 9199, rules: fs.readFileSync('storage.rules', 'utf8') },
});

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('PASSOU:', name);
  } catch (error) {
    failed++;
    console.error('FALHOU:', name, error.message);
  }
}

try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, id, username, active] of [
      ['alice-uid', 'alice', 'aliceuser', true],
      ['bob-uid', 'bob', 'bobuser', true],
      ['outsider-uid', 'outsider', 'outsideruser', true],
      ['inactive-uid', 'inactive', 'inactiveuser', false],
    ]) {
      await db.doc(`auth_links/${uid}`).set({ user_id: id, role: 'employee', active });
      await db.doc(`users/${id}`).set({ username, active, sectors: [] });
    }
    await db.doc('custom_groups/g1').set({
      name: 'Grupo QA',
      created_by: 'alice',
      participants: ['alice', 'bob'],
      participant_ids: ['alice', 'bob', 'inactive'],
      created_at: new Date(),
    });
    await db.doc('group_messages/m1').set({
      group_id: 'g1',
      sender_id: 'alice',
      sender_username: 'aliceuser',
      content: 'Olá',
      edited: false,
      deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  const alice = env.authenticatedContext('alice-uid');
  const bob = env.authenticatedContext('bob-uid');
  const outsider = env.authenticatedContext('outsider-uid');
  const inactive = env.authenticatedContext('inactive-uid');
  const anon = env.unauthenticatedContext();
  const g = 'custom_groups/g1';
  const m = 'group_messages/m1';

  await test('Membro lê grupo', () => assertSucceeds(bob.firestore().doc(g).get()));
  await test('Externo não lê grupo', () => assertFails(outsider.firestore().doc(g).get()));
  await test('Inativo não lê grupo', () => assertFails(inactive.firestore().doc(g).get()));
  await test('Anônimo não lê grupo', () => assertFails(anon.firestore().doc(g).get()));
  await test('Membro lista seus grupos com array-contains', () =>
    assertSucceeds(
      bob
        .firestore()
        .collection('custom_groups')
        .where('participant_ids', 'array-contains', 'bob')
        .get()
    ));
  await test('Externo não lista todos os grupos', () =>
    assertFails(outsider.firestore().collection('custom_groups').get()));
  await test('Membro lê mensagem', () => assertSucceeds(bob.firestore().doc(m).get()));
  await test('Externo não lê mensagem', () => assertFails(outsider.firestore().doc(m).get()));
  await test('Inativo não lê mensagem', () => assertFails(inactive.firestore().doc(m).get()));
  await test('Membro consulta mensagens do grupo', () =>
    assertSucceeds(
      bob.firestore().collection('group_messages').where('group_id', '==', 'g1').limit(100).get()
    ));
  await test('Externo não consulta mensagens do grupo', () =>
    assertFails(
      outsider
        .firestore()
        .collection('group_messages')
        .where('group_id', '==', 'g1')
        .limit(100)
        .get()
    ));
  await test('Membro pode enviar mensagem autenticada', () =>
    assertSucceeds(
      bob.firestore().collection('group_messages').add({
        group_id: 'g1',
        sender_id: 'bob',
        sender_username: 'bobuser',
        content: 'Teste',
        edited: false,
        deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
    ));
  await test('Membro não falsifica o remetente', () =>
    assertFails(
      bob.firestore().collection('group_messages').add({
        group_id: 'g1',
        sender_id: 'alice',
        sender_username: 'aliceuser',
        content: 'Fraude',
        edited: false,
        deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
    ));
  await test('Externo não envia mensagem', () =>
    assertFails(
      outsider.firestore().collection('group_messages').add({
        group_id: 'g1',
        sender_id: 'outsider',
        sender_username: 'outsideruser',
        content: 'Fraude',
        edited: false,
        deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
    ));
  await test('Autor edita sua mensagem', () =>
    assertSucceeds(
      alice.firestore().doc(m).update({ content: 'Editada', edited: true, updated_at: new Date() })
    ));
  await test('Outro membro não edita mensagem alheia', () =>
    assertFails(
      bob.firestore().doc(m).update({ content: 'Invadida', edited: true, updated_at: new Date() })
    ));
  await test('Criador não pode ser falsificado na criação de grupo', () =>
    assertFails(
      bob
        .firestore()
        .collection('custom_groups')
        .add({
          name: 'Fraude',
          created_by: 'alice',
          participant_ids: ['alice', 'bob'],
          participants: ['alice', 'bob'],
        })
    ));
  await test('Usuário cria grupo próprio', () =>
    assertSucceeds(
      bob
        .firestore()
        .collection('custom_groups')
        .add({
          name: 'Novo grupo',
          created_by: 'bob',
          participant_ids: ['bob', 'alice'],
          participants: ['bob', 'alice'],
        })
    ));
  const filePath = 'attachments/chat/groups/g1/qa.webp';
  await test('Membro envia anexo de grupo', () =>
    assertSucceeds(
      bob
        .storage()
        .ref(filePath)
        .putString('conteúdo de teste', 'raw', { contentType: 'image/webp' })
    ));
  await test('Membro lê anexo de grupo', () =>
    assertSucceeds(alice.storage().ref(filePath).getMetadata()));
  await test('Externo não lê anexo', () =>
    assertFails(outsider.storage().ref(filePath).getMetadata()));
  await test('Inativo não lê anexo', () =>
    assertFails(inactive.storage().ref(filePath).getMetadata()));
  await test('Externo não envia anexo', () =>
    assertFails(
      outsider
        .storage()
        .ref('attachments/chat/groups/g1/forged.webp')
        .putString('não autorizado', 'raw', { contentType: 'image/webp' })
    ));
  console.log(`\nRESULTADO: ${passed} passaram, ${failed} falharam`);
  assert.equal(failed, 0, 'As regras dos grupos precisam de ajustes');
} finally {
  await env.cleanup();
}
