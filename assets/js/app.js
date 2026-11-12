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
const titles={"overview":"Visão geral","web-blocking":"Bloqueio de sites","certificate-rules":"Sites para certificados","devices":"Computadores","health":"Saúde dos computadores","installed-certs":"Certificados na máquina","browsing":"Atividade de navegação","audit":"Auditoria e alertas","downloads":"Download do agente","agent-settings":"Configurações agente","settings":"Configurações gerais"};
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
function pageWeb(){return head("POLÍTICAS DE NAVEGAÇÃO","Bloqueio de sites","Crie regras por domínio, grupo de computadores ou dispositivo. A implementação real dependerá da extensão gerenciada e de política de rede.",'<span class="status-pill pill-gray">SALVO NO SERVIDOR · NÃO PUBLICADO</span>')+
'<div class="rule-info"><strong>Negar por padrão ou lista de bloqueio:</strong> defina o perfil corporativo em Configurações gerais. Regras de exceção sempre precisam de aprovação da TI. As regras ficam salvas no servidor, mas só chegam aos computadores quando uma política for publicada. O bloqueio efetivo ainda depende do agente e da extensão gerenciada.</div>'+
'<section class="card card-pad">'+cardHead("Nova regra de navegação","Adicione domínio e ação")+
'<form id="webRuleForm" class="rule-form"><div class="field"><label>Nome da regra</label><input name="name" required maxlength="90" placeholder="Ex.: Jogos online"></div><div class="field"><label>Domínio (hostname)</label><input name="host" required maxlength="253" placeholder="exemplo.com.br"></div><div class="field"><label>Ação</label><select name="kind"><option value="block">Bloquear site</option><option value="allow">Permitir exceção</option></select></div><button class="btn btn-primary" type="submit">＋ Adicionar regra</button></form>'+cardHead("Regras cadastradas","Políticas de navegação")+'<div id="webRuleList">'+ruleList("web")+'</div></section>'}
function pageCertRules(){return head("POLÍTICA DE CERTIFICADOS","Sites para certificados","Determine em quais domínios o uso de certificados digitais pode ser autorizado, separado do controle geral de navegação.",'<span class="status-pill pill-gray">SALVO NO SERVIDOR · NÃO PUBLICADO</span>')+
'<div class="notice-box"><strong>Importante:</strong> esta lista define a política desejada. O bloqueio efetivo do uso da chave privada exige integração com o provedor criptográfico do Windows (CNG/KSP) e teste por portal. A extensão do navegador, sozinha, não controla todas as chamadas nativas.</div><br>'+
'<section class="card card-pad">'+cardHead("Adicionar destino autorizado","Domínio permitido no contexto de uso de certificado")+
'<form id="certRuleForm" class="rule-form"><div class="field"><label>Nome</label><input name="name" required maxlength="90" placeholder="Portal fiscal"></div><div class="field"><label>Domínio</label><input name="host" required maxlength="253" placeholder="portal.exemplo.gov.br"></div><div class="field"><label>Grupo de certificados</label><select name="scope"><option value="e-cnpj">Certificados e-CNPJ</option><option value="fiscal">Certificados fiscais</option><option value="managed" selected>Todos os certificados gerenciados</option><option value="custom">Grupo específico</option></select></div><button class="btn btn-primary" type="submit">＋ Autorizar domínio</button></form>'+cardHead("Lista de autorização","Destinos com uso permitido")+'<div id="certRuleList">'+ruleList("cert")+'</div></section>'}
function pageDevices(){
 return head("COMPUTADORES","Inventario de dispositivos","Dispositivos cadastrados e informacoes recebidas pela API.")+
 '<div class="toolbar"><input class="search-input" id="deviceSearch" placeholder="Pesquisar dispositivo, usuario ou IP"><select class="filter-select" id="deviceFilter"><option value="all">Todos os estados</option><option value="active">Ativos</option><option value="disabled">Desativados</option><option value="revoked">Revogados</option></select><button class="action-link" data-action="refresh-devices">Atualizar</button></div>'+
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
  const label=status==="active"?"Ativo":status==="disabled"?"Desativado":status==="revoked"?"Revogado":"Desconhecido";
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
   '<div><span>VERSAO DO AGENTE</span><b>'+esc(d.agentVersion||"Nao informado")+'</b></div>'+
   '</div><div class="device-card-foot"><span>Status: '+esc(label)+'</span></div></article>';
 }).join("");
}

async function refreshDevices(){
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
}function pageHealth(){
 return head("DIAGNOSTICO E MANUTENCAO","Saude dos computadores","Indicadores de armazenamento, hardware, Windows e Microsoft Office.")+
 '<div class="notice-box"><strong>Telemetria ainda nao disponivel.</strong><br>Nenhum agente Windows esta enviando dados reais para esta tela. Os indicadores serao exibidos quando a coleta estiver implementada e os computadores estiverem conectados.</div><br>'+
 '<div class="metric-grid">'+
 metric("ALERTAS CRITICOS","--","Aguardando dados reais","! ")+
 metric("DISCOS ACIMA DE 85%","--","Aguardando dados de armazenamento","D")+
 metric("OFFICE COM ALERTA","--","Aguardando diagnostico do Office","O")+
 metric("SSD COM SAUDE BAIXA","--","Aguardando dados S.M.A.R.T.","S")+
 '</div>'+
 '<div class="split-grid">'+
 '<section class="card card-pad">'+cardHead("Uso de armazenamento","Analise por computador e unidade")+
 '<div class="empty-state">Nenhum dado de armazenamento recebido.</div>'+
 '<p class="cell-sub">A coleta futura podera apresentar espaco total, espaco utilizado e espaco livre por unidade.</p></section>'+
 '<section class="card card-pad">'+cardHead("Unidades e saude SSD","Diagnostico de discos")+
 '<div class="empty-state">Nenhum dado de saude de disco recebido.</div>'+
 '<p class="cell-sub">A disponibilidade de temperatura e vida util depende do hardware e do suporte S.M.A.R.T.</p></section></div>'+
 '<section class="card data-card">'+cardHead("Problemas detectados","Eventos reais do Windows e do Microsoft Office")+
 '<div class="empty-state">Nenhum evento recebido. Isso nao significa que nao existam problemas no computador.</div></section><br>'+
 '<section class="card card-pad">'+cardHead("Manutencao agendada","Rotinas que poderao ser configuradas pela TI")+
 '<div class="notice-box">As rotinas ainda nao estao implementadas. Nenhuma manutencao sera executada automaticamente.</div>'+
 '<div class="switch-row"><div><b>Analise de armazenamento</b><small>Levantamento de uso de disco e diretorios autorizados.</small></div><label class="toggle"><input type="checkbox" disabled><span></span></label></div>'+
 '<div class="switch-row"><div><b>Otimizacao de unidades</b><small>Operacao condicionada ao tipo de unidade e aprovacao da TI.</small></div><label class="toggle"><input type="checkbox" disabled><span></span></label></div>'+
 '<div class="switch-row"><div><b>Verificacao do Microsoft Office</b><small>Monitoramento de versoes, atualizacoes e eventos de falha.</small></div><label class="toggle"><input type="checkbox" disabled><span></span></label></div></section>'
}function pageCerts(){
 return head("INVENTARIO LOCAL","Certificados presentes na maquina","Inventario dos metadados publicos dos certificados instalados nos computadores.")+
 '<div class="notice-box"><strong>Protecao de certificados:</strong> somente metadados tecnicos publicos poderao ser enviados. Chaves privadas, senhas e arquivos PFX/P12 nunca devem ser coletados ou exportados pelo agente.</div><br>'+
 '<section class="card card-pad">'+
 cardHead("Certificados detectados","Inventario recebido dos computadores")+
 '<div class="empty-state">Nenhum certificado recebido.</div>'+
 '<p class="cell-sub">Os certificados aparecerao aqui quando o agente Windows estiver implementado, conectado e autorizado a enviar os metadados publicos.</p>'+
 '</section>'
}function pageBrowsing(){
 return head("VISIBILIDADE DE NAVEGACAO","Atividade de navegacao","Registro de dominios, horarios, dispositivos e decisoes das politicas.")+
 '<div class="notice-box"><strong>Privacidade e transparencia:</strong> o monitoramento deve ser informado aos usuarios e limitado a finalidade corporativa. Nao coletamos conteudo de paginas, formularios, senhas ou cookies.</div><br>'+
 '<section class="card data-card">'+
 cardHead("Eventos de navegacao","Registros recebidos dos computadores")+
 '<div class="empty-state">Nenhum evento de navegacao recebido.</div>'+
 '<p class="cell-sub">Os registros aparecerao aqui quando o agente Windows estiver implementado, conectado e autorizado a enviar eventos.</p>'+
 '</section>'
}function pageAudit(){
 return head("CENTRO DE EVENTOS","Auditoria e alertas","Historico de alteracoes administrativas, eventos de seguranca e alertas dos dispositivos.")+
 '<div class="metric-grid">'+
 metric("EVENTOS HOJE","--","Aguardando registros reais","EV")+
 metric("BLOQUEIOS","--","Aguardando eventos de bloqueio","BL")+
 metric("INTEGRIDADE","--","Aguardando verificacoes","IN")+
 metric("ALERTAS CRITICOS","--","Aguardando alertas reais","AL")+
 '</div>'+
 '<section class="card data-card">'+
 cardHead("Linha do tempo de seguranca","Eventos registrados pela API")+
 '<div class="empty-state">Nenhum evento de auditoria recebido.</div>'+
 '</section><br>'+
 '<section class="card data-card">'+
 cardHead("Fila de alertas por e-mail","Configuracao de notificacoes")+
 '<div class="notice-box">O envio de e-mails ainda nao esta configurado. Nenhuma notificacao foi enviada ou esta aguardando envio.</div>'+
 '<div class="empty-state">Nenhuma notificacao registrada.</div>'+
 '</section>'
}function pageDownloads(){
 const downloadUrl=String(cfg.agentDownloadUrl||"");
 const hasDownload=downloadUrl.toLowerCase().startsWith("https://");
 const downloadAction=hasDownload?'<a class="btn btn-primary" href="'+esc(downloadUrl)+'" target="_blank" rel="noopener">Baixar pacote Windows</a>':'<button class="btn btn-secondary" disabled>Download será liberado após a publicação</button>';
 return head("IMPLANTAÇÃO","Download do agente","Baixe o pacote que será instalado nos computadores dos funcionários. A interface de gestão permanece somente no portal administrativo.",hasDownload?'<span class="status-pill pill-green">Pacote publicado</span>':'<span class="status-pill pill-amber">Aguardando configuração</span>')+
 '<div class="notice-box"><strong>Como será no computador do funcionário:</strong> somente o serviço Windows CostalogAgent será instalado e executado em segundo plano. Não haverá painel local, janela de monitoramento, ícone, atalho ou configurações para o funcionário alterar. A senha temporária e o perfil de proteção são definidos pela TI no portal.</div><br>'+
 '<div class="download-grid"><article class="card download-card"><div class="download-icon">▣</div><h3>AGENTE COSTALOG — Windows</h3><p>Pacote de implantação com serviço em segundo plano, assistente protegido e scripts de instalação e remoção autorizada.</p><div class="download-meta"><span>Windows 10/11 x64</span><span>Instalação administrativa</span></div>'+downloadAction+'</article></div><br>'+
 '<section class="card card-pad">'+cardHead("Pré-requisitos para liberar o download","Validação automática na publicação")+'<div class="detail-grid"><div class="detail-item"><span>01 · API</span><b>URL HTTPS da API e banco MariaDB operacionais</b></div><div class="detail-item"><span>02 · ASSINATURA</span><b>Chave privada protegida no servidor e chave pública no pacote</b></div><div class="detail-item"><span>03 · SENHA</span><b>Senha temporária criada pela TI, com uso único e expiração</b></div><div class="detail-item"><span>04 · HOMOLOGAÇÃO</span><b>Teste de instalação, telemetria, política e recuperação</b></div></div></section>';
}
function pageAgentSettings(){return head("CONTROLE DO SERVIÇO","Configurações agente","Gerencie parâmetros de instalação, acesso local de suporte, autorização de remoção e política antiviolação.",demoLabel)+
'<div class="notice-box"><strong>Instalação dos funcionários:</strong> o computador recebe somente um serviço Windows em segundo plano, sem painel, ícone, atalho ou interface de gestão. A TI define o modo de proteção e cria uma senha temporária, de uso único e com validade limitada. O funcionário não escolhe as configurações.</div><br>'+
'<div class="settings-grid"><section class="card card-pad">'+cardHead("Política de integridade","Controles de proteção do serviço")+
'<div class="switch-row"><div><b>Impedir parada por usuário padrão</b><small>O serviço roda com identidade de serviço e ACLs restritas. Administradores autorizados mantêm recuperação documentada.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Exigir aprovação para desinstalação</b><small>Solicitação registrada no endpoint; aprovação central emite token assinado, individual e com validade curta.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Detectar alteração de arquivos do agente</b><small>Verificação de assinatura, hash, serviço, extensão e estado da política.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div>'+
'<div class="switch-row"><div><b>Alertar perda de comunicação</b><small>Alerta quando heartbeat excede o limite configurado.</small></div><label class="toggle"><input type="checkbox" checked disabled><span></span></label></div></section>'+
'<section class="card card-pad">'+cardHead("Autorização de remoção","Solicitações pendentes de demonstração")+
'<div class="empty-state">Nenhuma solicitação real recebida. O agente ainda não está instalado.</div>'+
'<div class="notice-box">Quando implantado, cada autorização deverá indicar dispositivo, solicitante, motivo, aprovador, prazo e resultado. Não haverá remoção silenciosa nem bloqueio absoluto contra recuperação por TI com acesso físico.</div></section>'+
'<section class="card card-pad">'+cardHead("Senha temporária de instalação","Criada pela TI · uso único")+
'<form id="enrollmentForm" class="form-stack"><div class="field"><label>Senha temporária</label><input name="installationPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="Defina uma senha com pelo menos 8 caracteres"><small>Use pelo menos 8 caracteres, incluindo letras e números. A API guarda somente o hash; a senha não poderá ser recuperada depois.</small></div><div class="field"><label>Perfil definido pela TI</label><select name="installMode"><option value="certificate-and-web" selected>Certificados + política de navegação</option><option value="certificate">Somente inventário de certificados</option></select><small>O perfil fica vinculado à senha e é aplicado no primeiro cadastro do computador.</small></div><div class="field"><label>Validade da senha</label><select name="expiresMinutes"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60" selected>1 hora</option><option value="240">4 horas</option><option value="1440">24 horas</option><option value="0">Nunca expira</option></select></div><div class="field"><label>Utilização</label><input value="Uso único — um computador" disabled></div><button class="btn btn-primary" type="submit">Criar senha de instalação</button><p id="enrollmentFeedback" class="form-feedback" role="status"></p><small class="cell-sub">Depois de criar, compartilhe a senha diretamente com o técnico que fará a instalação. Ela não aparece novamente no painel.</small></form></section>'+
'<section class="card card-pad">'+cardHead("Acesso local de suporte","Autenticação administrativa por dispositivo")+
'<div class="form-stack"><div class="field"><label>Método recomendado</label><input value="Aprovação central + token curto + registro" disabled></div><div class="field"><label>Senha compartilhada</label><input value="Não armazenada em texto puro" disabled></div><p class="cell-sub">Acesso cotidiano aos controles do agente fica bloqueado para usuários comuns. Recuperação de TI será documentada e auditada.</p></div></section></div>'}
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
const pages={"overview":pageOverview,"web-blocking":pageWeb,"certificate-rules":pageCertRules,"devices":pageDevices,"health":pageHealth,"installed-certs":pageCerts,"browsing":pageBrowsing,"audit":pageAudit,"downloads":pageDownloads,"agent-settings":pageAgentSettings,"settings":pageSettings};
function navigate(v){if(!pages[v])return;state.view=v;$("#pageTitle").textContent=titles[v];$$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===v));$("#viewRoot").innerHTML=pages[v]();$("#sidebar").classList.remove("open");if(v==="overview")refreshDashboard();if(v==="devices")refreshDevices();if(v==="web-blocking")refreshRules("web");if(v==="certificate-rules")refreshRules("cert");}
function validHost(h){return /^(?=.{1,253}$)(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(h.trim())}
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
  await fetchJson(apiUrl(ruleApi[kind]),{method:"POST",body:JSON.stringify(body)});
  form.reset();
  toast("Regra salva no servidor. Ela só chega aos computadores após a publicação da política.");
  await refreshRules(kind);
 }catch(error){toast(error.message||"Não foi possível salvar a regra.")}
 finally{if(button)button.disabled=false}
}
async function toggleRule(kind,id){
 const r=ruleState[kind].items.find(x=>x.id===id);
 if(!r)return;
 try{
  await fetchJson(apiUrl(ruleApi[kind]+"/"+encodeURIComponent(id)),{method:"PATCH",body:JSON.stringify({enabled:!r.enabled})});
  toast(r.enabled?"Regra desativada no servidor.":"Regra ativada no servidor.");
  await refreshRules(kind);
 }catch(error){toast(error.message||"Não foi possível alterar a regra.")}
}
async function deleteRule(kind,id){
 const r=ruleState[kind].items.find(x=>x.id===id);
 if(!r||!confirm("Remover a regra \""+r.name+"\" do servidor?"))return;
 try{
  await fetchJson(apiUrl(ruleApi[kind]+"/"+encodeURIComponent(id)),{method:"DELETE"});
  toast("Regra removida do servidor.");
  await refreshRules(kind);
 }catch(error){toast(error.message||"Não foi possível remover a regra.")}
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

function openApp() {
  $("#authGate").hidden = true;
  $("#app").hidden = false;
  navigate("overview");
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
 if(e.target.closest('[data-action="refresh-devices"]')){refreshDevices();return}
 if(e.target.closest('[data-action="refresh"]')){refreshDashboard();return}
});
$("#viewRoot").addEventListener("input",e=>{
 if(e.target.id==="deviceSearch"){
  state.deviceQuery=e.target.value;
  const grid=$("#deviceGrid");
  if(grid)grid.innerHTML=renderDevices();
 }
});
$("#viewRoot").addEventListener("change",e=>{
 if(e.target.id==="deviceFilter"){
  state.deviceFilter=e.target.value;
  const grid=$("#deviceGrid");
  if(grid)grid.innerHTML=renderDevices();
 }
});$("#viewRoot").addEventListener("submit",e=>{if(e.target.id==="webRuleForm"){e.preventDefault();addRule(e.target,"web")}if(e.target.id==="certRuleForm"){e.preventDefault();addRule(e.target,"cert")}if(e.target.id==="enrollmentForm"){e.preventDefault();createEnrollment(e.target)}});
$("#menuButton").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#alertsButton").addEventListener("click",()=>navigate("audit"));
$("#environmentBadge").addEventListener("click",()=>toast(state.apiReady?"Conectado à API. Os indicadores vêm do banco de dados.":"API não conectada: nenhum dado real está sendo exibido."));
start();
})();