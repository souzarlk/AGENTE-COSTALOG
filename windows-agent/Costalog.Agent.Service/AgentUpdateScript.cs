namespace Costalog.Agent.Service;

// Script que aplica a atualização fora do processo do serviço
// (o serviço não consegue substituir os próprios arquivos enquanto roda).
// Em caso de falha, restaura a versão anterior e religa o serviço.
public static class AgentUpdateScript
{
    public const string Content = """
param(
    [string]$Staging,
    [string]$Target,
    [string]$Config,
    [string]$Version,
    [string]$Log
)
$ErrorActionPreference = "Stop"
function Write-Log([string]$Message) {
    Add-Content -Path $Log -Value ((Get-Date).ToString("s") + " " + $Message)
}
$backup = $Target + ".backup"
$originalConfig = $null
try {
    Write-Log "Iniciando atualizacao para $Version"
    Start-Sleep -Seconds 5
    Stop-Service CostalogAgent -Force
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Service CostalogAgent).Status -ne "Stopped" -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
    }
    Start-Sleep -Seconds 2
    if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
    Copy-Item $Target $backup -Recurse -Force
    Copy-Item (Join-Path $Staging "*") $Target -Recurse -Force
    $originalConfig = Get-Content $Config -Raw
    $json = $originalConfig | ConvertFrom-Json
    $json.agentVersion = $Version
    [IO.File]::WriteAllText($Config, ($json | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
    Start-Service CostalogAgent
    Write-Log "Atualizacao concluida para $Version"
}
catch {
    Write-Log ("Falha: " + $_.Exception.Message)
    try {
        if (Test-Path $backup) { Copy-Item (Join-Path $backup "*") $Target -Recurse -Force }
        if ($originalConfig) { [IO.File]::WriteAllText($Config, $originalConfig, (New-Object Text.UTF8Encoding $false)) }
        Write-Log "Versao anterior restaurada"
    } catch {
        Write-Log ("Falha ao restaurar: " + $_.Exception.Message)
    }
    try { Start-Service CostalogAgent } catch { Write-Log ("Falha ao iniciar servico: " + $_.Exception.Message) }
}
""";

    // Remoção autorizada: para e exclui o serviço e apaga as pastas do agente.
    public const string Uninstall = """
param(
    [string]$ProgramRoot,
    [string]$DataRoot
)
$ErrorActionPreference = "Continue"
Start-Sleep -Seconds 5
Stop-Service CostalogAgent -Force -ErrorAction SilentlyContinue
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Service CostalogAgent -ErrorAction SilentlyContinue).Status -eq "Running" -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 1
}
& sc.exe delete CostalogAgent | Out-Null
Start-Sleep -Seconds 2
if ($ProgramRoot -and (Test-Path $ProgramRoot)) { Remove-Item $ProgramRoot -Recurse -Force -ErrorAction SilentlyContinue }
if ($DataRoot -and (Test-Path $DataRoot)) { Remove-Item $DataRoot -Recurse -Force -ErrorAction SilentlyContinue }
Remove-Item $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
""";
}
