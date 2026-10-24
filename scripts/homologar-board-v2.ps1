# Executar SOMENTE com o ambiente QA e Firebase Emulators já iniciados.
$ErrorActionPreference = 'Stop'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'
$env:GCLOUD_PROJECT = 'demo-japanflow-qa'
if (!(Test-Path '.env.qa')) { throw 'Arquivo .env.qa não encontrado. NÃO usar produção.' }
$settings = Get-Content '.env.qa' -Raw
if ($settings -notmatch 'VITE_FIREBASE_PROJECT_ID=demo-japanflow-qa' -or $settings -notmatch 'VITE_USE_FIREBASE_EMULATORS=true' -or $settings -notmatch 'VITE_TASKS_BOARD_QUERY_V2=true') {
  throw 'Em .env.qa use demo-japanflow-qa, emuladores e VITE_TASKS_BOARD_QUERY_V2=true. Reinicie o Vite QA.'
}
function Invoke-Checked($name, [scriptblock]$step) {
  Write-Host "==== $name ====" -ForegroundColor Cyan
  & $step
  if ($LASTEXITCODE -ne 0) { throw "Falhou: $name (exit $LASTEXITCODE)" }
}
Invoke-Checked 'Verificação estática' { node scripts/check-board-v2-readiness.mjs }
Invoke-Checked 'Auditoria de escritores' { node scripts/audit-board-writers.mjs }
Invoke-Checked 'Prévia da migração emulador' { node scripts/migrate-board-visible.mjs }
Invoke-Checked 'Teste de consultas no emulador' { node tests/board-v2-emulator.mjs }
Invoke-Checked 'TypeScript' { npx tsc --noEmit }
Invoke-Checked 'Build QA' { npx vite build --mode qa }
Invoke-Checked 'QA funcional' { npx playwright test qa/tests/smoke.spec.ts qa/tests/functional-core.spec.ts --project=desktop-chromium --workers=1 --max-failures=1 }
Invoke-Checked 'Regras Storage/Chat' { npm run test:security }
Invoke-Checked 'Regras GAS e Backlog' { node tests/firestore-gas-backlog-security.mjs }
Write-Host 'Homologação técnica concluída. Validar manualmente histórico, arquivo e restauração antes da produção.' -ForegroundColor Green
