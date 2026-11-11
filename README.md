# AGENTE COSTALOG

Plataforma corporativa de monitoramento e administração de endpoints Windows da COSTALOG.

> O portal de certificados digitais Costalog permanece independente. O AGENTE COSTALOG não armazena nem transfere arquivos PFX/P12 e nunca envia chaves privadas.

## Arquitetura definida

- **Portal web administrativo:** exclusivo da TI e de contas explicitamente autorizadas. É onde a equipe visualiza os computadores, gerencia regras, define perfis de instalação, cria senhas temporárias e baixa o pacote do agente.
- **Agente Windows:** instalado nos computadores dos funcionários como serviço em segundo plano. Não instala painel, janela de monitoramento, ícone de bandeja ou atalho local para o funcionário.
- **Instalador:** executado por técnico autorizado como Administrador. Solicita uma senha temporária de uso único, criada pela TI no portal.
- **API:** Node.js + Express, com autenticação independente por dispositivo, validação de sessão administrativa, rate limiting e comunicação HTTPS.
- **Banco:** MariaDB/InnoDB.
- **Políticas:** versionadas e assinadas digitalmente. O perfil escolhido pela TI é vinculado à credencial de instalação e aplicado no cadastro do dispositivo.

## Fluxo de implantação previsto

1. A TI baixa o pacote Windows no portal administrativo e o transfere ao computador autorizado.
2. Um técnico executa Install-CostalogAgent.ps1 como Administrador.
3. O assistente pede a senha temporária definida pela TI.
4. A senha é validada e consumida uma única vez pela API. O dispositivo recebe uma credencial própria, protegida com DPAPI LocalMachine.
5. O serviço inicia automaticamente em segundo plano, envia heartbeat/telemetria e sincroniza políticas assinadas.
6. A TI acompanha o dispositivo pelo portal web.

## Estrutura

- AGENTE-COSTALOG.sln: solução .NET usada no desenvolvimento.
- windows-agent/Costalog.Agent.Service/: serviço Windows em segundo plano.
- windows-agent/Costalog.Agent.Setup/: assistente de instalação e configuração inicial.
- windows-agent/Costalog.Agent.Desktop/: protótipo WPF legado, não incluído no pacote distribuído aos funcionários.
- windows-agent/installer/: scripts de instalação, remoção aprovada e geração das chaves de política.
- server/: API, migrações MariaDB, autenticação, políticas e auditoria.
- assets/ e index.html: portal administrativo.

## Compilar no Windows

Requisitos: Windows 10/11 e .NET 8 SDK.

~~~powershell
dotnet restore windows-agent/Costalog.Agent.Service/Costalog.Agent.Service.csproj
dotnet build windows-agent/Costalog.Agent.Service/Costalog.Agent.Service.csproj --configuration Release
dotnet restore windows-agent/Costalog.Agent.Setup/Costalog.Agent.Setup.csproj
dotnet build windows-agent/Costalog.Agent.Setup/Costalog.Agent.Setup.csproj --configuration Release
~~~

O workflow .github/workflows/build-windows-agent.yml compila somente o serviço e o assistente para o pacote do funcionário. O WPF legado não é publicado no pacote.

## Configuração necessária antes de liberar o instalador

A equipe responsável pela infraestrutura precisa configurar:

- COSTALOG_AGENT_API_BASE_URL nas variáveis do repositório.
- COSTALOG_POLICY_PUBLIC_KEY_PEM nas variáveis do repositório.
- POLICY_SIGNING_PRIVATE_KEY_BASE64 no ambiente seguro do servidor da API. A chave privada nunca deve ser commitada nem incluída no ZIP.
- CENTRAL_ADMIN_SUBJECTS no servidor, com os identificadores sub exatos das contas da Central autorizadas a administrar o agente.
- apiBaseUrl e agentDownloadUrl em assets/js/config.js, depois que a API e a release estiverem publicadas.
- Origem do portal na lista ALLOWED_ORIGINS da API.
- API/MariaDB publicados e acessíveis por HTTPS.

O workflow só envia o artefato instalável quando a URL HTTPS e a chave pública estiverem presentes. Para criar uma URL estável de download, publique uma tag agent-v* depois que a configuração estiver pronta; o workflow anexa o ZIP à Release.

## Funcionalidades existentes e pendentes

**Base já implementada no serviço/API:** enrollment de uso único, heartbeat, inventário inicial de hardware e Windows, memória, uptime, rede, discos e inventário de certificados usando somente metadados públicos; sincronização e validação criptográfica de políticas assinadas; registro de eventos e pedidos de autorização de remoção.

**Ainda não liberado como proteção efetiva:** bloqueio de sites no Windows/navegadores, controle técnico de uso de certificado por domínio, USB, restrição de instalação de programas, sensor SMART confiável, inventário completo de softwares e demais módulos de segurança planejados. As telas de regras do portal também precisam ser conectadas aos dados reais da API; partes do portal ainda contêm dados ilustrativos. Não interpretar uma regra exibida como bloqueio já aplicado.

## Segurança, privacidade e operação

- Não coletar senhas, teclas digitadas, cookies, conteúdo de formulários, mensagens ou capturas de tela.
- Metadados de certificados são enviados para inventário; nenhuma chave privada é exportada.
- A navegação deve ser limitada a dados técnicos corporativos e informada aos funcionários em política interna apropriada.
- O serviço e arquivos protegidos reduzem alterações por usuários padrão, mas não são invulneráveis a um administrador local. Hardening adicional requer política Windows/Intune/WDAC e procedimento formal de recuperação.
- A remoção permanece sujeita a aprovação assinada da TI.
- Não distribuir em massa até concluir configuração da API, publicação do pacote, testes de enforcement e piloto controlado.

## Estado

A implementação permanece na branch feature/portal-foundation. A compilação do serviço e do assistente foi validada em GitHub Actions em revisões recentes; o upload do instalador ficou deliberadamente condicionado às variáveis de implantação. O projeto ainda não é uma versão de produção e os controles listados como pendentes precisam ser desenvolvidos e homologados individualmente.
