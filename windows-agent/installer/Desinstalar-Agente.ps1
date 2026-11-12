# Desinstala o AGENTE COSTALOG deste computador com a senha de desinstalacao definida no painel.
# A senha e conferida pelo servidor; sem ela (ou sem a ordem do painel) o agente nao pode ser removido.
$ErrorActionPreference = "Stop"
$root = Join-Path $env:ProgramData "Costalog"
$requests = Join-Path $root "Agent\Requests"
$result = Join-Path $root "uninstall-result.json"

Write-Host "=============================================="
Write-Host "      DESINSTALAR - AGENTE COSTALOG"
Write-Host "=============================================="
Write-Host ""

if (-not (Get-Service CostalogAgent -ErrorAction SilentlyContinue)) {
    Write-Host "O AGENTE COSTALOG nao esta instalado neste computador." -ForegroundColor Yellow
    Read-Host "Pressione Enter para fechar"
    exit
}
if (-not (Test-Path $requests)) {
    Write-Host "O agente instalado ainda nao recebeu a versao com desinstalacao por senha." -ForegroundColor Yellow
    Write-Host "Aguarde a atualizacao automatica ou use 'Desinstalar agente' no painel."
    Read-Host "Pressione Enter para fechar"
    exit
}

$secure = Read-Host "Senha de desinstalacao (definida pela TI no painel)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

Remove-Item $result -Force -ErrorAction SilentlyContinue
$request = [ordered]@{ password = $plain; requestedBy = "$env:USERDOMAIN\$env:USERNAME" } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $requests "uninstall-request.json"), $request, (New-Object Text.UTF8Encoding $false))
$plain = $null

Write-Host ""
Write-Host "Conferindo a senha com o servidor..." -ForegroundColor Cyan
for ($i = 0; $i -lt 60 -and -not (Test-Path $result); $i++) { Start-Sleep -Seconds 1 }

if (-not (Test-Path $result)) {
    Write-Host "O agente nao respondeu. Verifique se o computador esta conectado ao servidor e tente de novo." -ForegroundColor Red
} else {
    $answer = Get-Content $result -Raw | ConvertFrom-Json
    Remove-Item $result -Force -ErrorAction SilentlyContinue
    if ($answer.status -eq "ok") { Write-Host $answer.message -ForegroundColor Green; Write-Host "A remocao termina sozinha em alguns segundos." }
    else { Write-Host $answer.message -ForegroundColor Red }
}
Write-Host ""
Read-Host "Pressione Enter para fechar"
