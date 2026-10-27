'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { PROJECT, HOSTS, assertLocal } = require('./isolation.cjs');
const valid = () => ({ GCLOUD_PROJECT: PROJECT, GOOGLE_CLOUD_PROJECT: PROJECT, ...HOSTS });
test('aceita somente projeto demo e hosts locais explícitos', () =>
  assert.equal(assertLocal(valid()).projectId, PROJECT));
test('recusa ambiente sem projeto ou emuladores', () => assert.throws(() => assertLocal({})));
test('recusa projeto real mesmo com emuladores', () =>
  assert.throws(() => assertLocal({ ...valid(), GCLOUD_PROJECT: 'production-project' })));
test('recusa host remoto do Firestore', () =>
  assert.throws(() =>
    assertLocal({ ...valid(), FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' })
  ));
test('recusa host remoto do Storage', () =>
  assert.throws(() =>
    assertLocal({ ...valid(), FIREBASE_STORAGE_EMULATOR_HOST: 'storage.googleapis.com:443' })
  ));
test('recusa credencial de serviço sem ler o arquivo', () =>
  assert.throws(() =>
    assertLocal({ ...valid(), GOOGLE_APPLICATION_CREDENTIALS: 'not-read.json' })
  ));
test('recusa endpoint alternativo do SDK Storage', () =>
  assert.throws(() => assertLocal({ ...valid(), STORAGE_EMULATOR_HOST: 'https://example.com' })));
