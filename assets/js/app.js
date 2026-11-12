(()=>{
"use strict";
const cfg=window.COSTALOG_AGENT_CONFIG||{},$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const tokenKey="costalog_admin_token";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={view:"overview",token:null,apiReady:false,demo:true,rules:[],certRules:[],events:[],devices:[],devicesError:"",deviceQuery:"",deviceFilter:"all",query:"",pendingRelease:[]};
const demoLabel = '<span class="status-pill pill-amber">PRÉVIA ILUSTRATIVA</span>';
const demo={
 devices:[
 {id:"pc-01",name:"CST-FROTA-014",user:"frota.014",model:"Dell OptiPlex 7010",os:"Windows 11 Pro 23H2",ram:"16 GB",cpu:"Intel Core i5-13500",disk:"512 GB SSD",used:62,uptime:"2d 04h",boot:"09/11/2026 07:42",ip:"10.20.1.114",status:"Online",last:"há 2 min",mode:"Proteção A",office:"OK",ssd:"98%",usb:"Bloqueado",agent:"Protegido"},
 {id:"pc-02",name:"CST-ADM-003",user:"adm03",model:"Dell Latitude 5440",os:"Windows 11 Pro 24H2",ram:"16 GB",cpu:"Intel Core i7-1365U",disk:"512 GB SSD",used:78,uptime:"0d 05h",boot:"11/11/2026 06:58",ip:"10.20.2.103",status:"Online",last:"há 1 min",mode:"Proteção B",office:"Falha detectada",ssd:"95%",usb:"Bloqueado",agent:"Protegido"},
 {id:"pc-03",name:"CST-TERM-022",user:"terminal22",model:"HP ProDesk 600 G6",os:"Windows 10 Enterprise",ram:"8 GB",cpu:"Intel Core i5-10500",disk:"256 GB SSD",used:91,uptime:"6d 10h",boot:"05/11/2026 01:04",ip:"10.20.3.122",status:"Atenção",last:"há 4 min",mode:"Proteção B",office:"OK",ssd:"83%",usb:"Bloqueado",agent:"Protegido"},
 {id:"pc-04",name:"CST-RH-002",user:"rh02",model:"Lenovo ThinkCentre M70",os:"Windows 11 Pro 23H2",ram:"8 GB",cpu:"Intel Core i5-12400",disk:"256 GB SSD",used:44,uptime:"1d 02h",boot:"10/11/2026 09:17",ip:"10.20.4.102",status:"Online",last:"há 3 min",mode:"Proteção A",office:"OK",ssd:"97%",usb:"Bloqueado",agent:"Protegido"},
 {id:"pc-05",name:"CST-LOG-008",user:"logistica08",model:"Dell OptiPlex 7090",os:"Windows 10 Pro",ram:"16 GB",cpu:"Intel Core i7-10700",disk:"512 GB SSD",used:68,uptime:"12d 08h",boot:"30/10/2026 23:01",ip:"10.20.1.108",status:"Offline",last:"há 2h 14min",mode:"Proteção A",office:"Desconhecido",ssd:"91%",usb:"Bloqueado",agent:"Sem comunicação"},
 {id:"pc-06",name:"CST-TI-001",user:"suporte.ti",model:"Dell Precision 3660",os:"Windows 11 Pro 24H2",ram:"32 GB",cpu:"Intel Core i7-13700",disk:"1 TB NVMe",used:35,uptime:"0d 03h",boot:"11/11/2026 08:22",ip:"10.20.0.101",status:"Online",last:"há 30 s",mode:"Proteção B",office:"OK",ssd:"99%",usb:"Exceção TI",agent:"Protegido"}
 ],
 certs:[
 {name:"e-CNPJ CRC DA COSTA TRANSPORTES",holder:"CRC DA COSTA TRANSPORTES LTDA",issuer:"AC Certisign RFB G5",serial:"7A:20:11:9C:3D:01",thumb:"SHA256: 9F2A…A84E",expires:"21/12/2026",device:"CST-ADM-003",state:"Vencendo",store:"Pessoal (CurrentUser)"},
 {name:"e-CNPJ COSTALOG TRANSPORTES",holder:"COSTALOG TRANSPORTES LTDA",issuer:"AC SERASA RFB v5",serial:"4B:81:77:02:6E:19",thumb:"SHA256: 11B0…C52D",expires:"18/04/2027",device:"CST-TI-001",state:"Válido",store:"Pessoal (LocalMachine)"},
 {name:"e-CPF Responsável Fiscal",holder:"Titular restrito",issuer:"AC VALID RFB",serial:"00:2D:91:A0:44",thumb:"SHA256: C2E1…2A9D",expires:"02/11/2026",device:"CST-ADM-003",state:"Expirado",store:"Pessoal (CurrentUser)"}
 ],
 activity:[
 {device:"CST-ADM-003",domain:"cav.receita.fazenda.gov.br",time:"11/11/2026 10:48:22",action:"Permitido",rule:"Portal e-CAC",reason:"Domínio autorizado para certificado"},
 {device:"CST-TERM-022",domain:"fileshare.example",time:"11/11/2026 10:44:09",action:"Bloqueado",rule:"Compartilhamento público",reason:"Domínio em lista de bloqueio"},
 {device:"CST-FROTA-014",domain:"portal.costalog.local",time:"11/11/2026 10:40:14",action:"Permitido",rule:"Navegação corporativa",reason:"Navegação permitida pela política"},
 {device:"CST-ADM-003",domain:"www.nfe.fazenda.gov.br",time:"11/11/2026 10:32:57",action:"Permitido",rule:"Portal SEFAZ",reason:"Domínio autorizado para certificado"},
 {device:"CST-RH-002",domain:"social.example",time:"11/11/2026 10:21:06",action:"Bloqueado",rule:"Redes sociais não autorizadas",reason:"Domínio em lista de bloqueio"}
 ],
 events:[
 {kind:"red",icon:"⊘",title:"Navegação bloqueada",desc:"CST-TERM-022 tentou acessar fileshare.example.",time:"10:44",state:"Bloqueio"},
 {kind:"green",icon:"✓",title:"Agente sincronizado",desc:"CST-ADM-003 recebeu a política v18.",time:"10:39",state:"Sistema"},
 {kind:"red",icon:"!",title:"Armazenamento crítico",desc:"CST-TERM-022 atingiu 91% de ocupação do disco.",time:"10:32",state:"Atenção"},
 {kind:"",icon:"⌁",title:"Inicialização do computador",desc:"CST-ADM-003 iniciou às 06:58.",time:"06:58",state:"Sistema"},
 {kind:"",icon:"◈",title:"Certificado próximo do vencimento",desc:"e-CNPJ CRC da Costa vence em 40 dias.",time:"Ontem",state:"Certificado"},
 {kind:"red",icon:"⚑",title:"Tentativa de interrupção do agente",desc:"CST-LOG-008 perdeu comunicação; investigação pendente.",time:"Ontem",state:"Integridade"}
 ],
 errors:[
 {pc:"CST-TERM-022",type:"Espaço em disco baixo",source:"Windows / Storage",when:"11/11/2026 10:32",level:"Crítico"},
 {pc:"CST-ADM-003",type:"Falha de atualização do Office",source:"Microsoft 365 Apps",when:"11/11/2026 09:18",level:"Aviso"},
 {pc:"CST-LOG-008",type:"Serviço do agente sem heartbeat",source:"AGENTE COSTALOG",when:"11/11/2026 08:56",level:"Crítico"},
 {pc:"CST-FROTA-014",type:"Reinicialização após atualização",source:"Windows Event Log",when:"11/11/2026 07:42",level:"Informativo"}
 ],
 email:[
 {mailbox:"ti@costalog.com.br",type:"Caixa de TI",status:"Aguardando conexão",last:"Não sincronizado",scope:"Metadados e regras autorizadas"},
 {mailbox:"compras@costalog.com.br",type:"Caixa compartilhada",status:"Não conectado",last:"—",scope:"Acesso delegado"}
 ],
 rules:[
 {id:1,name:"Redes sociais — lista de bloqueio",host:"social.example",scope:"Todos os computadores",kind:"Bloquear site",enabled:true},
 {id:2,name:"Compartilhamento externo",host:"fileshare.example",scope:"Grupo: Operacional",kind:"Bloquear site",enabled:true},
 {id:3,name:"Portal de treinamento",host:"treinamento.costalog.local",scope:"Todos os computadores",kind:"Permitir exceção",enabled:false}
 ],
 certRules:[
 {id:1,name:"Portal e-CAC",host:"cav.receita.fazenda.gov.br",scope:"Certificados e-CNPJ",enabled:true},
 {id:2,name:"Portal NF-e / SEFAZ",host:"www.nfe.fazenda.gov.br",scope:"Certificados fiscais",enabled:true},
 {id:3,name:"Assinador corporativo",host:"assinador.costalog.local",scope:"Certificados autorizados",enabled:true}
 ]
};
const titles={"overview":"Visão geral","web-blocking":"Bloqueio de sites","certificate-rules":"Sites para certificados","devices":"Computadores","health":"Saúde dos computadores","installed-certs":"Certificados na máquina","browsing":"Atividade de navegação","audit":"Auditoria e alertas","downloads":"Download do agente","agent-settings":"Configurações agente","settings":"Configurações gerais","device-detail":"Detalhes do computador"};
function toast(m){const el=$("#toast");el.textContent=m;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3000)}
function pill(s){const c=["Online","Permitido","Válido","Ativo","Protegido","Conectado"].includes(s)?"pill-green":["Atenção","Vencendo","Aviso","Aguardando conexão"].includes(s)?"pill-amber":["Bloqueado","Expirado","Crítico","Offline","Falha detectada","Sem comunicação"].includes(s)?"pill-red":"pill-gray";return '<span class="status-pill '+c+'">'+esc(s)+'</span>'}
function head(k,t,d,a=""){return '<div class="page-heading"><div><div class="eyebrow">'+k+'</div><h1>'+t+'</h1><p>'+d+'</p></div><div class="heading-actions">'+a+'</div></div>'}
function cardHead(t,s="",r=""){return '<div class="card-heading"><div><h3>'+t+'</h3>'+(s?'<p>'+s+'</p>':'')+'</div>'+(r||'')+'</div>'}
function metric(l,v,f,i){return '<article class="card metric-card"><div class="metric-top"><span class="metric-label">'+l+'</span><span class="metric-icon">'+i+'</span></div><div class="metric-value">'+v+'</div><div class="metric-foot">'+f+'</div></article>'}
function eventRows(items){return '<div class="event-list">'+items.map(e=>'<div class="event-row"><span class="event-mark '+e.kind+'">'+e.icon+'</span><div><b>'+esc(e.title)+'</b><p>'+esc(e.desc)+'</p></div><span class="event-time">'+esc(e.time)+'</span></div>').join('')+'</div>'}
function pageOverview(){
 const d=state.dashboard;
 const devices=d?.devices||{};
 const count=v=>Number(v||0).toLocaleString("pt-BR");
 const error=state.dashboardError;
 return head("CENTRAL DE SEGURANÇA","Proteção da frota em um só lugar","Indicadores consultados diretamente no servidor.",'<button class="btn btn-secondary btn-small" data-action="refresh">↻ Atualizar painel</button><button class="btn btn-primary btn-small" data-nav="downloads">⇧ Instalar agente</button>')+
 (error?'<div class="rule-info"><strong>Falha ao consultar o servidor:</strong> '+esc(error)+'</div>':'')+
 '<div class="metric-grid">'+
 metric("DISPOSITIVOS CADASTRADOS",d?count(devices.total):"--",d?"Total registrado no servidor":"Aguardando consulta","PC")+
 metric("DISPOSITIVOS ATIVOS",d?count(devices.active):"--",d?"Com status ativo":"Aguardando consulta","AT")+
 metric("COMPUTADORES ONLINE",d?count(devices.online):"--",d?"Comunicação nos últimos 5 minutos":"Aguardando consulta","ON")+
 metric("EVENTOS HOJE",d?count(d.eventsToday):"--",d?"Eventos registrados hoje":"Aguardando consulta","EV")+
 metric("BLOQUEIOS HOJE",d?count(d.blockedToday):"--",d?"Navegações bloqueadas hoje":"Aguardando consulta","BL")+
 metric("CERTIFICADOS A VENCER",d?count(d.certificatesExpiring):"--",d?"Vencimento nos próximos 30 dias":"Aguardando consulta","CE")+
 '</div>'+
 '<section class="card card-pad">'+cardHead("Estado da conexão","Dados recebidos da API administrativa")+
 (d?'<p>Consulta realizada com sucesso. Indicadores provenientes do banco de dados.</p>':'<p>Aguardando os dados reais do servidor. Utilize Atualizar painel para tentar novamente.</p>')+
 '</section>';
}
async function refreshDashboard(){
 state.dashboardError="";
 try{
  const base=String(cfg.apiBaseUrl||"").replace(/\/+$/,"");
  if(!base) throw new Error("API não configurada.");
  const result=await fetchJson(base+(cfg.apiPrefix||"/api/v1")+"/admin/dashboard");
  if(result.mode!=="live"||!result.devices) throw new Error("A API não retornou os indicadores esperados.");
  state.dashboard=result;
  state.apiReady=true;
  setEnvironment(true);
 }catch(error){
  state.dashboard=null;
  state.apiReady=false;
  setEnvironment(false);
  state.dashboardError=error.message||"Não foi possível consultar a API.";
 }
 if(state.view==="overview") $("#viewRoot").innerHTML=pageOverview();
}
const apiUrl=path=>String(cfg.apiBaseUrl||"").replace(/\/+$/,"")+(cfg.apiPrefix||"/api/v1")+path;
const ruleApi={web:"/admin/web-rules",cert:"/admin/certificate-rules"};
const certScopes={"e-cnpj":"Certificados e-CNPJ","fiscal":"Certificados fiscais","managed":"Todos os certificados gerenciados","custom":"Grupo específico"};
const ruleState={web:{items:[],loading:false,error:""},cert:{items:[],loading:false,error:""}};
function setEnvironment(live){
 const badge=$("#environmentBadge");
 if(badge){badge.classList.toggle("live",live);badge.innerHTML='<span></span> '+(live?"API CONECTADA":"API NÃO CONECTADA");}
 const notice=$("#demoNotice");
 if(notice)notice.hidden=live;
}
function mapRule(kind,r){
 const enabled=r.enabled===true||Number(r.enabled)===1;
 if(kind==="web")return{id:String(r.id),name:r.name,host:r.hostname,scope:r.scopeType==="all"||!r.scopeType?"Todos os computadores":(r.scopeType==="group"?"Grupo: ":"Computador: ")+(r.scopeValue||""),kind:r.action==="allow"?"Permitir exceção":"Bloquear site",enabled};
 return{id:String(r.id),name:r.name,host:r.hostname,scope:certScopes[r.certificateScope]||r.certificateScope||"Todos os certificados gerenciados",kind:"Domínio autorizado para certificado",enabled};
}
function renderRuleList(kind){
 const box=$(kind==="web"?"#webRuleList":"#certRuleList");
 if(box)box.innerHTML=ruleList(kind);
}
async function refreshRules(kind){
 const rs=ruleState[kind];
 rs.loading=true;rs.error="";renderRuleList(kind);
 try{
  if(!cfg.apiBaseUrl||!state.token)throw new Error("Sessão administrativa ou API indisponível.");
  const data=await fetchJson(apiUrl(ruleApi[kind]));
  if(!Array.isArray(data.items))throw new Error("Resposta inesperada da API.");
  rs.items=data.items.map(r=>mapRule(kind,r));
 }catch(error){
  rs.items=[];rs.error=error.message||"Falha ao consultar as regras.";
 }
 rs.loading=false;renderRuleList(kind);
}
function ruleList(kind){
 const rs=ruleState[kind];
 if(rs.loading)return '<div class="empty-state">Consultando regras no servidor...</div>';
 if(rs.error)return '<div class="empty-state">Falha ao consultar a API: '+esc(rs.error)+'</div>';
 if(!rs.items.length)return '<div class="empty-state">Nenhuma regra cadastrada no servidor.</div>';
 return '<div class="table-wrap"><table><thead><tr><th>NOME DA REGRA</th><th>DOMÍNIO</th><th>APLICAÇÃO</th><th>STATUS</th><th>CONTROLE</th></tr></thead><tbody>'+rs.items.map(r=>'<tr><td><span class="cell-main">'+esc(r.name)+'</span><span class="cell-sub">'+esc(r.kind)+'</span></td><td>'+esc(r.host)+'</td><td>'+esc(r.scope)+'</td><td>'+pill(r.enabled?"Ativo":"Desativado")+'</td><td><button class="action-link" data-toggle-rule="'+kind+'" data-id="'+esc(r.id)+'">'+(r.enabled?"Desativar":"Ativar")+'</button> <button class="action-link danger" data-delete-rule="'+kind+'" data-id="'+esc(r.id)+'">Remover</button></td></tr>').join('')+'</tbody></table></div>';
}
function pageWeb(){return head("POLÍTICAS DE NAVEGAÇÃO","Bloqueio de sites","Inclua os sites que devem ser bloqueados em todos os computadores. O restante da navegação continua liberado.",'<span class="status-pill pill-green">PUBLICAÇÃO AUTOMÁTICA</span>')+
'<div class="rule-info"><strong>Como funciona:</strong> ao salvar, ativar, desativar ou remover uma regra, a política é publicada automaticamente e os computadores ligados recebem a mudança em cerca de 1 minuto. O bloqueio vale para o domínio e seus subdomínios no Chrome, Edge, Brave e Firefox (o Firefox aplica ao ser reiniciado) e também pelo arquivo hosts do Windows. Use "Permitir exceção" para liberar um subdomínio de um site bloqueado.</div>'+
'<section class="card card-pad">'+cardHead("Nova regra de navegação","Adicione domínio e ação")+
'<form id="webRuleForm" class="rule-form"><div class="field"><label>Nome da regra</label><input name="name" required maxlength="90" placeholder="Ex.: Jogos online"></div><div class="field"><label>Domínio (hostname)</label><input name="host" required maxlength="253" placeholder="exemplo.com.br"></div><div class="field"><label>Ação</label><select name="kind"><option value="block">Bloquear site</option><option value="allow">Permitir exceção</option></select></div><button class="btn btn-primary" type="submit">＋ Adicionar regra</button></form>'+cardHead("Regras cadastradas","Políticas de navegação")+'<div id="webRuleList">'+ruleList("web")+'</div></section>'}
function pageCertRules(){return head("POLÍTICA DE CERTIFICADOS","Sites para certificados","Somente os sites desta lista estão autorizados a usar os certificados digitais instalados nos computadores.",'<span class="status-pill pill-green">MONITORAMENTO ATIVO</span>')+
'<div class="notice-box"><strong>Etapa 1 — monitoramento:</strong> o agente detecta cada vez que um site ou programa pede um certificado e identifica o site pelo histórico do navegador. Uso em site fora desta lista gera <b>alerta crítico</b> (sino e auditoria). O bloqueio total, com o certificado guardado só no agente (cofre), é a etapa 2. Inclua aqui o domínio exato do portal (ex.: cav.receita.fazenda.gov.br); subdomínios dele também ficam autorizados.</div><br>'+
'<section class="card card-pad">'+cardHead("Adicionar destino autorizado","Domínio permitido no contexto de uso de certificado")+
'<form id="certRuleForm" class="rule-form"><div class="field"><label>Nome</label><input name="name" required maxlength="90" placeholder="Portal fiscal"></div><div class="field"><label>Domínio</label><input name="host" required maxlength="253" placeholder="portal.exemplo.gov.br"></div><div class="field"><label>Grupo de certificados</label><select name="scope"><option value="e-cnpj">Certificados e-CNPJ</option><option value="fiscal">Certificados fiscais</option><option value="managed" selected>Todos os certificados gerenciados</option><option value="custom">Grupo específico</option></select></div><button class="btn btn-primary" type="submit">＋ Autorizar domínio</button></form>'+cardHead("Lista de autorização","Destinos com uso permitido")+'<div id="certRuleList">'+ruleList("cert")+'</div></section>'+
'<br><section class="card data-card">'+cardHead("Uso dos certificados","Cada vez que um site ou programa pediu um certificado",'<select class="filter-select" id="certUsageDays"><option value="1">Últimas 24 horas</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select>')+'<div id="certUsage"><div class="empty-state">Carregando...</div></div></section>'}
async function refreshCertUsage(){
 const box=$("#certUsage");if(!box)return;
 const days=state.certUsageDays||7;const sel=$("#certUsageDays");if(sel)sel.value=String(days);
 try{
  const r=await fetchJson(apiUrl("/admin/certificate-usage?days="+days));
  if(state.view!=="certificate-rules")return;
  const label={certificate_use_allowed:["Autorizado","pill-green"],certificate_use_blocked:["Fora da lista","pill-red"],certificate_use_unknown:["Site não identificado","pill-amber"],certificate_use_program:["Programa","pill-gray"]};
  box.innerHTML=r.items.length?'<div class="table-wrap"><table><thead><tr><th>QUANDO</th><th>COMPUTADOR</th><th>CERTIFICADO</th><th>SITE / PROGRAMA</th><th>USUÁRIO</th><th>SITUAÇÃO</th></tr></thead><tbody>'+
   r.items.map(e=>{const d=e.details||{},l=label[e.eventType]||["—","pill-gray"];return '<tr'+(e.eventType==="certificate_use_blocked"?' class="row-blocked"':'')+'><td>'+esc(formatDeviceDate(e.createdAt))+'</td><td>'+deviceLink(e.deviceId,e.deviceName)+'</td><td><span class="cell-main">'+esc(d.certificate||"")+'</span></td><td><span class="cell-main">'+esc(d.site||d.process||"—")+'</span>'+(d.site&&d.process?'<span class="cell-sub">'+esc(d.process)+'</span>':'')+'</td><td>'+esc(d.windowsUser||"")+'</td><td><span class="status-pill '+l[1]+'">'+l[0]+'</span></td></tr>'}).join('')+
   '</tbody></table></div>':'<div class="empty-state">Nenhum uso de certificado registrado no período.</div>';
 }catch(e){box.innerHTML=failBox(e)}
}

function pageDevices(){
 return head("COMPUTADORES","Inventario de dispositivos","Dispositivos cadastrados e informacoes recebidas pela API.")+
 '<div class="toolbar"><input class="search-input" id="deviceSearch" placeholder="Pesquisar dispositivo, usuario ou IP"><select class="filter-select" id="deviceFilter"><option value="all">Todos os estados</option><option value="active">Ativos</option><option value="disabled">Desativados</option><option value="revoked">Removidos</option></select><button class="action-link" data-action="refresh-devices">Atualizar</button></div>'+
 '<div id="deviceFeedback" class="cell-sub">Aguardando consulta a API...</div><div class="device-grid" id="deviceGrid">'+renderDevices()+'</div>';
}

function formatDeviceDate(value){
 if(!value)return "Nao informado";
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return "Nao informado";
 return date.toLocaleString("pt-BR");
}

function renderDevices(){
 const items=Array.isArray(state.devices)?state.devices:[];
 const query=String(state.deviceQuery||"").trim().toLowerCase();
 const filtered=items.filter(d=>{
  const status=String(d.status||"").toLowerCase();
  const matchesStatus=state.deviceFilter==="all"||status===state.deviceFilter;
  const searchable=[d.deviceName,d.username,d.lastIp,d.model,d.osCaption,d.domainName].join(" ").toLowerCase();
  return matchesStatus&&searchable.includes(query);
 });
 if(state.devicesError)return '<div class="card card-pad">Falha ao consultar API: '+esc(state.devicesError)+'</div>';
 if(!items.length)return '<div class="card card-pad"><h3>Nenhum computador cadastrado</h3><p class="cell-sub">Nenhum dispositivo foi registrado no banco de dados.</p></div>';
 if(!filtered.length)return '<div class="card card-pad">Nenhum dispositivo encontrado para esta pesquisa.</div>';
 return filtered.map(d=>{
  const status=String(d.status||"unknown").toLowerCase();
  const label=status==="active"?"Ativo":status==="disabled"?"Desativado":status==="revoked"?"Removido":"Desconhecido";
  const ram=Number(d.ramTotalBytes)>0?(Number(d.ramTotalBytes)/1073741824).toFixed(1)+" GB":"Nao informado";
  return '<article class="card device-card"><div class="device-card-top"><div class="device-avatar">PC</div><span class="status-pill">'+esc(label)+'</span></div>'+
   '<div class="device-name">'+esc(d.deviceName||"Dispositivo sem nome")+'</div>'+
   '<div class="device-sub">'+esc(d.username||"Usuario nao informado")+' - '+esc(d.model||d.manufacturer||"Modelo nao informado")+'</div>'+
   '<div class="device-specs">'+
   '<div><span>WINDOWS</span><b>'+esc(d.osCaption||"Nao informado")+'</b></div>'+
   '<div><span>VERSAO</span><b>'+esc(d.osVersion||"Nao informado")+'</b></div>'+
   '<div><span>MEMORIA RAM</span><b>'+esc(ram)+'</b></div>'+
   '<div><span>PROCESSADOR</span><b>'+esc(d.cpuName||"Nao informado")+'</b></div>'+
   '<div><span>ULTIMO BOOT</span><b>'+esc(formatDeviceDate(d.lastBootAt))+'</b></div>'+
   '<div><span>ULTIMO CONTATO</span><b>'+esc(formatDeviceDate(d.lastSeenAt))+'</b></div>'+
   '<div><span>IP</span><b>'+esc(d.lastIp||"Nao informado")+'</b></div>'+
   '<div><span>VERSAO DO AGENTE</span><b>'+esc(d.agentVersion||"Nao informado")+(state.latestAgent&&d.agentVersion&&compareVersions(d.agentVersion,state.latestAgent)<0?' <small>(atualizando para '+esc(state.latestAgent)+')</small>':'')+'</b></div>'+
   '<div><span>POLÍTICA APLICADA</span><b>'+(Number(d.policyRevision)>0?"Revisão "+esc(d.policyRevision):"Nenhuma ainda")+'</b></div>'+
   '</div><div class="device-card-foot"><span>Status: '+esc(label)+'</span><button class="action-link" data-device-detail="'+esc(d.id)+'">Ver detalhes →</button></div></article>';
 }).join("");
}

function compareVersions(a,b){const pa=String(a||"0").split(".").map(n=>parseInt(n,10)||0),pb=String(b||"0").split(".").map(n=>parseInt(n,10)||0);for(let i=0;i<3;i++){const d=(pa[i]||0)-(pb[i]||0);if(d)return d}return 0}
async function refreshRelease(){
 try{
  const r=await fetchJson(apiUrl("/admin/agent-release"));
  state.latestAgent=r.version||null;
  const inst=$("#installerBox");
  if(inst){
   const i=r.installer;
   const local=i&&/^http:\/\/(localhost|127\.)/i.test(i.apiBaseUrl||"");
   inst.innerHTML=i
    ?'<button class="btn btn-primary" data-action="download-installer" data-file="AGENTE-COSTALOG-instalador-'+esc(i.version)+'.zip">⇩ Baixar instalador (versão '+esc(i.version)+')</button><p class="cell-sub">'+(Number(i.size)/1048576).toFixed(1)+' MB · API: '+esc(i.apiBaseUrl||"não informada")+'</p>'+(local?'<p class="cell-sub" style="color:#96620d"><b>Atenção:</b> este instalador aponta para a API local (localhost) e só funciona neste computador. Para os outros PCs, a API precisa estar no servidor com endereço HTTPS.</p>':'')
    :'<button class="btn btn-secondary" disabled>Nenhum instalador publicado</button><p class="cell-sub">Publique uma versão com o script Publish-AgentRelease.ps1.</p>';
  }
  const box=$("#releaseInfo");
  if(box)box.innerHTML=r.version
   ?'Versão publicada: <b>'+esc(r.version)+'</b> · '+(Number(r.size)/1048576).toFixed(1)+' MB · publicada em '+esc(new Date(r.publishedAt).toLocaleString("pt-BR"))+'.<br>Os computadores com versão anterior se atualizam sozinhos em até ~5 minutos.'
   :'Nenhuma versão publicada para atualização automática. Use o script Publish-AgentRelease.ps1 para publicar.';
 }catch(error){
  state.latestAgent=null;
  const box=$("#releaseInfo");
  if(box)box.textContent="Falha ao consultar a versão publicada: "+(error.message||"erro");
 }
}
async function refreshDevices(){
 await refreshRelease();
 const feedback=$("#deviceFeedback");
 if(feedback)feedback.textContent="Consultando dispositivos...";
 try{
  const base=String(cfg.apiBaseUrl||"").replace(/\/+$/,"");
  if(!base||!state.token)throw new Error("Sessao administrativa ou API indisponivel.");
  const data=await fetchJson(base+(cfg.apiPrefix||"/api/v1")+"/admin/devices");
  if(!Array.isArray(data.items))throw new Error("Resposta inesperada da API.");
  state.devices=data.items;
  state.devicesError="";
 }catch(error){
  state.devices=[];
  state.devicesError=error.message||"Falha ao carregar dispositivos.";
 }
 if(state.view==="devices"){
  const grid=$("#deviceGrid");
  if(grid)grid.innerHTML=renderDevices();
  const message=$("#deviceFeedback");
  if(message)message.textContent=state.devicesError||("Dispositivos encontrados: "+state.devices.length);
 }
}function fmtBytes(n){n=Number(n);if(!(n>0))return "—";const u=["B","KB","MB","GB","TB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return n.toFixed(i>=3?1:0)+" "+u[i]}
function fmtDuration(sec){sec=Number(sec);if(!(sec>0))return "—";const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60);return (d?d+"d ":"")+h+"h "+m+"min"}
function sevPill(s){return '<span class="status-pill '+(s==="critical"?"pill-red":s==="warning"?"pill-amber":"pill-gray")+'">'+(s==="critical"?"Crítico":s==="warning"?"Atenção":"Info")+'</span>'}
function healthPill(h){const map={healthy:["Saudável","pill-green"],warning:["Atenção","pill-amber"],unhealthy:["Falha","pill-red"]};const x=map[h]||["Sem dados","pill-gray"];return '<span class="status-pill '+x[1]+'">'+x[0]+'</span>'}
function usageBar(p){p=Math.max(0,Math.min(100,Number(p)||0));return '<div class="progress"><span style="width:'+p+'%;background:'+(p>=90?'#c72b35':p>=80?'#d99a27':'#22a55a')+'"></span></div>'}
function diskType(t){return !t||t==="fixed"?"Disco":t}
function certName(subject){const m=/CN=([^,]+)/i.exec(subject||"");return m?m[1].trim():(subject||"Certificado")}
function certState(notAfter){const t=new Date(notAfter).getTime();if(!t)return["Sem validade","pill-gray"];const days=(t-Date.now())/86400000;return days<0?["Expirado","pill-red"]:days<=30?["Vence em "+Math.ceil(days)+" dias","pill-amber"]:["Válido","pill-green"]}
function deviceLink(id,name){return id?'<button class="action-link" data-device-detail="'+esc(id)+'">'+esc(name||"Computador")+'</button>':'<span class="cell-sub">Painel / administração</span>'}
function failBox(e){return '<div class="card card-pad">Falha ao consultar a API: '+esc(e&&e.message||"erro")+'</div>'}
function eventsTable(list,withDevice){
 if(!list.length)return '<div class="empty-state">Nenhum evento registrado.</div>';
 return '<div class="table-wrap"><table><thead><tr><th>QUANDO</th>'+(withDevice?'<th>COMPUTADOR</th>':'')+'<th>EVENTO</th><th>DETALHE</th><th>NÍVEL</th></tr></thead><tbody>'+
 list.map(e=>'<tr><td>'+esc(formatDeviceDate(e.createdAt))+'</td>'+(withDevice?'<td>'+deviceLink(e.deviceId,e.deviceName)+'</td>':'')+'<td class="cell-main">'+esc(e.title)+'</td><td>'+esc(e.message)+'</td><td>'+sevPill(e.severity)+'</td></tr>').join('')+'</tbody></table></div>';
}
function disksTable(list,withDevice){
 if(!list.length)return '<div class="empty-state">Nenhuma unidade recebida.</div>';
 return '<div class="table-wrap"><table><thead><tr>'+(withDevice?'<th>COMPUTADOR</th>':'')+'<th>UNIDADE</th><th>DISCO</th><th>USO</th><th>LIVRE</th><th>SAÚDE</th><th>TEMPERATURA</th><th>DESGASTE (SSD)</th></tr></thead><tbody>'+
 list.map(k=>'<tr>'+(withDevice?'<td>'+deviceLink(k.deviceId,k.deviceName)+'</td>':'')+'<td><span class="cell-main">'+esc(k.driveLetter)+'</span><span class="cell-sub">'+esc(k.volumeLabel||k.filesystem||"")+'</span></td><td>'+esc(diskType(k.mediaType))+(k.diskModel?'<span class="cell-sub">'+esc(k.diskModel)+'</span>':'')+'</td><td style="min-width:150px">'+usageBar(k.usedPercent)+'<span class="cell-sub">'+Number(k.usedPercent).toFixed(1)+'% de '+fmtBytes(k.totalBytes)+'</span></td><td>'+fmtBytes(k.freeBytes)+'</td><td>'+healthPill(k.smartHealth)+'</td><td>'+(k.temperatureC!=null?Math.round(k.temperatureC)+" °C":"—")+'</td><td>'+(k.wearPercent!=null?Math.round(k.wearPercent)+"% usado":"—")+'</td></tr>').join('')+'</tbody></table></div>';
}
function certTable(list,withDevice){
 if(!list.length)return '<div class="empty-state">Nenhum certificado encontrado.</div>';
 return '<div class="table-wrap"><table><thead><tr>'+(withDevice?'<th>COMPUTADOR</th>':'')+'<th>CERTIFICADO</th><th>EMISSOR</th><th>VÁLIDO ATÉ</th><th>REPOSITÓRIO</th><th>CHAVE PRIVADA</th><th>SITUAÇÃO</th></tr></thead><tbody>'+
 list.map(c=>{const st=certState(c.notAfter);return '<tr>'+(withDevice?'<td>'+esc(c.deviceName||"")+'</td>':'')+'<td><span class="cell-main">'+esc(certName(c.subjectName))+'</span><span class="cell-sub" title="'+esc(c.subjectName)+'">'+esc(String(c.subjectName||"").length>90?String(c.subjectName).slice(0,90)+"…":c.subjectName)+'</span></td><td>'+esc(certName(c.issuerName))+'</td><td>'+esc(c.notAfter?new Date(c.notAfter).toLocaleDateString("pt-BR"):"—")+'</td><td>'+esc(c.storeName)+'</td><td>'+(c.hasPrivateKey?"Sim":"Não")+'</td><td><span class="status-pill '+st[1]+'">'+esc(st[0])+'</span></td></tr>'}).join('')+'</tbody></table></div>';
}
function pageDeviceDetail(){return head("COMPUTADORES","Detalhes do computador","Informações recebidas do agente instalado neste computador.",'<button class="btn btn-secondary btn-small" data-nav="devices">← Voltar</button> <button class="btn btn-secondary btn-small" data-action="refresh-detail">↻ Atualizar</button> <button class="btn btn-secondary btn-small" data-action="uninstall-device" style="color:#c72b35">Desinstalar agente</button>')+'<div id="deviceDetail"><div class="empty-state">Carregando...</div></div>'}
async function refreshDeviceDetail(){
 const box=$("#deviceDetail");if(!box||!state.detailId)return;
 try{
  const r=await fetchJson(apiUrl("/admin/devices/"+encodeURIComponent(state.detailId)));
  if(state.view!=="device-detail")return;
  $("#pageTitle").textContent=r.device.deviceName||"Computador";
  const d=r.device,t=r.telemetry||{},net=t.network||{};
  const memPct=Number(t.memoryTotalBytes)>0?Math.round(t.memoryUsedBytes*100/t.memoryTotalBytes):null;
  const online=d.lastSeenAt&&(Date.now()-new Date(d.lastSeenAt).getTime())<5*60000;
  const crit=r.events.filter(e=>e.severity==="critical").length;
  const info=[["NOME DO COMPUTADOR",d.deviceName],["USUÁRIO",d.username],["DOMÍNIO / GRUPO",d.domainName],["WINDOWS",(d.osCaption||"")+" "+(d.osVersion||"")],["FABRICANTE / MODELO",(d.manufacturer||"")+" "+(d.model||"")],["PROCESSADOR",d.cpuName],["MEMÓRIA RAM",fmtBytes(d.ramTotalBytes)],["TEMPO LIGADO",fmtDuration(t.uptimeSeconds)],["ÚLTIMO BOOT",formatDeviceDate(d.lastBootAt)],["IP",(net.ipv4||[]).join(", ")||d.lastIp],["GATEWAY",(net.gateways||[]).join(", ")],["DNS",(net.dns||[]).slice(0,3).join(", ")],["VERSÃO DO AGENTE",d.agentVersion],["POLÍTICA APLICADA",Number(d.policyRevision)>0?"Revisão "+d.policyRevision:"Nenhuma"],["CADASTRADO EM",formatDeviceDate(d.enrolledAt)]];
  box.innerHTML='<div class="metric-grid">'+
   metric("STATUS",online?"Online":"Offline","Último contato: "+esc(formatDeviceDate(d.lastSeenAt)),"ON")+
   metric("PROCESSADOR",t.cpuPercent!=null?Math.round(t.cpuPercent)+"%":"—","Uso no último envio","CPU")+
   metric("MEMÓRIA",memPct!=null?memPct+"%":"—",esc(fmtBytes(t.memoryUsedBytes)+" de "+fmtBytes(t.memoryTotalBytes)),"RAM")+
   metric("ALERTAS CRÍTICOS",String(crit),"Entre os últimos eventos","!")+'</div>'+
   '<section class="card card-pad">'+cardHead("Identificação","Hardware, Windows e rede")+'<div class="detail-grid">'+info.map(([k,v])=>'<div class="detail-item"><span>'+k+'</span><b>'+esc(v&&String(v).trim()?v:"—")+'</b></div>').join('')+'</div></section><br>'+
   '<section class="card data-card">'+cardHead("Armazenamento e saúde dos discos","Uso, tipo de disco e S.M.A.R.T.")+disksTable(r.disks,false)+'</section><br>'+
   '<section class="card data-card">'+cardHead("Alertas e eventos","Problemas detectados e ações do agente")+eventsTable(r.events,false)+'</section><br>'+
   '<section class="card data-card">'+cardHead("Certificados na máquina","Somente metadados públicos; nenhuma chave privada é copiada")+certTable(r.certificates,false)+'</section>';
 }catch(e){box.innerHTML=failBox(e)}
}
function pageHealth(){return head("DIAGNÓSTICO E MANUTENÇÃO","Saúde dos computadores","Armazenamento, saúde dos discos, erros do Windows e falhas do Office em todos os computadores.",'<button class="btn btn-secondary btn-small" data-action="refresh-health">↻ Atualizar</button>')+'<div id="healthRoot"><div class="empty-state">Carregando...</div></div>'}
async function refreshHealth(){
 const box=$("#healthRoot");if(!box)return;
 try{
  const r=await fetchJson(apiUrl("/admin/health"));
  if(state.view!=="health")return;
  const full=r.disks.filter(k=>Number(k.usedPercent)>=85),bad=r.disks.filter(k=>k.smartHealth==="warning"||k.smartHealth==="unhealthy"),crit=r.events.filter(e=>e.severity==="critical"),office=r.events.filter(e=>/Office/i.test(e.title));
  box.innerHTML='<div class="metric-grid">'+metric("ALERTAS CRÍTICOS",String(crit.length),"Últimos 7 dias","!")+metric("DISCOS ACIMA DE 85%",String(full.length),"Unidades com pouco espaço","D")+metric("FALHAS DO OFFICE",String(office.length),"Últimos 7 dias","O")+metric("DISCOS COM ALERTA",String(bad.length),"Saúde S.M.A.R.T.","S")+'</div>'+
   '<section class="card data-card">'+cardHead("Armazenamento por computador","Todas as unidades, da mais cheia para a mais vazia")+disksTable(r.disks,true)+'</section><br>'+
   '<section class="card data-card">'+cardHead("Problemas detectados","Alertas críticos e de atenção dos últimos 7 dias")+eventsTable(r.events,true)+'</section>';
 }catch(e){box.innerHTML=failBox(e)}
}
function pageCerts(){return head("INVENTÁRIO LOCAL","Certificados presentes na máquina","Metadados públicos dos certificados instalados em cada computador.",'<button class="btn btn-secondary btn-small" data-action="refresh-certs">↻ Atualizar</button>')+
 '<div class="notice-box"><strong>Proteção de certificados:</strong> somente metadados públicos são enviados. Chaves privadas, senhas e arquivos PFX/P12 nunca são coletados. O agente envia o inventário ao iniciar e a cada 1 hora.</div><br><div id="certsRoot"><div class="empty-state">Carregando...</div></div>'}
async function refreshCerts(){
 const box=$("#certsRoot");if(!box)return;
 try{
  const r=await fetchJson(apiUrl("/admin/certificates"));
  if(state.view!=="installed-certs")return;
  state.certs=r.items||[];
  const list=state.certs,exp=list.filter(c=>certState(c.notAfter)[0]==="Expirado").length,soon=list.filter(c=>/^Vence/.test(certState(c.notAfter)[0])).length,keys=list.filter(c=>c.hasPrivateKey).length;
  const pcs=new Set(list.map(c=>c.deviceId)).size;
  box.innerHTML='<div class="metric-grid">'+metric("CERTIFICADOS",String(list.length),"Em "+pcs+" computador(es)","CE")+metric("COM CHAVE PRIVADA",String(keys),"Podem assinar / autenticar","KEY")+metric("VENCENDO EM 30 DIAS",String(soon),"Renovar em breve","!")+metric("EXPIRADOS",String(exp),"Sem validade","X")+'</div>'+
   '<div class="toolbar"><input class="search-input" id="certSearch" placeholder="Pesquisar computador, usuário ou certificado" value="'+esc(state.certQuery||"")+'"></div>'+
   '<section class="card data-card">'+cardHead("Certificados por computador","Clique em um computador para ver os certificados instalados nele")+'<div id="certGroups">'+renderCertGroups()+'</div></section>';
 }catch(e){box.innerHTML=failBox(e)}
}
function renderCertGroups(){
 const q=String(state.certQuery||"").trim().toLowerCase();
 const groups=new Map();
 for(const c of state.certs||[]){
  if(!groups.has(c.deviceId))groups.set(c.deviceId,{id:c.deviceId,name:c.deviceName,user:c.username,items:[]});
  groups.get(c.deviceId).items.push(c);
 }
 const list=[...groups.values()].filter(g=>!q||[g.name,g.user,...g.items.map(c=>c.subjectName+" "+c.storeName)].join(" ").toLowerCase().includes(q));
 if(!list.length)return '<div class="empty-state">'+(q?"Nenhum computador ou certificado encontrado para esta pesquisa.":"Nenhum certificado recebido.")+'</div>';
 return list.map(g=>{
  const states=g.items.map(c=>certState(c.notAfter)[0]);
  const exp=states.filter(x=>x==="Expirado").length,soon=states.filter(x=>/^Vence/.test(x)).length,keys=g.items.filter(c=>c.hasPrivateKey).length;
  return '<details class="cert-group"'+(q?' open':'')+'><summary><span class="device-avatar">PC</span><span><span class="cell-main">'+esc(g.name)+'</span><span class="cell-sub">'+esc(g.user||"")+'</span></span>'+
   '<span class="status-pill pill-gray">'+g.items.length+' certificado(s)</span>'+(keys?'<span class="status-pill pill-green">'+keys+' com chave privada</span>':'')+(soon?'<span class="status-pill pill-amber">'+soon+' vencendo</span>':'')+(exp?'<span class="status-pill pill-red">'+exp+' expirado(s)</span>':'')+
   '<span class="cert-chev">›</span></summary><div class="cert-group-body">'+certTable(g.items,false)+'<div class="cert-group-foot">'+deviceLink(g.id,"Abrir detalhes do computador →")+'</div></div></details>';
 }).join("");
}function pageBrowsing(){
 return head("VISIBILIDADE DE NAVEGAÇÃO","Atividade de navegação","Sites acessados em cada computador: horário, endereço, título da página, navegador e usuário.",'<button class="btn btn-secondary btn-small" data-action="refresh-browsing">↻ Atualizar</button>')+
 '<div class="notice-box"><strong>Transparência:</strong> informe aos funcionários, por escrito, que a navegação nos computadores da empresa é monitorada. O agente lê o histórico do Chrome, Edge, Brave, Opera e Firefox a cada 5 minutos. O histórico fica guardado por 90 dias.</div><br>'+
 '<div class="toolbar"><select class="filter-select" id="browsingDays"><option value="1">Últimas 24 horas</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select><label class="cell-sub" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="browsingOnlyBlocked"> Somente sites bloqueados</label></div>'+
 '<div id="browsingRoot"><div class="empty-state">Carregando...</div></div>';
}
async function refreshBrowsing(){
 const box=$("#browsingRoot");if(!box)return;
 const days=state.browsingDays||1;
 const sel=$("#browsingDays");if(sel)sel.value=String(days);
 try{
  const r=await fetchJson(apiUrl("/admin/browsing/summary?days="+days));
  if(state.view!=="browsing")return;
  const items=r.items||[],active=items.filter(i=>Number(i.visits)>0);
  const visits=items.reduce((a,i)=>a+Number(i.visits||0),0),blockedTotal=items.reduce((a,i)=>a+Number(i.blockedVisits||0),0);
  const chk=$("#browsingOnlyBlocked");if(chk)chk.checked=!!state.browsingOnlyBlocked;
  box.innerHTML='<div class="metric-grid">'+metric("COMPUTADORES COM ATIVIDADE",String(active.length),"de "+items.length+" cadastrados","PC")+metric("PÁGINAS ACESSADAS",String(visits),"No período selecionado","WEB")+metric("SITES BLOQUEADOS",String(blockedTotal),"Acessos e tentativas no período","!")+metric("RETENÇÃO","90 dias","Registros mais antigos são apagados","⟲")+'</div>'+
   '<section class="card data-card">'+cardHead("Navegação por computador","Clique em um computador para ver os sites acessados")+
   (items.length?items.map(i=>'<details class="cert-group browse-group'+(Number(i.blockedVisits)?' has-blocked':'')+'" data-device="'+esc(i.deviceId)+'"><summary><span class="device-avatar">PC</span><span><span class="cell-main">'+esc(i.deviceName)+'</span><span class="cell-sub">'+esc(i.username||"")+'</span></span>'+
    '<span class="status-pill '+(Number(i.visits)?'pill-green':'pill-gray')+'">'+Number(i.visits||0)+' página(s)</span><span class="status-pill pill-gray">'+Number(i.sites||0)+' site(s)</span>'+(Number(i.blockedVisits)?'<span class="status-pill pill-red">'+Number(i.blockedVisits)+' em site bloqueado</span>':'')+(Number(i.blockedAttempts)?'<span class="status-pill pill-red">'+Number(i.blockedAttempts)+' tentativa(s)</span>':'')+'<span class="cell-sub">Último acesso: '+esc(i.lastVisit?formatDeviceDate(i.lastVisit):"—")+'</span><span class="cert-chev">›</span></summary>'+
    '<div class="cert-group-body"><div class="toolbar" style="padding:12px 22px 0"><input class="search-input browse-search" data-device="'+esc(i.deviceId)+'" placeholder="Pesquisar site, título ou endereço"></div><div class="browse-result" data-device="'+esc(i.deviceId)+'"><div class="empty-state">Carregando...</div></div></div></details>').join('')
   :'<div class="empty-state">Nenhum computador cadastrado.</div>')+'</section>';
 }catch(e){box.innerHTML=failBox(e)}
}
async function loadBrowsing(deviceId,q){
 const target=[...document.querySelectorAll(".browse-result")].find(x=>x.dataset.device===deviceId);
 if(!target)return;
 try{
  const r=await fetchJson(apiUrl("/admin/browsing?deviceId="+encodeURIComponent(deviceId)+"&days="+(state.browsingDays||1)+(state.browsingOnlyBlocked?"&blocked=1":"")+(q?"&q="+encodeURIComponent(q):"")));
  const top=(r.topSites||[]).map(t=>'<span class="status-pill '+(Number(t.blocked)?'pill-red':'pill-gray')+'">'+esc(t.hostname)+' · '+Number(t.visits)+'</span>').join(' ');
  target.innerHTML=(top?'<div style="padding:10px 22px;display:flex;flex-wrap:wrap;gap:6px"><b class="cell-sub" style="width:100%">Sites mais acessados</b>'+top+'</div>':'')+
   (r.items.length?'<div class="table-wrap"><table><thead><tr><th>HORÁRIO</th><th>SITE</th><th>ENDEREÇO</th><th>NAVEGADOR</th><th>USUÁRIO</th></tr></thead><tbody>'+
   r.items.map(v=>'<tr'+(Number(v.blocked)?' class="row-blocked"':'')+'><td>'+esc(formatDeviceDate(v.occurredAt))+'</td><td><span class="cell-main">'+esc(v.hostname)+(Number(v.blocked)?' <span class="status-pill pill-red">'+(v.decision==="blocked"?"Tentativa bloqueada":"Site bloqueado")+'</span>':'')+'</span>'+(v.title&&v.decision!=="blocked"?'<span class="cell-sub">'+esc(v.title)+'</span>':'')+'</td><td><span class="cell-sub" title="'+esc(v.url)+'">'+esc(String(v.url||"").length>80?String(v.url).slice(0,80)+"…":v.url)+'</span></td><td>'+esc(v.browser)+'</td><td>'+esc(v.windowsUser)+'</td></tr>').join('')+
   '</tbody></table></div>'+(r.items.length>=300?'<p class="cell-sub" style="padding:8px 22px">Mostrando os 300 acessos mais recentes. Use a pesquisa para filtrar.</p>':''):'<div class="empty-state">Nenhum acesso encontrado no período.</div>');
 }catch(e){target.innerHTML=failBox(e)}
}function pageAudit(){return head("CENTRO DE EVENTOS","Auditoria e alertas","Alertas e eventos separados por computador. As ações feitas no painel ficam em um grupo próprio.",'<button class="btn btn-secondary btn-small" data-action="refresh-audit">↻ Atualizar</button>')+
 '<div class="toolbar"><select class="filter-select" id="auditSeverity"><option value="all">Todos os níveis</option><option value="warning">Críticos e atenção</option><option value="critical">Somente críticos</option></select><select class="filter-select" id="auditDays"><option value="1">Últimas 24 horas</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></div>'+
 '<div id="auditRoot"><div class="empty-state">Carregando...</div></div>'}
function auditQuery(){return "days="+(state.auditDays||7)+"&severity="+(state.auditSeverity||"all")}
async function refreshAudit(){
 const box=$("#auditRoot");if(!box)return;
 const sev=$("#auditSeverity"),days=$("#auditDays");if(sev)sev.value=state.auditSeverity||"all";if(days)days.value=String(state.auditDays||7);
 try{
  const r=await fetchJson(apiUrl("/admin/events/summary?"+auditQuery()));
  if(state.view!=="audit")return;
  const withEvents=r.devices.filter(d=>Number(d.total)>0),without=r.devices.length-withEvents.length;
  const crit=r.devices.reduce((a,d)=>a+Number(d.critical||0),0),warn=r.devices.reduce((a,d)=>a+Number(d.warning||0),0);
  const group=(id,name,sub,d,extra)=>'<details class="cert-group audit-group'+(Number(d.openCritical)?' has-blocked':'')+'" data-device="'+esc(id)+'"><summary><span class="device-avatar">'+(id==="admin"?"TI":"PC")+'</span><span><span class="cell-main">'+esc(name)+'</span><span class="cell-sub">'+esc(sub||"")+'</span></span>'+
   (Number(d.openCritical)?'<span class="status-pill pill-red">'+Number(d.openCritical)+' crítico(s) não lido(s)</span>':'')+(Number(d.critical)?'<span class="status-pill pill-red">'+Number(d.critical)+' crítico(s)</span>':'')+(Number(d.warning)?'<span class="status-pill pill-amber">'+Number(d.warning)+' atenção</span>':'')+'<span class="status-pill pill-gray">'+Number(d.total||0)+' evento(s)</span>'+(extra||'')+
   '<span class="cell-sub">Último: '+esc(d.lastEvent?formatDeviceDate(d.lastEvent):"—")+'</span><span class="cert-chev">›</span></summary><div class="cert-group-body"><div class="audit-result" data-device="'+esc(id)+'"><div class="empty-state">Carregando...</div></div></div></details>';
  box.innerHTML='<div class="metric-grid">'+metric("CRÍTICOS NÃO LIDOS",String(r.openCritical),"Aguardando a TI","!")+metric("CRÍTICOS NO PERÍODO",String(crit),"Em todos os computadores","AL")+metric("ATENÇÃO NO PERÍODO",String(warn),"Em todos os computadores","AT")+metric("COMPUTADORES COM EVENTOS",String(withEvents.length),"de "+r.devices.length+" cadastrados","PC")+'</div>'+
   '<section class="card data-card">'+cardHead("Eventos por computador","Clique em um computador para ver a linha do tempo dele")+
   (withEvents.length?withEvents.map(d=>group(d.deviceId,d.deviceName,d.username,d,d.status==="revoked"?'<span class="status-pill pill-gray">Removido</span>':'')).join(''):'<div class="empty-state">Nenhum evento de computador com estes filtros.</div>')+
   (without?'<p class="cell-sub" style="padding:10px 22px">'+without+' computador(es) sem eventos com estes filtros.</p>':'')+'</section><br>'+
   '<section class="card data-card">'+cardHead("Ações no painel","Alterações feitas pela TI: regras, políticas, senhas, downloads")+
   (Number(r.admin.total)?group("admin","Painel / administração","Equipe de TI",r.admin):'<div class="empty-state">Nenhuma ação no período.</div>')+'</section>';
 }catch(e){box.innerHTML=failBox(e)}
}
async function loadAudit(deviceId){
 const target=[...document.querySelectorAll(".audit-result")].find(x=>x.dataset.device===deviceId);
 if(!target)return;
 try{
  const r=await fetchJson(apiUrl("/admin/events?deviceId="+encodeURIComponent(deviceId)+"&"+auditQuery()+"&limit=300"));
  target.innerHTML=r.items.length?'<div class="table-wrap"><table><thead><tr><th>QUANDO</th><th>EVENTO</th><th>DETALHE</th><th>NÍVEL</th><th></th></tr></thead><tbody>'+
   r.items.map(e=>'<tr'+(e.severity==="critical"&&!e.acknowledgedAt?' class="row-blocked"':'')+'><td>'+esc(formatDeviceDate(e.createdAt))+'</td><td class="cell-main">'+esc(e.title)+'</td><td>'+esc(e.message)+'</td><td>'+sevPill(e.severity)+'</td><td>'+(e.severity==="critical"&&e.deviceId?(e.acknowledgedAt?'<span class="cell-sub">Lido</span>':'<button class="action-link" data-ack-id="'+esc(e.id)+'" data-device="'+esc(deviceId)+'">Marcar como lido</button>'):'')+'</td></tr>').join('')+
   '</tbody></table></div>'+(r.items.length>=300?'<p class="cell-sub" style="padding:8px 22px">Mostrando os 300 eventos mais recentes.</p>':''):'<div class="empty-state">Nenhum evento com estes filtros.</div>';
 }catch(e){target.innerHTML=failBox(e)}
}function pageDownloads(){
 return head("IMPLANTAÇÃO","Download do agente","Baixe o instalador e instale nos computadores dos funcionários. A gestão fica somente neste painel.")+
 '<div class="notice-box"><strong>No computador do funcionário:</strong> é instalado somente o serviço Windows CostalogAgent, em segundo plano. Não há janela, ícone, atalho ou configuração que o funcionário possa alterar. Depois de instalado, o agente se atualiza sozinho.</div><br>'+
 '<div class="download-grid"><article class="card download-card"><div class="download-icon">▣</div><h3>AGENTE COSTALOG — Windows</h3><p>Instalador completo: assistente, serviço, chave pública das políticas e endereço da API.</p><div class="download-meta"><span>Windows 10/11 x64</span><span>Executar como administrador</span></div><div id="installerBox"><button class="btn btn-secondary" disabled>Consultando...</button></div></article></div><br>'+
 '<section class="card card-pad">'+cardHead("Como instalar","Passo a passo em cada computador")+'<div class="detail-grid">'+
 '<div class="detail-item"><span>01 · BAIXAR</span><b>Clique em "Baixar instalador" e copie o arquivo .zip para o computador (pendrive ou pasta da rede).</b></div>'+
 '<div class="detail-item"><span>02 · SENHA</span><b>Crie uma senha de instalação em <button class="action-link" data-nav="agent-settings">Configurações agente</button>. Cada senha vale para um computador.</b></div>'+
 '<div class="detail-item"><span>03 · INSTALAR</span><b>No computador, extraia o .zip, dê dois cliques em INSTALAR.cmd, aceite o aviso de administrador e digite a senha.</b></div>'+
 '<div class="detail-item"><span>04 · CONFERIR</span><b>Em cerca de 1 minuto o computador aparece em <button class="action-link" data-nav="devices">Computadores</button> com o próprio nome.</b></div>'+
 '</div></section><br>'+
 '<section class="card card-pad">'+cardHead("Atualização automática","Versão distribuída automaticamente aos computadores já instalados")+'<div id="releaseInfo" class="cell-sub">Consultando...</div></section>';
}
async function downloadInstaller(button){
 const original=button.textContent;
 button.disabled=true;button.textContent="Baixando...";
 try{
  const res=await fetch(apiUrl("/admin/agent-installer"),{headers:{Authorization:"Bearer "+state.token},credentials:"omit",cache:"no-store"});
  if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.message||"Falha no download: HTTP "+res.status)}
  const blob=await res.blob();
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.download=button.dataset.file||"AGENTE-COSTALOG-instalador.zip";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(link.href),10000);
  toast("Instalador baixado.");
 }catch(error){toast(error.message||"Falha no download.")}
 finally{button.disabled=false;button.textContent=original}
}
function pageAgentSettings(){return head("CONTROLE DO SERVIÇO","Configurações agente","Senhas de instalação e de desinstalação e a proteção do agente nos computadores.")+
'<div class="settings-grid">'+
'<section class="card card-pad">'+cardHead("Senha temporária de instalação","Criada pela TI · uso único")+
'<form id="enrollmentForm" class="form-stack"><div class="field"><label>Senha temporária</label><input name="installationPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="Defina uma senha com pelo menos 8 caracteres"><small>Use pelo menos 8 caracteres, incluindo letras e números. A API guarda somente o hash; a senha não poderá ser recuperada depois.</small></div><div class="field"><label>Perfil definido pela TI</label><select name="installMode"><option value="certificate-and-web" selected>Certificados + política de navegação</option><option value="certificate">Somente inventário de certificados</option></select><small>O perfil fica vinculado à senha e é aplicado no primeiro cadastro do computador.</small></div><div class="field"><label>Validade da senha</label><select name="expiresMinutes"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60" selected>1 hora</option><option value="240">4 horas</option><option value="1440">24 horas</option><option value="0">Nunca expira</option></select></div><div class="field"><label>Utilização</label><input value="Uso único — um computador" disabled></div><button class="btn btn-primary" type="submit">Criar senha de instalação</button><p id="enrollmentFeedback" class="form-feedback" role="status"></p><small class="cell-sub">Depois de criar, compartilhe a senha diretamente com o técnico que fará a instalação. Ela não aparece novamente no painel.</small></form></section>'+
'<section class="card card-pad">'+cardHead("Senha de desinstalação","Exigida pelo DESINSTALAR.cmd em qualquer computador")+
'<div id="uninstallStatus" class="notice-box">Consultando...</div><br>'+
'<form id="uninstallPasswordForm" class="form-stack"><div class="field"><label>Nova senha de desinstalação</label><input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password" placeholder="Pelo menos 8 caracteres, com letras e números"></div><div class="field"><label>Repita a senha</label><input name="confirm" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></div><button class="btn btn-primary" type="submit">Salvar senha de desinstalação</button><p id="uninstallFeedback" class="form-feedback" role="status"></p><small class="cell-sub">A mesma senha vale para todos os computadores. Ela é guardada só como código (hash) e não pode ser vista depois; para trocar, salve uma nova. Cada tentativa com senha errada gera um alerta crítico, e após 5 erros em 15 minutos o computador fica bloqueado para novas tentativas.</small></form></section>'+
'<section class="card card-pad">'+cardHead("Proteção ativa nos computadores","Aplicada e reaplicada automaticamente pelo agente")+
'<div class="switch-row"><div><b>Serviço não pode ser parado nem excluído</b><small>Nem administradores locais conseguem parar, alterar ou excluir o serviço CostalogAgent pelo Windows.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Arquivos e configuração protegidos</b><small>Pastas do agente com dono SYSTEM; administradores só leem. A configuração privada só é acessível ao agente.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Reinício automático e alerta</b><small>Se o processo for finalizado à força, o Windows o reinicia em 5 segundos e o painel recebe um alerta crítico.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Remoção só com autorização</b><small>Somente com a senha de desinstalação (conferida pelo servidor) ou pela ordem "Desinstalar agente" no painel.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="notice-box"><strong>Importante:</strong> um administrador local determinado ainda pode contornar proteções do Windows (por exemplo, tomando posse de arquivos). Para segurança total, retire o privilégio de administrador das contas dos funcionários.</div></section>'+
'<section class="card card-pad">'+cardHead("Como remover o agente","Sempre com autorização da TI")+
'<div class="detail-grid"><div class="detail-item"><span>NO COMPUTADOR</span><b>Execute o DESINSTALAR.cmd (vem no instalador) e digite a senha de desinstalação.</b></div><div class="detail-item"><span>PELO PAINEL</span><b>Em Computadores → Ver detalhes → "Desinstalar agente". A remoção acontece na próxima comunicação (até ~1 minuto).</b></div></div></section>'+
'</div>'}
function pageSettings(){return head("ADMINISTRAÇÃO","Configurações gerais","Integrações de e-mail, perfis de rede, políticas de privacidade, restrições de hardware/software e parâmetros globais.",demoLabel)+
'<div class="settings-grid"><section class="card card-pad">'+cardHead("Monitoramento de e-mail","Conectores corporativos autorizados")+
demo.email.map(m=>'<div class="switch-row"><div><b>'+esc(m.mailbox)+'</b><small>'+esc(m.type)+' · '+esc(m.scope)+' · '+esc(m.last)+'</small></div>'+pill(m.status)+'</div>').join('')+
'<div class="notice-box">Integração futura via Microsoft Graph/Exchange ou IMAP OAuth. Sem coleta de senhas, sem leitura indiscriminada de mensagens pessoais e com escopos delegados, caixas aprovadas e logs.</div></section>'+
'<section class="card card-pad">'+cardHead("Gestão e automação de e-mail","Regras de triagem e notificação")+
'<div class="switch-row"><div><b>Alertas técnicos por e-mail</b><small>Disco, SMART, Office, Windows Update, malware detectado pelo Defender, perda de heartbeat.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div><div class="switch-row"><div><b>Classificação de caixa de TI</b><small>Rótulos e filas de atendimento via API; ações de enviar/excluir exigem permissão explícita.</small></div><label class="toggle"><input type="checkbox" disabled><span></span></label></div></section>'+
'<section class="card card-pad">'+cardHead("Política de rede","Configuração exata de acesso")+
'<div class="form-stack"><div class="field"><label>Perfil de rede</label><select disabled><option>Corporativa gerenciada</option><option>VPN obrigatória</option><option>Rede restrita</option></select></div><div class="field"><label>DNS corporativo</label><input disabled placeholder="Ex.: IP do DNS interno"></div><div class="field"><label>Proxy / PAC</label><input disabled placeholder="URL do PAC, quando aplicável"></div><div class="field"><label>Sub-redes aprovadas</label><input disabled placeholder="CIDR da rede empresarial"></div></div><p class="cell-sub">A aplicação será feita por política Windows/MDM ou agente com privilégios controlados, nunca por alteração furtiva de rota ou credenciais.</p></section>'+
'<section class="card card-pad">'+cardHead("Prevenção de vazamento","USB, instalação de software e dados")+
'<div class="switch-row"><div><b>Bloqueio de armazenamento USB</b><small>Permitir exceções por dispositivo serial aprovado pela TI. Teclado e mouse USB permanecem liberados.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Restringir instalação de programas</b><small>Aplicar Windows App Control/WDAC ou AppLocker conforme edição/versão e política corporativa.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Wallpaper corporativo</b><small>Política de personalização para computadores gerenciados, com exceções aprovadas.</small></div><label class="toggle"><input type="checkbox" disabled><span></span></label></div></section>'+
'<section class="card card-pad">'+cardHead("Privacidade e retenção","Transparência e minimização")+
'<div class="form-stack"><div class="field"><label>Retenção dos eventos de navegação</label><select disabled><option>90 dias (proposta inicial)</option></select></div><div class="field"><label>Granularidade de navegação</label><input disabled value="Domínio + horário + decisão + dispositivo"></div><div class="field"><label>Monitoramento de uso</label><input disabled value="Tempo de sessão, uptime e categorias corporativas"></div></div></section>'+
'<section class="card card-pad">'+cardHead("Alertas e destinatários","Notificação de incidentes")+
'<div class="form-stack"><div class="field"><label>E-mail principal de TI</label><input disabled value="ti@costalog.com.br"></div><div class="field"><label>Alertas críticos</label><input disabled value="Imediatos"></div><div class="field"><label>Resumo operacional</label><input disabled value="Diário"></div></div></section></div>'}
const pages={"overview":pageOverview,"web-blocking":pageWeb,"certificate-rules":pageCertRules,"devices":pageDevices,"health":pageHealth,"installed-certs":pageCerts,"browsing":pageBrowsing,"audit":pageAudit,"downloads":pageDownloads,"device-detail":pageDeviceDetail,"agent-settings":pageAgentSettings,"settings":pageSettings};
function navigate(v){if(!pages[v])return;state.view=v;$("#pageTitle").textContent=titles[v];$$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===v));$("#viewRoot").innerHTML=pages[v]();$("#sidebar").classList.remove("open");if(v==="overview")refreshDashboard();if(v==="devices")refreshDevices();if(v==="web-blocking")refreshRules("web");if(v==="downloads")refreshRelease();if(v==="device-detail")refreshDeviceDetail();if(v==="health")refreshHealth();if(v==="installed-certs")refreshCerts();if(v==="audit")refreshAudit();if(v==="browsing")refreshBrowsing();if(v==="agent-settings")refreshUninstallStatus();if(v==="certificate-rules"){refreshRules("cert");refreshCertUsage()}}
function validHost(h){return /^(?=.{1,253}$)(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(h.trim())}
function publishMessage(res,action){
 if(res&&res.policyRevision)return action+" e publicada (política "+res.policyRevision+"). Os computadores recebem em cerca de 1 minuto.";
 if(res&&res.policyError)return res.policyError;
 return action+".";
}
async function addRule(form,kind){
 const data=Object.fromEntries(new FormData(form));
 const host=String(data.host||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"");
 if(!validHost(host)){toast("Informe um hostname válido, sem caminho ou protocolo.");return}
 if(ruleState[kind].items.some(r=>r.host===host)){toast("Este domínio já está cadastrado.");return}
 const body=kind==="web"
  ?{name:String(data.name||"").trim(),hostname:host,action:data.kind==="allow"?"allow":"block",scopeType:"all",scopeValue:"",enabled:true}
  :{name:String(data.name||"").trim(),hostname:host,certificateScope:data.scope||"managed",enabled:true};
 const button=form.querySelector('button[type="submit"]');
 if(button)button.disabled=true;
 try{
  const saved=await fetchJson(apiUrl(ruleApi[kind]),{method:"POST",body:JSON.stringify(body)});
  form.reset();
  toast(publishMessage(saved,"Regra salva"));
  await refreshRules(kind);
 }catch(error){toast(error.message||"Não foi possível salvar a regra.")}
 finally{if(button)button.disabled=false}
}
async function toggleRule(kind,id){
 const r=ruleState[kind].items.find(x=>x.id===id);
 if(!r)return;
 try{
  const saved=await fetchJson(apiUrl(ruleApi[kind]+"/"+encodeURIComponent(id)),{method:"PATCH",body:JSON.stringify({enabled:!r.enabled})});
  toast(publishMessage(saved,r.enabled?"Regra desativada":"Regra ativada"));
  await refreshRules(kind);
 }catch(error){toast(error.message||"Não foi possível alterar a regra.")}
}
async function deleteRule(kind,id){
 const r=ruleState[kind].items.find(x=>x.id===id);
 if(!r||!confirm("Remover a regra \""+r.name+"\" do servidor?"))return;
 try{
  const saved=await fetchJson(apiUrl(ruleApi[kind]+"/"+encodeURIComponent(id)),{method:"DELETE"});
  toast(publishMessage(saved,"Regra removida"));
  await refreshRules(kind);
 }catch(error){toast(error.message||"Não foi possível remover a regra.")}
}
async function refreshUninstallStatus(){
 const box=$("#uninstallStatus");if(!box)return;
 try{
  const r=await fetchJson(apiUrl("/admin/uninstall-password"));
  box.innerHTML=r.configured?'<strong>Senha definida</strong> em '+esc(formatDeviceDate(r.updatedAt))+'. O DESINSTALAR.cmd já funciona nos computadores.':'<strong>Nenhuma senha definida.</strong> Enquanto não houver senha, o agente só pode ser removido pelo painel.';
 }catch(e){box.textContent="Falha ao consultar: "+(e.message||"erro")}
}
async function saveUninstallPassword(form){
 const fb=form.querySelector("#uninstallFeedback"),pw=form.elements.password.value,cf=form.elements.confirm.value;
 if(pw!==cf){fb.textContent="As senhas não são iguais.";return}
 if(pw.length<8||!/[A-Za-z]/.test(pw)||!/[0-9]/.test(pw)){fb.textContent="Use pelo menos 8 caracteres, com letras e números.";return}
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;fb.textContent="Salvando...";
 try{await fetchJson(apiUrl("/admin/uninstall-password"),{method:"PUT",body:JSON.stringify({password:pw})});form.reset();fb.textContent="Senha de desinstalação salva.";toast("Senha de desinstalação salva.");refreshUninstallStatus()}
 catch(e){fb.textContent=e.message||"Não foi possível salvar."}
 finally{btn.disabled=false}
}
async function uninstallDevice(){
 const name=$("#pageTitle").textContent;
 if(!state.detailId||!confirm("Desinstalar o AGENTE COSTALOG do computador "+name+"?\n\nO bloqueio de sites e o monitoramento deixam de funcionar nele. Para voltar, será preciso instalar de novo."))return;
 try{const r=await fetchJson(apiUrl("/admin/devices/"+encodeURIComponent(state.detailId)+"/uninstall"),{method:"POST"});toast(r.message||"Desinstalação enviada.")}
 catch(e){toast(e.message||"Não foi possível enviar a desinstalação.")}
}
async function createEnrollment(form){
 const feedback=form.querySelector("#enrollmentFeedback");
 const button=form.querySelector('button[type="submit"]');
 const password=form.elements.installationPassword.value;
 const expiresMinutes=Number(form.elements.expiresMinutes.value);
 if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)){feedback.textContent="Use pelo menos 8 caracteres, incluindo letras e números.";return}
 const base=String(cfg.apiBaseUrl||"").replace(/\/+$/,"");
 if(!base){feedback.textContent="A API central ainda não foi configurada. A senha não foi enviada.";return}
 button.disabled=true;feedback.textContent="Registrando a senha temporária...";
 try{
  await fetchJson(base+(cfg.apiPrefix||"/api/v1")+"/admin/enrollment-tokens",{method:"POST",body:JSON.stringify({installationPassword:password,expiresMinutes,installMode:form.elements.installMode.value})});
  feedback.textContent="Senha registrada. Perfil: "+(form.elements.installMode.value==="certificate"?"somente certificados":"certificados + política de navegação")+". Uso único; "+(expiresMinutes===0?"não expira":"expira em "+expiresMinutes+" minutos")+". Compartilhe-a com o técnico responsável; o painel não poderá recuperá-la.";
  toast("Senha temporária registrada no servidor.");
 }catch(error){feedback.textContent=error.message||"Não foi possível registrar a senha."}
 finally{button.disabled=false}
}
async function fetchJson(url,options={}){const res=await fetch(url,{...options,credentials:"omit",cache:"no-store",headers:{"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(state.token?{"Authorization":"Bearer "+state.token}:{}),...(options.headers||{})}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.message||body.error||"Falha na API: HTTP "+res.status);return body}
async function validateAdminSession(token) {
  const base = String(cfg.apiBaseUrl || "").replace(/\/+$/, "");
  if (!base || !token) return false;

  try {
    const response = await fetch(
      base + (cfg.apiPrefix || "/api/v1") + (cfg.adminMePath || "/admin/me"),
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        },
        credentials: "omit",
        cache: "no-store"
      }
    );

    const data = await response.json().catch(() => ({}));

    return response.ok &&
      data.authenticated === true &&
      data.admin?.role === "admin";
  } catch {
    return false;
  }
}

async function adminLogin(username, password) {
  const base = String(cfg.apiBaseUrl || "").replace(/\/+$/, "");

  if (!base) {
    throw new Error("API do AGENTE COSTALOG não configurada.");
  }

  const response = await fetch(
    base + (cfg.apiPrefix || "/api/v1") + (cfg.adminLoginPath || "/auth/login"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      credentials: "omit",
      cache: "no-store",
      body: JSON.stringify({ username, password })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    throw new Error(data.error || data.message || "Usuário ou senha inválidos.");
  }

  if (!await validateAdminSession(data.token)) {
    throw new Error("A API não confirmou a autorização administrativa.");
  }

  state.token = data.token;
  sessionStorage.setItem(tokenKey, data.token);
}

const baseTitle=document.title;
async function checkAlerts(){
 if(!state.token)return;
 try{
  const r=await fetchJson(apiUrl("/admin/alerts"));
  state.alerts=r;
  const n=r.open||0,b=$("#alertsBadge");
  if(b){b.hidden=!n;b.textContent=n>99?"99+":String(n)}
  document.title=(n?"("+n+") ":"")+baseTitle;
  if(state.alertIds){const fresh=r.items.filter(a=>!state.alertIds.has(a.id));if(fresh.length)notifyAlerts(fresh)}
  state.alertIds=new Set(r.items.map(a=>a.id));
  const panel=$("#alertsPanel");if(panel&&!panel.hidden)renderAlertsPanel();
 }catch{}
}
function notifyAlerts(list){
 beep();
 const a=list[0];
 toast("Alerta crítico: "+a.title+" — "+a.deviceName);
 if("Notification" in window&&Notification.permission==="granted"){
  list.slice(0,3).forEach(x=>{try{const n=new Notification("AGENTE COSTALOG · "+x.deviceName,{body:x.title+(x.message?"\n"+x.message:""),tag:x.id,requireInteraction:true});n.onclick=()=>{window.focus();state.detailId=x.deviceId;navigate("device-detail");n.close()}}catch{}});
 }
}
function beep(){try{const C=window.AudioContext||window.webkitAudioContext;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>{o.frequency.value=660},160);setTimeout(()=>{o.stop();c.close()},380)}catch{}}
function renderAlertsPanel(){
 const p=$("#alertsPanel");if(!p)return;
 const r=state.alerts||{open:0,items:[]};
 const perm="Notification" in window?Notification.permission:"unsupported";
 p.innerHTML='<div class="alerts-head"><b>Alertas críticos</b><span class="cell-sub">'+r.open+' não lido(s)</span></div>'+
  (perm==="default"?'<button class="alerts-perm" data-alert="perm">🔔 Ativar avisos na área de trabalho do Windows</button>':perm==="denied"?'<p class="cell-sub alerts-note">Os avisos do Windows estão bloqueados para este site no navegador. Libere em "Configurações do site" → Notificações.</p>':'')+
  (r.items.length?r.items.map(a=>'<div class="alerts-item"><div><b>'+esc(a.title)+'</b><span class="cell-sub">'+esc(a.deviceName)+' · '+esc(formatDeviceDate(a.createdAt))+'</span>'+(a.message?'<span class="cell-sub">'+esc(a.message)+'</span>':'')+'</div><div class="alerts-actions"><button class="action-link" data-alert="open" data-device="'+esc(a.deviceId)+'">Ver computador</button><button class="action-link" data-alert="ack" data-id="'+esc(a.id)+'">Lido</button></div></div>').join(''):'<div class="empty-state">Nenhum alerta crítico pendente.</div>')+
  '<div class="alerts-foot">'+(r.items.length?'<button class="action-link" data-alert="ackall">Marcar todos como lidos</button>':'<span></span>')+'<button class="action-link" data-alert="audit">Ver auditoria →</button></div>';
}
async function ackAlert(id){try{await fetchJson(apiUrl("/admin/alerts/"+encodeURIComponent(id)+"/ack"),{method:"POST"});await checkAlerts()}catch(e){toast(e.message||"Falha ao marcar como lido.")}}
function openApp() {
  $("#authGate").hidden = true;
  $("#app").hidden = false;
  navigate("overview");
  state.alertIds = null;
  checkAlerts();
  clearInterval(state.alertTimer);
  state.alertTimer = setInterval(checkAlerts, 30000);
}

async function start() {

  const stored = sessionStorage.getItem(tokenKey);

  if (stored) {
    try {
      if (await validateAdminSession(stored)) {
        state.token = stored;
        openApp();
        return;
      }
    } catch {}

    sessionStorage.removeItem(tokenKey);
  }

  state.token = null;
  $("#authGate").hidden = false;
  $("#app").hidden = true;
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const button = $("#loginButton");
  const feedback = $("#loginFeedback");

  button.disabled = true;
  button.textContent = "Validando acesso…";
  feedback.textContent = "";

  try {
    await adminLogin(
      $("#username").value.trim(),
      $("#password").value
    );

    $("#password").value = "";
    openApp();
    toast("Acesso ao AGENTE COSTALOG autorizado.");
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Acessar plataforma <span>→</span>';
  }
});

$("#logoutButton").addEventListener("click", async () => {
  const base = String(cfg.apiBaseUrl || "").replace(/\/+$/, "");

  try {
    if (state.token && base) {
      await fetch(
        base + (cfg.apiPrefix || "/api/v1") + (cfg.adminLogoutPath || "/auth/logout"),
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + state.token,
            Accept: "application/json"
          },
          credentials: "omit",
          cache: "no-store"
        }
      );
    }
  } catch {
    // Encerra a sessão local mesmo se a API estiver indisponível.
  } finally {
    state.token = null;
    clearInterval(state.alertTimer);
    document.title = baseTitle;
    sessionStorage.removeItem(tokenKey);
    $("#app").hidden = true;
    $("#authGate").hidden = false;
    toast("Sessão do AGENTE COSTALOG encerrada.");
  }
});
$("#sideNav").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)navigate(b.dataset.view)});
$("#viewRoot").addEventListener("click",e=>{
 const nav=e.target.closest("[data-nav]");
 if(nav){navigate(nav.dataset.nav);return}
 const tog=e.target.closest("[data-toggle-rule]");
 if(tog){toggleRule(tog.dataset.toggleRule,tog.dataset.id);return}
 const del=e.target.closest("[data-delete-rule]");
 if(del){deleteRule(del.dataset.deleteRule,del.dataset.id);return}
 const det=e.target.closest("[data-device-detail]");
 if(det){state.detailId=det.dataset.deviceDetail;navigate("device-detail");return}
 if(e.target.closest('[data-action="refresh-detail"]')){refreshDeviceDetail();return}
 if(e.target.closest('[data-action="uninstall-device"]')){uninstallDevice();return}
 if(e.target.closest('[data-action="refresh-health"]')){refreshHealth();return}
 if(e.target.closest('[data-action="refresh-certs"]')){refreshCerts();return}
 if(e.target.closest('[data-action="refresh-audit"]')){refreshAudit();return}
 const ack=e.target.closest("[data-ack-id]");
 if(ack){(async()=>{await ackAlert(ack.dataset.ackId);loadAudit(ack.dataset.device)})();return}
 if(e.target.closest('[data-action="refresh-browsing"]')){refreshBrowsing();return}
 const dl=e.target.closest('[data-action="download-installer"]');
 if(dl){downloadInstaller(dl);return}
 if(e.target.closest('[data-action="refresh-devices"]')){refreshDevices();return}
 if(e.target.closest('[data-action="refresh"]')){refreshDashboard();return}
});
$("#viewRoot").addEventListener("toggle",e=>{
 const g=e.target;
 if(g.classList&&g.classList.contains("browse-group")&&g.open)loadBrowsing(g.dataset.device,"");
 if(g.classList&&g.classList.contains("audit-group")&&g.open)loadAudit(g.dataset.device);
},true);
$("#viewRoot").addEventListener("input",e=>{
 if(e.target.classList.contains("browse-search")){const id=e.target.dataset.device,v=e.target.value;clearTimeout(loadBrowsing.timer);loadBrowsing.timer=setTimeout(()=>loadBrowsing(id,v.trim()),350);return}
 if(e.target.id==="certSearch"){state.certQuery=e.target.value;const g=$("#certGroups");if(g)g.innerHTML=renderCertGroups();return}
 if(e.target.id==="deviceSearch"){
  state.deviceQuery=e.target.value;
  const grid=$("#deviceGrid");
  if(grid)grid.innerHTML=renderDevices();
 }
});
$("#viewRoot").addEventListener("change",e=>{
 if(e.target.id==="certUsageDays"){state.certUsageDays=Number(e.target.value)||7;refreshCertUsage();return}
 if(e.target.id==="auditSeverity"){state.auditSeverity=e.target.value;refreshAudit();return}
 if(e.target.id==="auditDays"){state.auditDays=Number(e.target.value)||7;refreshAudit();return}
 if(e.target.id==="browsingDays"){state.browsingDays=Number(e.target.value)||1;refreshBrowsing();return}
 if(e.target.id==="browsingOnlyBlocked"){state.browsingOnlyBlocked=e.target.checked;document.querySelectorAll(".browse-group[open]").forEach(g=>loadBrowsing(g.dataset.device,""));return}
 if(e.target.id==="deviceFilter"){
  state.deviceFilter=e.target.value;
  const grid=$("#deviceGrid");
  if(grid)grid.innerHTML=renderDevices();
 }
});$("#viewRoot").addEventListener("submit",e=>{if(e.target.id==="webRuleForm"){e.preventDefault();addRule(e.target,"web")}if(e.target.id==="certRuleForm"){e.preventDefault();addRule(e.target,"cert")}if(e.target.id==="enrollmentForm"){e.preventDefault();createEnrollment(e.target)}if(e.target.id==="uninstallPasswordForm"){e.preventDefault();saveUninstallPassword(e.target)}});
$("#menuButton").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#alertsButton").addEventListener("click",e=>{
 e.stopPropagation();
 const p=$("#alertsPanel");p.hidden=!p.hidden;
 if(!p.hidden){renderAlertsPanel();checkAlerts()}
});
$("#alertsPanel").addEventListener("click",async e=>{
 e.stopPropagation();
 const b=e.target.closest("[data-alert]");if(!b)return;
 const act=b.dataset.alert;
 if(act==="perm"){try{await Notification.requestPermission()}catch{}renderAlertsPanel();return}
 if(act==="open"){$("#alertsPanel").hidden=true;state.detailId=b.dataset.device;navigate("device-detail");return}
 if(act==="ack"){ackAlert(b.dataset.id);return}
 if(act==="ackall"){try{await fetchJson(apiUrl("/admin/alerts/ack-all"),{method:"POST"});await checkAlerts();toast("Alertas marcados como lidos.")}catch(err){toast(err.message||"Falha.")}return}
 if(act==="audit"){$("#alertsPanel").hidden=true;state.auditSeverity="critical";navigate("audit")}
});
document.addEventListener("click",()=>{const p=$("#alertsPanel");if(p)p.hidden=true});
$("#environmentBadge").addEventListener("click",()=>toast(state.apiReady?"Conectado à API. Os indicadores vêm do banco de dados.":"API não conectada: nenhum dado real está sendo exibido."));
start();
})();