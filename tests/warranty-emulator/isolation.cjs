'use strict';
const PROJECT = 'demo-japanflow-warranty-local';
const HOSTS = Object.freeze({
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8187',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9297',
});
function assertLocal(env) {
  if (env.GCLOUD_PROJECT !== PROJECT || env.GOOGLE_CLOUD_PROJECT !== PROJECT)
    throw Error('Projeto de teste local obrigatório.');
  for (const [key, value] of Object.entries(HOSTS))
    if (env[key] !== value) throw Error('Host de emulador obrigatório: ' + key);
  if (env.GOOGLE_APPLICATION_CREDENTIALS)
    throw Error('Credenciais de serviço não são permitidas neste teste.');
  if (env.STORAGE_EMULATOR_HOST && env.STORAGE_EMULATOR_HOST !== 'http://127.0.0.1:9297')
    throw Error('Storage deve apontar exclusivamente ao emulador.');
  return {
    projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8187 },
    storage: { host: '127.0.0.1', port: 9297 },
  };
}
module.exports = { PROJECT, HOSTS, assertLocal };
