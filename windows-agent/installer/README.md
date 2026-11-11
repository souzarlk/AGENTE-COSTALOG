# Pacote Windows do AGENTE COSTALOG

1. Gere o par RSA com New-PolicyKeyPair.ps1 em uma estação administrativa segura.
2. Configure a chave privada em Base64 na API como POLICY_SIGNING_PRIVATE_KEY_BASE64.
3. Coloque apenas policy-public.pem na raiz desta pasta extraída.
4. Execute Install-CostalogAgent.ps1 em PowerShell como Administrador.
5. Gere o token de implantação no painel de TI e informe-o ao assistente.

O instalador registra o serviço Windows como LocalSystem, define as permissões das pastas privadas e públicas e cria o atalho da interface WPF.

A remoção só é aceita após a TI aprovar a solicitação e o agente receber uma autorização assinada. Use Uninstall-CostalogAgent.ps1.

Este pacote ainda requer API/MariaDB implantados e uma política publicada. Os módulos não implementados não estão ativos.
