param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "policy-keys")
)
$ErrorActionPreference = "Stop"
if (Test-Path $OutputDirectory) {
    $existing = @(Get-ChildItem -LiteralPath $OutputDirectory -Force -ErrorAction SilentlyContinue)
    if ($existing.Count -gt 0) { throw "A pasta de saída já contém arquivos. Escolha outra pasta para não sobrescrever chaves." }
} else { New-Item -ItemType Directory -Path $OutputDirectory | Out-Null }
$rsa = [System.Security.Cryptography.RSA]::Create(3072)
try {
    $privatePem = $rsa.ExportPkcs8PrivateKeyPem()
    $publicPem = $rsa.ExportSubjectPublicKeyInfoPem()
    $privatePath = Join-Path $OutputDirectory "policy-signing-private.pem"
    $publicPath = Join-Path $OutputDirectory "policy-public.pem"
    $envPath = Join-Path $OutputDirectory "POLICY_SIGNING_PRIVATE_KEY_BASE64.txt"
    [System.IO.File]::WriteAllText($privatePath, $privatePem, [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::WriteAllText($publicPath, $publicPem, [System.Text.UTF8Encoding]::new($false))
    $base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($privatePem))
    [System.IO.File]::WriteAllText($envPath, $base64, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Par de chaves RSA-3072 criado em: $OutputDirectory" -ForegroundColor Green
    Write-Host "Configure o conteúdo do arquivo BASE64 como segredo POLICY_SIGNING_PRIVATE_KEY_BASE64 na API."
    Write-Host "Distribua somente policy-public.pem nos pacotes Windows."
    Write-Host "Nunca envie a chave privada ao GitHub, ao instalador ou aos computadores."
} finally { $rsa.Dispose() }
