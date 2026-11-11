# AGENTE COSTALOG

Plataforma corporativa de segurança e gestão de endpoints Windows da COSTALOG, composta por aplicativo desktop, serviço local e painel central da TI.

> Este repositório é independente do portal **Certificados Costalog**. O AGENTE aplica políticas e monitora computadores; não é um cadastro nem um repositório de arquivos PFX/P12.

## Arquitetura escolhida

- **Aplicativo desktop:** C#/.NET 8 com WPF, instalado diretamente nos computadores Windows. É a interface local para consulta de status e acesso aos módulos.
- **Serviço Windows:** processo em segundo plano, independente da janela WPF, responsável por inventário, telemetria, sincronização de políticas e execução das proteções autorizadas.
- **Painel central da TI:** interface administrativa para visualizar dispositivos, receber alertas, gerir políticas e aprovar ações privilegiadas.
- **API:** Node.js + Express, com autenticação por dispositivo, autorização administrativa e comunicação HTTPS.
- **Banco de dados:** MariaDB 10.6+ (InnoDB/utf8mb4).
- **Navegadores:** extensão gerenciada para Chrome e Edge, com políticas distribuídas centralmente.
- **Políticas:** documentos versionados e assinados digitalmente.

## Estrutura

- `AGENTE-COSTALOG.sln`: solução para Visual Studio.
- `windows-agent/Costalog.Agent.Desktop/`: aplicativo WPF instalado no PC.
- `windows-agent/Costalog.Agent.Service/`: serviço Windows de monitoramento.
- `windows-agent/Costalog.Agent.Setup/`: utilitário de configuração/instalação em evolução.
- `browser-extension/`: extensão gerenciada Chrome/Edge.
- `server/`: API, migrações MariaDB, autenticação, políticas e auditoria.
- `docs/`: arquitetura, implantação, privacidade, hardening e runbooks.

## Compilar no Windows

Requisitos: Windows 10/11, .NET 8 SDK e workload **Desenvolvimento para desktop com .NET** do Visual Studio 2022 (ou SDK equivalente).

```powershell
dotnet restore AGENTE-COSTALOG.sln
dotnet build AGENTE-COSTALOG.sln --configuration Release
dotnet run --project windows-agent/Costalog.Agent.Desktop/Costalog.Agent.Desktop.csproj
```

O workflow `.github/workflows/build-windows-agent.yml` compila o aplicativo WPF e o serviço em runner Windows do GitHub Actions.

## Módulos planejados

- Visão geral e postura de segurança da frota.
- Inventário de dispositivos e telemetria (hostname, Windows, hardware, memória, discos, uptime e último boot).
- Saúde do Windows e eventos relevantes de erro/serviço.
- Análise de espaço em disco e saúde SMART de SSDs.
- Descoberta de certificados instalados: somente metadados públicos (titular, emissor, validade, thumbprint e store), nunca chaves privadas.
- Proteção de certificados e regras específicas de destinos permitidos.
- Bloqueio de navegação por política central e alertas de domínios suspeitos.
- Políticas de dispositivos USB e prevenção de vazamento de dados.
- Inventário de programas, restrição de instalação e alertas de adulteração.
- Gestão de rede, usuários e sessões.
- Monitoramento de e-mail e alertas operacionais.
- Painel de administração, auditoria, políticas e autorização de ações privilegiadas.

## Segurança e limites

- Não coletar teclas digitadas, conteúdo de formulários, senhas, cookies, histórico completo de URLs ou capturas de tela.
- Telemetria de navegação limitada a domínio, horário, dispositivo e decisão da política, com retenção proporcional e configurável.
- Certificados são inventariados somente por metadados públicos. A chave privada nunca é enviada ao painel.
- Ações administrativas devem ser autorizadas, auditadas e executadas pelo serviço com privilégio mínimo.
- Não existe promessa de resistência absoluta à remoção por um administrador local. Hardening requer políticas Windows/Intune/WDAC, ACLs de serviço e procedimento de recuperação da TI.
- Não armazenar senha administrativa global em texto puro ou embutida no instalador.
- Funcionalidades só serão marcadas como ativas após implementação, testes e piloto controlado. Seções ainda em desenvolvimento não aplicam bloqueios.

## Estado atual

A fundação inicial do aplicativo WPF foi adicionada à branch `feature/portal-foundation`, junto de uma solução Visual Studio e workflow de compilação Windows. A interface já apresenta navegação e lê o estado público local do serviço quando disponível. Os módulos de proteção ainda precisam ser implementados e validados individualmente. O painel central e a API continuam em evolução; ainda não é uma versão pronta para produção.

**Não instalar em produção antes da validação da TI e de um piloto controlado.**
