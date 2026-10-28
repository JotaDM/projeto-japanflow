'use strict';
const path = require('node:path'),
  fs = require('node:fs'),
  { spawnSync } = require('node:child_process');
const { PROJECT, HOSTS } = require('./isolation.cjs');
// Does not install missing tools. Once approved/installed, the Firebase CLI
// may download emulator binaries on first use; that needs the same approval.
const cli = path.join(__dirname, 'node_modules/firebase-tools/lib/bin/firebase.js');
if (!fs.existsSync(cli)) {
  console.error('BLOCKED: Firebase CLI local ainda não instalado/autorizado.');
  process.exit(2);
}
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('BLOCKED: este teste exige processo sem credencial de serviço.');
  process.exit(2);
}
const env = {
  ...process.env,
  GCLOUD_PROJECT: PROJECT,
  GOOGLE_CLOUD_PROJECT: PROJECT,
  ...HOSTS,
  CI: 'true',
  FIREBASE_CLI_DISABLE_TELEMETRY: '1',
  XDG_CONFIG_HOME: path.join(__dirname, '.local/config'),
  FIREBASE_EMULATORS_PATH: path.join(__dirname, '.local/emulators'),
};
delete env.FIREBASE_TOKEN;
delete env.GOOGLE_OAUTH_ACCESS_TOKEN;
const repo = path.resolve(__dirname, '../..');
const rules = path.join(__dirname, '.local/rules');
fs.mkdirSync(rules, { recursive: true });
for (const file of ['firestore.rules', 'storage.rules']) {
  fs.copyFileSync(path.join(repo, file), path.join(rules, file));
}
const r = spawnSync(
  process.execPath,
  [
    cli,
    'emulators:exec',
    '--project',
    PROJECT,
    '--config',
    'firebase.json',
    '--only',
    'firestore,storage',
    'node --test emulators.test.mjs',
  ],
  { cwd: __dirname, env, stdio: 'inherit', shell: false }
);
if (r.error) {
  console.error('BLOCKED: não foi possível iniciar os emuladores locais.');
  process.exit(2);
}
process.exitCode = r.status ?? 2;
