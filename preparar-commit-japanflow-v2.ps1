param([switch]$Commit)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$env:GIT_PAGER = 'cat'
$env:GIT_TERMINAL_PROMPT = '0'

$root = (& git rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0 -or -not $root) { throw 'Repositorio Git nao encontrado.' }
Set-Location $root.Trim()
$branch = (& git branch --show-current).Trim()
if (-not $branch) { throw 'Branch nao identificada.' }
Write-Host "Branch: $branch" -ForegroundColor Cyan

# Evita o diff completo do repositorio (pode demorar muito no Windows).
# Inclui fontes e configuracoes, excluindo artefatos e credenciais.
$paths = @(
    '.',
    ':(exclude,glob)**/.env', ':(exclude,glob)**/.env.*',
    ':(exclude,glob)**/*service*account*.json',
    ':(exclude,glob)**/*credential*.json',
    ':(exclude,glob)**/*.pem', ':(exclude,glob)**/*.key',
    ':(exclude,glob)**/node_modules/**', ':(exclude,glob)**/dist/**',
    ':(exclude,glob)**/qa-report/**', ':(exclude,glob)**/test-results/**',
    ':(exclude,glob)**/coverage/**', ':(exclude,glob)**/backups/**',
    ':(exclude,glob)**/*.zip', ':(exclude,glob)**/*.log',
    ':(exclude,glob)**/*.sqlite', ':(exclude,glob)**/*.db',
    ':(exclude,glob)**/*.bak'
)
Write-Host 'Preparando arquivos (sem arquivos sensiveis)...' -ForegroundColor Cyan
& git -c core.safecrlf=false add -A -- @paths
if ($LASTEXITCODE -ne 0) { throw 'Falha no git add.' }

$staged = @(& git diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { throw 'Falha ao listar arquivos preparados.' }
$unsafe = @($staged | Where-Object {
    $_ -match '(?i)(^|/|\\)\.env($|\.)|service.?account|credential|\.pem$|\.key$|\.zip$|(^|/|\\)backups(/|\\)|\.log$|\.db$|\.sqlite$'
})
if ($unsafe.Count -gt 0) {
    & git reset --quiet -- @unsafe
    throw ('Arquivos suspeitos retirados do stage: ' + ($unsafe -join ', '))
}

Write-Host "Arquivos preparados: $($staged.Count)" -ForegroundColor Green
& git --no-pager diff --cached --stat
if ($LASTEXITCODE -ne 0) { throw 'Falha ao mostrar resumo do stage.' }

if (-not $Commit) {
    Write-Host 'Revisao pronta. Nenhum commit criado.' -ForegroundColor Yellow
    Write-Host 'Para commitar: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\preparar-commit-japanflow-v2.ps1 -Commit'
    exit 0
}
if ($staged.Count -eq 0) { Write-Host 'Nao ha alteracoes para commitar.'; exit 0 }
& git -c core.safecrlf=false commit -m 'feat: otimiza consultas Firestore e historico de tarefas'
if ($LASTEXITCODE -ne 0) { throw 'Falha no commit.' }
Write-Host 'Commit criado. Confira git status e rode git push -u origin HEAD.' -ForegroundColor Green
