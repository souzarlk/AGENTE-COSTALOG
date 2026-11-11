#requires -RunAsAdministrator
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$packageRoot = $PSScriptRoot
$programRoot = Join-Path $env:ProgramFiles "Costalog\Agent"
$dataRoot = Join-Path $env:ProgramData "Costalog\Agent"
$privateRoot = Join-Path $dataRoot "Private"
$publicRoot = Join-Path $dataRoot "Public"
$serviceName = "CostalogAgent"
function Invoke-Icacls {
    param([string[]]$Arguments)
    & icacls.exe @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Falha ao configurar permissões NTFS." }
}
if (-not (Test-Path (Join-Path $packageRoot "policy-public.pem"))) { throw "policy-public.pem ausente. Coloque a chave pública da TI na raiz do pacote." }
if (-not (Test-Path (Join-Path $packageRoot "Costalog.Agent.Setup.exe"))) { throw "Costalog.Agent.Setup.exe ausente no pacote." }
if (-not (Test-Path (Join-Path $packageRoot "service\Costalog.Agent.Service.exe"))) { throw "Binário do serviço não encontrado em service\." }
if (-not (Test-Path (Join-Path $packageRoot "desktop\Costalog.Agent.Desktop.exe"))) { throw "Binário WPF não encontrado em desktop\." }
New-Item -ItemType Directory -Force -Path $programRoot, $privateRoot, $publicRoot | Out-Null
Invoke-Icacls @($dataRoot, "/inheritance:r", "/grant:r", "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F", "*S-1-5-32-545:RX", "/T", "/C")
Invoke-Icacls @($privateRoot, "/inheritance:r", "/grant:r", "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F", "/T", "/C")
Invoke-Icacls @($publicRoot, "/inheritance:r", "/grant:r", "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F", "*S-1-5-32-545:(OI)(CI)RX", "/T", "/C")
Copy-Item -Path (Join-Path $packageRoot "service\*") -Destination $programRoot -Recurse -Force
$desktopRoot = Join-Path $programRoot "Desktop"
New-Item -ItemType Directory -Force -Path $desktopRoot | Out-Null
Copy-Item -Path (Join-Path $packageRoot "desktop\*") -Destination $desktopRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $packageRoot "Costalog.Agent.Setup.exe") -Destination $programRoot -Force
Copy-Item -LiteralPath (Join-Path $packageRoot "policy-public.pem") -Destination $programRoot -Force
& (Join-Path $programRoot "Costalog.Agent.Setup.exe")
if ($LASTEXITCODE -ne 0) { throw "O assistente de configuração não concluiu com sucesso." }
$configPath = Join-Path $privateRoot "agent.json"
if (-not (Test-Path $configPath)) { throw "Configuração protegida do agente não foi criada." }
$serviceExe = Join-Path $programRoot "Costalog.Agent.Service.exe"
$binPathArg = 'binPath= "' + $serviceExe + '"'
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -ne "Stopped") { Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue }
    & sc.exe config $serviceName $binPathArg "start= auto" "obj= LocalSystem" | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível atualizar o serviço Windows." }
} else {
    & sc.exe create $serviceName $binPathArg "start= auto" "obj= LocalSystem" "DisplayName= AGENTE COSTALOG - Monitoramento" | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível registrar o serviço Windows." }
}
& sc.exe description $serviceName "Monitoramento e aplicação de políticas corporativas da COSTALOG" | Out-Host
& sc.exe failure $serviceName "reset= 86400" "actions= restart/5000/restart/15000/restart/60000" | Out-Host
Start-Service -Name $serviceName
$shortcutPath = Join-Path ([Environment]::GetFolderPath("CommonPrograms")) "AGENTE COSTALOG.lnk"
$target = Join-Path $desktopRoot "Costalog.Agent.Desktop.exe"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $desktopRoot
$shortcut.Description = "Aplicativo local do AGENTE COSTALOG"
$shortcut.Save()
Write-Host "AGENTE COSTALOG instalado. Serviço Windows iniciado." -ForegroundColor Green
