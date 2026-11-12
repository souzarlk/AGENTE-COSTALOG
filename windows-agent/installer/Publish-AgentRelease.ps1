# Publica uma nova versao do AGENTE COSTALOG.
# 1) Aumente o numero em windows-agent\agent-version.txt (ex.: 0.4.2 -> 0.4.3)
# 2) Rode: powershell -ExecutionPolicy Bypass -File windows-agent\installer\Publish-AgentRelease.ps1
# Gera em server\agent-releases:
#  - costalog-agent-X.Y.Z.zip     -> atualizacao automatica dos computadores ja instalados
#  - costalog-installer-X.Y.Z.zip -> instalador completo, baixado pelo painel (Download do agente)
# O endereco da API gravado no instalador vem de PUBLIC_API_URL no server\.env
# (padrao: http://localhost:8080, que so funciona no proprio PC da API).
[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$ApiBaseUrl = ""
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (-not $Version) { $Version = (Get-Content (Join-Path $repo "windows-agent\agent-version.txt") -Raw).Trim() }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Versao invalida: $Version" }
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw "O .NET 8 SDK nao esta instalado." }

if (-not $ApiBaseUrl) {
    $envFile = Join-Path $repo "server\.env"
    if (Test-Path $envFile) {
        $line = Select-String -Path $envFile -Pattern '^\s*PUBLIC_API_URL\s*=\s*(.+?)\s*$' | Select-Object -First 1
        if ($line) { $ApiBaseUrl = $line.Matches[0].Groups[1].Value.Trim('"').Trim("'") }
    }
}
if (-not $ApiBaseUrl) { $ApiBaseUrl = "http://localhost:8080" }
$ApiBaseUrl = $ApiBaseUrl.Trim().TrimEnd("/")

$publicKey = Join-Path $repo "server\policy-public.pem"
if (-not (Test-Path $publicKey)) { throw "Chave publica nao encontrada: $publicKey" }

$releases = Join-Path $repo "server\agent-releases"
$updateZip = Join-Path $releases "costalog-agent-$Version.zip"
$installerZip = Join-Path $releases "costalog-installer-$Version.zip"
if ((Test-Path $updateZip) -or (Test-Path $installerZip)) { throw "A versao $Version ja foi publicada. Aumente o numero em windows-agent\agent-version.txt." }
New-Item -ItemType Directory -Force -Path $releases | Out-Null

$work = Join-Path $env:TEMP ("costalog-release-" + [guid]::NewGuid().ToString("N"))
$serviceOut = Join-Path $work "service"
$setupOut = Join-Path $work "setup"
$package = Join-Path $work "package"

try {
    Write-Host "1/3 Compilando o servico $Version..." -ForegroundColor Cyan
    dotnet publish (Join-Path $repo "windows-agent\Costalog.Agent.Service\Costalog.Agent.Service.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o $serviceOut --nologo -v q
    if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o servico." }

    Write-Host "2/3 Compilando o instalador..." -ForegroundColor Cyan
    dotnet publish (Join-Path $repo "windows-agent\Costalog.Agent.Setup\Costalog.Agent.Setup.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $setupOut --nologo -v q
    if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o instalador." }

    Write-Host "3/3 Montando os pacotes..." -ForegroundColor Cyan
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    # Pacote de atualizacao automatica (somente os arquivos do servico)
    [System.IO.Compression.ZipFile]::CreateFromDirectory($serviceOut, $updateZip)

    # Instalador completo
    New-Item -ItemType Directory -Force -Path $package | Out-Null
    Copy-Item $serviceOut (Join-Path $package "service") -Recurse
    Copy-Item (Join-Path $setupOut "Costalog.Agent.Setup.exe") $package
    Copy-Item $publicKey $package
    $utf8 = New-Object Text.UTF8Encoding $false
    $bootstrap = [ordered]@{ apiBaseUrl = $ApiBaseUrl; installMode = "certificate-and-web"; agentVersion = $Version } | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $package "agent-bootstrap.json"), $bootstrap, $utf8)
    $launcher = @'
@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
"%~dp0Costalog.Agent.Setup.exe"
echo.
pause
'@
    [IO.File]::WriteAllText((Join-Path $package "INSTALAR.cmd"), $launcher, $utf8)
    $readme = @"
AGENTE COSTALOG $Version - instalacao

1. Extraia este arquivo .zip em uma pasta do computador.
2. De dois cliques em INSTALAR.cmd e aceite o aviso de administrador.
3. Digite a senha de instalacao criada pela TI no painel (Configuracoes agente).
4. Em cerca de 1 minuto o computador aparece no painel, em Computadores.

O agente roda em segundo plano e se atualiza sozinho.
API configurada neste instalador: $ApiBaseUrl
"@
    [IO.File]::WriteAllText((Join-Path $package "LEIA-ME.txt"), $readme, $utf8)
    [System.IO.Compression.ZipFile]::CreateFromDirectory($package, $installerZip)
    $info = [ordered]@{ version = $Version; apiBaseUrl = $ApiBaseUrl; createdAt = (Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json
    [IO.File]::WriteAllText(($installerZip -replace '\.zip$', '.json'), $info, $utf8)
}
finally {
    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Versao $Version publicada." -ForegroundColor Green
Write-Host " - Atualizacao automatica: $updateZip"
Write-Host " - Instalador para o painel: $installerZip (API: $ApiBaseUrl)"
Write-Host "Os computadores instalados se atualizam sozinhos em ate ~5 minutos."
