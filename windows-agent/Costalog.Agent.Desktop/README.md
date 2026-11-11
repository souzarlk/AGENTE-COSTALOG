# AGENTE COSTALOG — Aplicativo WPF

Aplicativo desktop Windows para o usuário e para a equipe de TI. A interface WPF apresenta o estado local do agente Windows e será a experiência principal instalada no computador.

## Requisitos
- Windows 10/11 x64
- .NET 8 Desktop Runtime (ou publicação self-contained)
- Visual Studio 2022 com workload .NET desktop development, ou .NET SDK 8

## Executar em desenvolvimento
Na raiz do repositório:

```powershell
dotnet run --project windows-agent/Costalog.Agent.Desktop/Costalog.Agent.Desktop.csproj
```

A interface lê o estado público do serviço em:
`C:\ProgramData\Costalog\Agent\Public\agent-public-state.json`

Se o serviço ainda não estiver instalado ou vinculado, o aplicativo informa que o computador não está registrado. As seções ainda não implementadas são identificadas como em desenvolvimento; não representam controles ativos.

## Segurança
A interface roda como usuário padrão (sem elevação automática). Operações administrativas devem ser executadas pelo serviço Windows com autorização central e trilha de auditoria. Não armazenar senhas administrativas globais no cliente.
