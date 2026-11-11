#requires -RunAsAdministrator
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$programRoot = Join-Path $env:ProgramFiles "Costalog\Agent"
$privateRoot = Join-Path $env:ProgramData "Costalog\Agent\Private"
$approval = Join-Path $privateRoot "uninstall-approval.json"
$serviceExe = Join-Path $programRoot "Costalog.Agent.Service.exe"
$serviceName = "CostalogAgent"
if (-not (Test-Path $approval)) { throw "Não existe aprovação temporária da TI. Solicite autorização pelo painel central." }
if (-not (Test-Path $serviceExe)) { throw "Binário de verificação não encontrado. Remoção cancelada." }
& $serviceExe --verify-uninstall-approval $approval
if ($LASTEXITCODE -ne 0) { throw "A autorização é inválida, expirou ou não pertence a este computador. Remoção cancelada." }
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -ne "Stopped") { Stop-Service -Name $serviceName -Force }
    & sc.exe delete $serviceName | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível remover o serviço Windows." }
}
$shortcut = Join-Path ([Environment]::GetFolderPath("CommonPrograms")) "AGENTE COSTALOG.lnk"
Remove-Item -LiteralPath $shortcut -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $programRoot -Recurse -Force
Remove-Item -LiteralPath $approval -Force -ErrorAction SilentlyContinue
Write-Host "Binários removidos mediante aprovação da TI. O registro do computador permanece no painel central." -ForegroundColor Green
