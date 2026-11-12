# Remove restos de uma instalacao de TESTE do AGENTE COSTALOG neste computador.
# Use somente no PC da TI durante os testes. Precisa ser executado como administrador.
#requires -RunAsAdministrator
$ErrorActionPreference = "Continue"

Write-Host "Removendo instalacao de teste do AGENTE COSTALOG..." -ForegroundColor Cyan
& sc.exe stop CostalogAgent 2>$null | Out-Null
Start-Sleep -Seconds 2
& sc.exe delete CostalogAgent 2>$null | Out-Null

$paths = @(
    (Join-Path $env:ProgramFiles "Costalog\Agent"),
    (Join-Path $env:ProgramData "Costalog\Agent")
)
foreach ($path in $paths) {
    if (Test-Path $path) {
        & icacls.exe $path /grant "*S-1-5-32-544:(OI)(CI)F" /t /c /q 2>$null | Out-Null
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$left = $paths | Where-Object { Test-Path $_ }
$svc = Get-Service CostalogAgent -ErrorAction SilentlyContinue
if ($left -or $svc) {
    Write-Host "Nao foi possivel remover tudo:" -ForegroundColor Red
    $left
    if ($svc) { "Servico CostalogAgent ainda registrado" }
} else {
    Write-Host "Limpeza concluida. Pode instalar novamente." -ForegroundColor Green
}
Read-Host "Pressione Enter para fechar"
