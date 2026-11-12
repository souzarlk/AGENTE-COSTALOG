# Gera um pacote de TESTE do AGENTE COSTALOG para instalar somente neste computador.
# Requisitos: .NET 8 SDK instalado e a API rodando neste PC (http://localhost:8080).
# Uso (na pasta do projeto): powershell -ExecutionPolicy Bypass -File windows-agent\installer\Build-TestPackage.ps1
[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:8080",
    [ValidateSet("certificate", "certificate-and-web")]
    [string]$InstallMode = "certificate-and-web",
    [string]$AgentVersion = "0.2.2",
    [string]$OutputDirectory = (Join-Path ([Environment]::GetFolderPath("Desktop")) "AGENTE-COSTALOG-teste")
)

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$publicKey = Join-Path $repo "server\policy-public.pem"
$serviceProject = Join-Path $repo "windows-agent\Costalog.Agent.Service\Costalog.Agent.Service.csproj"
$setupProject = Join-Path $repo "windows-agent\Costalog.Agent.Setup\Costalog.Agent.Setup.csproj"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "O .NET 8 SDK nao esta instalado. Baixe em https://dotnet.microsoft.com/download/dotnet/8.0"
}
if (-not (Test-Path $publicKey)) {
    throw "Chave publica nao encontrada: $publicKey"
}

if (Test-Path $OutputDirectory) {
    Remove-Item $OutputDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null

Write-Host "1/3 Compilando o servico do agente..." -ForegroundColor Cyan
dotnet publish $serviceProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o (Join-Path $OutputDirectory "service") --nologo -v q
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o servico do agente." }

Write-Host "2/3 Compilando o instalador..." -ForegroundColor Cyan
$setupOut = Join-Path $env:TEMP ("costalog-setup-" + [guid]::NewGuid().ToString("N"))
dotnet publish $setupProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $setupOut --nologo -v q
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o instalador." }
Copy-Item (Join-Path $setupOut "Costalog.Agent.Setup.exe") $OutputDirectory
Remove-Item $setupOut -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "3/3 Montando o pacote..." -ForegroundColor Cyan
Copy-Item $publicKey $OutputDirectory

$bootstrap = [ordered]@{
    apiBaseUrl   = $ApiBaseUrl.Trim().TrimEnd("/")
    installMode  = $InstallMode
    agentVersion = $AgentVersion
} | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $OutputDirectory "agent-bootstrap.json"), $bootstrap, (New-Object Text.UTF8Encoding $false))

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
[IO.File]::WriteAllText((Join-Path $OutputDirectory "INSTALAR.cmd"), $launcher, (New-Object Text.UTF8Encoding $false))

Write-Host ""
Write-Host "Pacote de teste criado em: $OutputDirectory" -ForegroundColor Green
Write-Host "API configurada: $ApiBaseUrl"
Write-Host "Para instalar: de dois cliques em INSTALAR.cmd e digite a senha temporaria criada no painel."
