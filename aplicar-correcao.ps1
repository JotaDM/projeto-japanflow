$ErrorActionPreference = 'Stop'
$path = 'src/components/AppLayout.tsx'
if (-not (Test-Path $path)) { throw "Execute na raiz do projeto: arquivo nao encontrado: $path" }
$content = [System.IO.File]::ReadAllText((Resolve-Path $path))
$anchor = "import LoginSplash from '@/components/LoginSplash';"
$addition = "import SystemFooter from '@/components/SystemFooter';"
if ($content.Contains($addition)) {
  Write-Host 'Import ja existe. Nenhuma alteracao feita.' -ForegroundColor Yellow
  exit 0
}
if (-not $content.Contains($anchor)) { throw 'Estrutura diferente da base conferida. Nenhum arquivo foi alterado.' }
if (-not (Test-Path 'src/components/SystemFooter.tsx')) { throw 'SystemFooter.tsx nao existe na pasta components; nenhum arquivo foi alterado.' }
$content = $content.Replace($anchor, "$anchor`n$addition")
[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Import de SystemFooter corrigido em AppLayout.tsx.' -ForegroundColor Green
