# AGENTE COSTALOG

Plataforma corporativa de segurança e gestão de endpoints Windows da COSTALOG.

> Este repositório é independente do portal **Certificados Costalog**. O AGENTE monitora e aplica políticas de segurança nos computadores; não é um cadastro nem um repositório de arquivos PFX/P12.

## Módulos planejados

- Visão geral e postura de segurança da frota.
- Bloqueio de navegação por política central (Chrome/Edge gerenciados na primeira fase).
- Regras específicas de domínios permitidos para uso de certificados.
- Inventário de dispositivos e telemetria (hostname, Windows, hardware, memória, discos, uptime e último boot).
- Saúde do Windows e eventos relevantes de erro/serviço.
- Descoberta de certificados instalados: somente metadados públicos (titular, emissor, validade, thumbprint e store), nunca chaves privadas.
- Histórico de navegação por domínio, com aviso ao usuário, finalidade corporativa, retenção limitada e controles de privacidade.
- Auditoria, alertas, downloads assinados e configuração do agente.
- Proteção contra alteração/desinstalação sem autorização administrativa central.

## Arquitetura

- Portal: HTML/CSS/JavaScript, publicado pelo GitHub Pages.
- API: Node.js + Express.
- Banco: MariaDB 10.6+ (InnoDB/utf8mb4).
- Endpoint: Windows Service .NET 8, identidade por dispositivo e segredo protegido com DPAPI.
- Navegadores: extensão gerenciada para Chrome e Edge.
- Identidade administrativa: sessão compartilhada da Central de Notas Fiscais Costalog.
- Políticas: documentos versionados e assinados digitalmente.

## Segurança e limites

- Não coletar teclas digitadas, conteúdo de formulários, senhas, cookies, histórico completo de URLs ou capturas de tela.
- A telemetria de navegação registra hostname/domínio, horário, dispositivo e decisão da política; a retenção deve ser configurável e proporcional.
- Certificados são inventariados somente por metadados públicos. A chave privada nunca é enviada ao portal.
- Desinstalação exige aprovação central, token assinado de uso único e prazo curto. Existe procedimento documentado de recuperação para a equipe de TI autorizada.
- Uma senha global compartilhada não será gravada em texto puro nem embutida no instalador. O fluxo usa hash no servidor, tokens de implantação de uso único e autorização administrativa por dispositivo.
- Funcionalidades só serão marcadas como ativas após implementação, testes e instalação real. O painel de demonstração não representa telemetria de computadores reais.

## Estado do projeto

O portal inicial está sendo construído. A API e o agente Windows ainda precisam de implantação no servidor corporativo e piloto controlado. Não instale em produção antes da validação da TI.

## Estrutura prevista

- `index.html`, `assets/css/app.css`, `assets/js/app.js`: portal.
- `server/`: API, migrações MariaDB, autenticação, políticas e auditoria.
- `windows-agent/`: serviço Windows, coleta de inventário e proteção contra adulteração.
- `browser-extension/`: extensão gerenciada Chrome/Edge.
- `docs/`: arquitetura, implantação, privacidade, hardening e runbooks.

