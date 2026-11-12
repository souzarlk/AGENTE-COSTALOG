# Atualiza o AGENTE COSTALOG ja instalado NESTE computador com o pacote de teste gerado
# por Build-TestPackage.ps1, mantendo o cadastro (mesmo computador no painel).
# Precisa ser executado como administrador. Substituto temporario da atualizacao automatica.
#requires -RunAsAdministrator
param(
    [string]$PackageDirectory = (Join-Path ([Environment]::GetFolderPath("Desktop")) "AGENTE-COSTALOG-teste"),
    [string]$AgentVersion = ""
)
$ErrorActionPreference = "Stop"
if (-not $AgentVersion) { $AgentVersion = (Get-Content (Join-Path $PSScriptRoot "..\agent-version.txt") -Raw).Trim() }
try {
    $source = Join-Path $PackageDirectory "service"
    $target = Join-Path $env:ProgramFiles "Costalog\Agent\Service"
    $config = Join-Path $env:ProgramData "Costalog\Agent\Private\agent.json"

    if (-not (Test-Path (Join-Path $source "Costalog.Agent.Service.exe"))) { throw "Pacote nao encontrado em $source. Gere o pacote primeiro." }
    if (-not (Test-Path $target)) { throw "O agente nao esta instalado neste computador." }

    Write-Host "Parando o servico..." -ForegroundColor Cyan
    Stop-Service CostalogAgent -Force
    Start-Sleep -Seconds 2

    Write-Host "Copiando a nova versao..." -ForegroundColor Cyan
    Copy-Item (Join-Path $source "*") $target -Recurse -Force

    $json = Get-Content $config -Raw | ConvertFrom-Json
    $json.agentVersion = $AgentVersion
    [IO.File]::WriteAllText($config, ($json | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))

    Write-Host "Iniciando o servico..." -ForegroundColor Cyan
    Start-Service CostalogAgent
    Write-Host "Agente atualizado para a versao $AgentVersion." -ForegroundColor Green
}
catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
}
Read-Host "Pressione Enter para fechar"
