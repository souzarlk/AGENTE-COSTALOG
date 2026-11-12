# Publica uma nova versao do AGENTE COSTALOG para atualizacao automatica.
# 1) Aumente o numero em windows-agent\agent-version.txt (ex.: 0.3.0 -> 0.3.1)
# 2) Rode: powershell -ExecutionPolicy Bypass -File windows-agent\installer\Publish-AgentRelease.ps1
# A API passa a oferecer a versao nova e os computadores instalados se atualizam sozinhos.
[CmdletBinding()]
param([string]$Version = "")

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (-not $Version) { $Version = (Get-Content (Join-Path $repo "windows-agent\agent-version.txt") -Raw).Trim() }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Versao invalida: $Version" }
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw "O .NET 8 SDK nao esta instalado." }

$releases = Join-Path $repo "server\agent-releases"
$zip = Join-Path $releases "costalog-agent-$Version.zip"
if (Test-Path $zip) { throw "A versao $Version ja foi publicada. Aumente o numero em windows-agent\agent-version.txt." }
New-Item -ItemType Directory -Force -Path $releases | Out-Null

$tmp = Join-Path $env:TEMP ("costalog-release-" + [guid]::NewGuid().ToString("N"))
Write-Host "Compilando o agente $Version..." -ForegroundColor Cyan
dotnet publish (Join-Path $repo "windows-agent\Costalog.Agent.Service\Costalog.Agent.Service.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o $tmp --nologo -v q
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o agente." }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $zip)
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Versao $Version publicada: $zip" -ForegroundColor Green
Write-Host "Os computadores instalados se atualizam sozinhos em ate ~5 minutos."
