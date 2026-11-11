# Pacote Windows do AGENTE COSTALOG — instalação dos funcionários

## Como o pacote funciona

O computador do funcionário recebe somente o **serviço Windows CostalogAgent**, executado em segundo plano. Não instala aplicativo WPF, não cria painel local, ícone de bandeja ou atalho no menu Iniciar. O painel web é exclusivo da equipe de TI e administradores autorizados.

O pacote contém o serviço, o assistente de configuração, o script de instalação, a configuração de implantação e a chave pública usada para validar políticas assinadas.

## Configuração obrigatória da TI

Antes de publicar um pacote instalável:

1. Gere o par RSA com `New-PolicyKeyPair.ps1` em uma estação administrativa segura.
2. Configure a chave privada em Base64 na API como `POLICY_SIGNING_PRIVATE_KEY_BASE64`. A chave privada não deve ser incluída no pacote ou no repositório.
3. Cadastre a chave pública completa como variável de repositório `COSTALOG_POLICY_PUBLIC_KEY_PEM`.
4. Cadastre a URL HTTPS da API como variável `COSTALOG_AGENT_API_BASE_URL`.
5. Configure `COSTALOG_AGENT_INSTALL_MODE` como `certificate` ou `certificate-and-web`. O padrão do workflow é `certificate-and-web`.
6. Execute o workflow **Build Windows Agent**. O artefato instalável só será publicado quando a URL da API e a chave pública estiverem configuradas.

## Instalação no computador do funcionário

1. A equipe de TI baixa o ZIP no portal administrativo e o transfere ao computador autorizado.
2. No computador do funcionário, um técnico autorizado extrai o ZIP e executa `Install-CostalogAgent.ps1` como Administrador.
3. O assistente solicita a senha temporária criada no painel da TI.
4. O instalador registra e inicia o serviço Windows automaticamente.

A senha temporária deve ter pelo menos 20 caracteres, incluir letras e números, possuir validade definida pela TI e só pode cadastrar um computador. O servidor guarda somente o hash da senha. A senha é protegida localmente com DPAPI LocalMachine até o primeiro cadastro, quando é consumida.

## Remoção

A remoção exige autorização assinada pela TI, individual e com validade limitada. Use `Uninstall-CostalogAgent.ps1` após receber a autorização válida.

## Estado da implementação

O serviço já possui a base de cadastro, heartbeat, telemetria de hardware/sistema, inventário de certificados por metadados públicos, sincronização de políticas assinadas e eventos. Isso **não significa que todos os controles solicitados estejam ativos**. O bloqueio efetivo de sites, a autorização de uso de certificados por domínio, USB, instalação de programas, SMART, inventário completo de aplicações e outros controles ainda exigem os respectivos mecanismos de aplicação e homologação no Windows.

A API/MariaDB precisa estar implantada e configurada. Não distribua o agente aos funcionários antes de concluir a homologação em computadores de teste, validar recuperação e comunicar formalmente a política de monitoramento aos usuários.
