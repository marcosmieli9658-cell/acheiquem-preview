import { createStore } from './data.js';

const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = (name, size = 20) => window.AQIcons?.(name,size) || '';
const brandMark = '<span class="aq-logo"><img src="../assets/brand-reference.webp" alt="Achei Quem" width="1536" height="1024"></span>';
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(value) || 0)/100);
const date = value => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value.length === 10 ? `${value}T12:00:00` : value)) : 'Não informado';
const day = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const statusNames = {pending:'Em análise',approved:'Aprovado',rejected:'Não aprovado',active:'Ativo',inactive:'Inativo',cancelled:'Cancelado',paid:'Pago',overdue:'Em atraso',resolved:'Resolvido'};
const badge = (status, label) => `<span class="tag ${esc(status)}">${esc(label || statusNames[status] || status)}</span>`;
const list = value => Array.isArray(value) ? value : [];
const nameFor = id => state.data.professionals.find(p => p.id === id)?.name || 'Sem vínculo';
const categoryFor = id => state.data.categories.find(c => c.id === id)?.name || 'Categoria indisponível';
const txState = transaction => transaction.status === 'pending' && transaction.dueOn < day() ? 'overdue' : transaction.status;
const txBadge = transaction => badge(txState(transaction),txState(transaction) === 'pending' ? 'A vencer' : transaction.status === 'paid' ? transaction.direction === 'income' ? 'Recebido' : 'Pago' : undefined);
const initials = name => String(name || 'AQ').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const safePhoto = url => {if(!url)return '';try{const parsed=new URL(url,location.href);return ['https:','http:'].includes(parsed.protocol) && (parsed.protocol==='https:' || parsed.origin===location.origin) ? parsed.href : '';}catch{return '';}};
const photo = (person, extra = '') => Number.isInteger(person.photoIndex) && person.photoUrl === '../assets/professionals.png' ? `<span class="profile-photo sprite-photo ${extra}" role="img" aria-label="Retrato ilustrativo de ${esc(person.name)}" style="background-position:${(person.photoIndex % 3) * 50}% ${Math.floor(person.photoIndex / 3) * 100}%"></span>` : safePhoto(person.photoUrl) ? `<img class="profile-photo ${extra}" src="${esc(safePhoto(person.photoUrl))}" alt="Foto de ${esc(person.name)}" width="84" height="84" decoding="async" loading="lazy" referrerpolicy="no-referrer">` : `<span class="profile-photo profile-fallback ${extra}" aria-label="${esc(person.name)}">${esc(initials(person.name))}</span>`;
const allCities = () => [...new Set([...state.data.professionals.map(p=>p.city),...state.data.clients.map(c=>c.city)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR'));
const options = (values, selected, emptyLabel = 'Todas') => `<option value="">${emptyLabel}</option>${values.map(value=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(value)}</option>`).join('')}`;
const splitValues = value => [...new Set(String(value||'').split(',').map(v=>v.trim()).filter(Boolean))];
const empty = (title, body, name='search') => `<div class="empty">${icon(name,30)}<h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
let unsubscribeAuth = null;
let authCheckTimer = null;
let authEpoch = 0;
let storeSelection = 0;
let connectedStorePromise = null;
function connectedStore() {
  if(!connectedStorePromise) {
    connectedStorePromise=createStore(window.AQCRM_CONFIG||{},{demo:false}).catch(error=>{
      connectedStorePromise=null;
      throw error;
    });
  }
  return connectedStorePromise;
}
const state = {store:null,session:null,data:{professionals:[],clients:[],categories:[],categoryRequests:[],transactions:[],audit:[]},initializing:false,loading:false,error:'',loginError:'',noticeTimer:null,menu:false,filters:{professionals:{query:'',city:'',status:'',subscription:''},clients:{query:'',city:'',status:''},finance:{direction:'',status:'',city:'',month:''}}};
const navItems = [
  ['visao-geral','Visão geral','brick'],['cadastros','Cadastros','user'],['categorias','Categorias','filter'],['financeiro','Financeiro','calendar'],['cidades','Cidades','pin'],['historico','Histórico','clock']
];
function currentRoute(){const raw=location.hash.slice(1)||'/visao-geral';const [path,search='']=raw.split('?');return {path,params:new URLSearchParams(search)};}
function go(path){if(location.hash==='#'+path)render();else location.hash=path;}
function notify(message){clearTimeout(state.noticeTimer);const el=document.querySelector('#notice');el.textContent=message;el.classList.add('visible');state.noticeTimer=setTimeout(()=>el.classList.remove('visible'),5000);}
function pendingRequests(id){return state.data.categoryRequests.filter(r=>r.professionalId===id && r.status==='pending');}
function professionalDebt(id){return state.data.transactions.filter(t=>t.professionalId===id&&t.direction==='income'&&t.kind==='subscription'&&txState(t)==='overdue');}
function accounting(transactions){return transactions.reduce((result,t)=>{if(t.status==='cancelled')return result;if(t.status==='paid')result[t.direction==='income'?'received':'paid']+=t.amountCents;else{result[t.direction==='income'?'receivable':'payable']+=t.amountCents;if(txState(t)==='overdue'&&t.direction==='income')result.overdue+=t.amountCents;}return result;},{received:0,paid:0,receivable:0,payable:0,overdue:0});}
function formError(form,message){const error=form.querySelector('.form-error');if(error){error.textContent=message;error.hidden=false;error.focus();}else notify(message);}
function field(label, name, value='', options={}){return `<label class="field ${options.full?'full':''}"><span>${label}</span><input name="${name}" type="${options.type||'text'}" ${options.type==='email'?'spellcheck="false" autocapitalize="none"':''} value="${esc(value)}" ${options.required?'required':''} ${options.min?`min="${esc(options.min)}"`:''} ${options.max?`max="${esc(options.max)}"`:''} ${options.step?`step="${esc(options.step)}"`:''} ${options.placeholder?`placeholder="${esc(options.placeholder)}"`:''} ${options.autocomplete?`autocomplete="${esc(options.autocomplete)}"`:''}>${options.help?`<small class="help">${options.help}</small>`:''}</label>`;}
function formErrorBox(){return '<p class="error form-error" role="alert" tabindex="-1" hidden></p>';}
function paymentField(selected='other'){return `<label class="field"><span>Forma de pagamento</span><select name="paymentMethod">${[['other','A definir / outra'],['pix','Pix'],['transfer','Transferência'],['cash','Dinheiro'],['card','Cartão']].map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('')}</select></label>`;}
function title(title, subtitle, action=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action?`<div class="button-row">${action}</div>`:''}</div>`;}
function stat(label,value,note,kind=''){return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value numeric ${kind}">${value}</div><div class="stat-note">${note}</div></div>`;}
function login(){
  const configured=Boolean(window.AQCRM_CONFIG?.supabaseUrl&&window.AQCRM_CONFIG?.publishableKey);
  app.innerHTML=`<div class="login-page"><aside class="login-brand-panel"><a href="../" class="aq-brand login-brand" aria-label="Achei Quem — voltar ao site">${brandMark}</a><div><h2>Seu ponto de encontro com a <span class="login-brand-accent">operação.</span></h2><p>Cadastros, categorias e financeiro em um só lugar.</p></div><p class="small">Vale do Paraíba · São Paulo</p></aside><main id="content" class="login-main" tabindex="-1"><div class="login-card"><h1>Acesso administrativo</h1><p>Entre com a conta autorizada da equipe Achei Quem.</p><form id="login-form">${field('E-mail','email','',{type:'email',required:true,autocomplete:'username'})}${field('Senha','password','',{type:'password',required:true,autocomplete:'current-password'})}<p class="error form-error" role="alert" tabindex="-1" ${state.loginError?'':'hidden'}>${esc(state.loginError)}</p><button class="btn btn-primary" type="submit" ${!configured?'disabled':''}>Entrar no painel ${icon('arrow',18)}</button>${!configured?'<p class="help">O acesso com conta será habilitado após a configuração do Supabase. Por enquanto, você pode explorar a demonstração abaixo.</p>':''}</form><a class="text-link login-back" href="./redefinir-senha.html">Esqueci minha senha</a><div class="login-divider"><p class="help">Conheça o painel com dados fictícios. Nenhuma alteração da demonstração é enviada ao banco.</p><button type="button" class="btn btn-soft" data-demo>Explorar demonstração ${icon('arrow',18)}</button></div><a class="text-link login-back" href="../">Voltar para o site</a></div></main></div>`;
}
function shell(content){
  const {path}=currentRoute();const active=path.includes('profissional')?'cadastros':path.includes('lancamento')?'financeiro':path.split('/')[1];
  const pending=state.data.professionals.filter(p=>p.status==='pending').length;
  const who=state.store.mode==='demo'?'Equipe de demonstração':state.session?.user?.email || 'Administrador';
  app.innerHTML=`${state.menu?'<button class="sidebar-scrim" data-menu-close aria-label="Fechar navegação"></button>':''}<aside class="sidebar ${state.menu?'open':''}" id="sidebar" ${state.menu?'role="dialog" aria-modal="true" aria-label="Navegação administrativa"':''}><a href="#/visao-geral" class="aq-brand sidebar-brand" aria-label="Achei Quem — visão geral">${brandMark}</a><button class="icon-btn sidebar-close" data-menu-close aria-label="Fechar navegação">${icon('close')}</button><p class="workspace-label">PAINEL ADMINISTRATIVO</p><nav aria-label="Administração">${navItems.map(([id,label,ico])=>`<a class="nav-item ${active===id?'active':''}" href="#/${id}" ${active===id?'aria-current="page"':''}>${icon(ico,19)}${label}${id==='cadastros'&&pending?`<span class="nav-count">${pending}<span class="sr-only"> em análise</span></span>`:''}</a>`).join('')}</nav><div class="sidebar-bottom"><a href="../">${icon('arrow',17)} Abrir o site</a><p>Uma operação organizada.<br>Mais gente se encontrando.</p></div></aside><div class="workspace" ${state.menu?'inert':''}><header class="topbar"><div class="topbar-left"><button class="icon-btn menu-toggle" data-menu aria-label="Abrir navegação" aria-controls="sidebar" aria-expanded="${state.menu}">${icon('menu')}</button><span>Achei Quem / Administração</span></div><div class="topbar-user"><span class="avatar-initial" aria-hidden="true">${state.store.mode==='demo'?'AQ':esc(initials(who))}</span><div><div class="user-name">${esc(who)}</div><div class="user-subtitle">${state.store.mode==='demo'?'Ambiente demonstrativo':'Acesso da equipe'}</div></div><button class="btn btn-small" data-logout>${icon('logout',17)} Sair</button></div></header>${state.store.mode==='demo'?`<div class="mode-banner">${icon('info',17)}<span><strong>Demonstração.</strong> Dados fictícios. As alterações ficam apenas nesta sessão e não chegam ao Supabase.</span></div>`:''}<main id="content" class="content" tabindex="-1">${content}</main></div>`;
}
function dashboard(){
  const pending=state.data.professionals.filter(p=>p.status==='pending');
  const total=accounting(state.data.transactions);const active=state.data.professionals.filter(p=>p.subscriptionStatus==='active').length;
  return `${title('Visão geral','Acompanhe os próximos passos da operação e o movimento financeiro.',`<button class="btn" data-refresh>${icon('clock',17)} Atualizar</button><a class="btn btn-primary" href="#/lancamento">${icon('plus',18)} Novo lançamento</a>`)}<div class="stats">${stat('Profissionais cadastrados',state.data.professionals.length,`${state.data.clients.length} clientes cadastrados`)}${stat('Aguardando análise',pending.length,'Cadastros que precisam da equipe',pending.length?'warning':'')}${stat('Assinaturas ativas',active,'Situação independente da aprovação')}${stat('Recebimentos em atraso',money(total.overdue),'Valores pendentes após o vencimento',total.overdue?'warning':'')}</div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Cadastros para analisar</h2><p>Confira os dados antes de aprovar.</p></div><a class="text-link small" href="#/cadastros">Ver todos ${icon('arrow',16)}</a></div>${pending.length?`<ul class="queue-list">${pending.slice(0,4).map(p=>`<li class="queue-row">${photo(p)}<div class="queue-info"><strong>${esc(p.name)}</strong><p>${esc(p.city)} · ${list(p.categories).map(categoryFor).map(esc).join(', ')||'Categoria a definir'}</p>${pendingRequests(p.id).length?'<span class="tag request">Solicitou nova categoria</span>':''}</div><a class="btn btn-small" href="#/profissional/${esc(p.id)}">Analisar ${icon('chevron',15)}</a></li>`).join('')}</ul>`:empty('Nenhum cadastro aguardando análise','Os novos pedidos de profissionais aparecerão aqui.','check')}<div class="section-note">Prazo previsto para análise: até 72 horas úteis. A regra de contagem será definida antes do lançamento.</div></section><section class="panel"><div class="panel-head"><div><h2>Movimento financeiro</h2><p>Todos os lançamentos registrados</p></div></div><div class="panel-body"><div class="balance-lines"><div class="balance-line"><span>Entradas recebidas</span><strong class="numeric">${money(total.received)}</strong></div><div class="balance-line"><span>Saídas pagas</span><strong class="numeric">${money(total.paid)}</strong></div><div class="balance-line total"><span>Saldo dos lançamentos</span><strong class="numeric">${money(total.received-total.paid)}</strong></div></div><p class="balance-note">Não inclui saldo inicial de caixa. Valores previstos ficam separados dos recebidos e pagos.</p><a class="text-link" href="#/financeiro">Abrir financeiro ${icon('arrow',17)}</a></div></section></div><section class="panel"><div class="panel-head"><div><h2>Últimas movimentações</h2><p>Histórico das ações administrativas</p></div><a class="text-link small" href="#/historico">Ver histórico ${icon('arrow',16)}</a></div><div class="panel-body">${activity(state.data.audit.slice(0,5))}</div></section>`;
}
function activity(items){return items.length?`<ul class="activity-list">${items.map(item=>`<li class="activity-item"><span class="activity-dot"></span><div><p>${esc(auditLabel(item))}</p><small>${date(item.createdAt)} · ${esc(item.actorName || 'Equipe administrativa')}</small></div></li>`).join('')}</ul>`:empty('O histórico começa com a primeira ação','Aprovações e movimentações financeiras ficarão registradas aqui.','clock');}
function auditLabel(item){const entity=String(item.entity||'').replace(/^aq_/,'');const entities={professionals:'Profissional',professional:'Profissional',categories:'Categoria',category:'Categoria',transactions:'Lançamento',transaction:'Lançamento',category_requests:'Solicitação de categoria',categoryRequests:'Solicitação de categoria',clients:'Cliente'};const actions={insert:'criado',update:'atualizado',delete:'removido',INSERT:'criado',UPDATE:'atualizado',DELETE:'removido',created:'criado',updated:'atualizado',approved:'aprovado',rejected:'não aprovado',paid:'pago',cancelled:'cancelado',resolved:'resolvido'};return item.description || `${entities[entity]||entity||'Registro'} ${actions[item.action]||item.action||'atualizado'}${entity==='professionals'&&nameFor(item.entityId)!=='Sem vínculo'?` · ${nameFor(item.entityId)}`:''}`;}
function registrationList(){
  const {params}=currentRoute();const type=params.get('type')==='clients'?'clients':'professionals';const filters=state.filters[type];
  const items=state.data[type].filter(p=>(!filters.query||normalize(`${p.name} ${p.email}`).includes(normalize(filters.query)))&&(!filters.city||p.city===filters.city)&&(!filters.status||p.status===filters.status)&&(!filters.subscription||(filters.subscription==='overdue'?professionalDebt(p.id).length>0:p.subscriptionStatus===filters.subscription)));
  const statuses=type==='clients'?['active','inactive']:['pending','approved','rejected'];
  return `${title('Cadastros','Clientes e profissionais, com aprovação e assinatura tratadas separadamente.',type==='professionals'?`<a class="btn btn-primary" href="#/novo-profissional">${icon('plus',18)} Adicionar profissional</a>`:'')}<div class="tabs"><a class="tab ${type==='professionals'?'active':''}" href="#/cadastros">Profissionais <span>${state.data.professionals.length}</span></a><a class="tab ${type==='clients'?'active':''}" href="#/cadastros?type=clients">Clientes <span>${state.data.clients.length}</span></a></div><section class="panel"><form class="filters" data-filter="${type}"><label class="field search"><span>Buscar cadastro</span><input name="query" value="${esc(filters.query)}" placeholder="Nome ou e-mail"></label><label class="field"><span>Cidade de cadastro</span><select name="city">${options(allCities(),filters.city,'Todas as cidades')}</select></label><label class="field"><span>${type==='clients'?'Situação da conta':'Aprovação'}</span><select name="status"><option value="">Todas</option>${statuses.map(s=>`<option value="${s}" ${filters.status===s?'selected':''}>${statusNames[s]}</option>`).join('')}</select></label>${type==='professionals'?`<label class="field"><span>Assinatura / cobrança</span><select name="subscription"><option value="">Todas</option>${['active','inactive','cancelled','overdue'].map(s=>`<option value="${s}" ${filters.subscription===s?'selected':''}>${statusNames[s]}</option>`).join('')}</select></label>`:''}<button class="btn" type="submit">${icon('filter',16)} Filtrar</button></form><div class="filter-summary">${items.length} ${items.length===1?'cadastro encontrado':'cadastros encontrados'}</div>${items.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">${type==='clients'?'Cliente':'Profissional'}</th><th scope="col">Cidade</th><th scope="col">${type==='clients'?'Conta':'Aprovação'}</th>${type==='professionals'?'<th scope="col">Assinatura</th>':''}<th scope="col">Cadastro</th>${type==='professionals'?'<th scope="col"><span class="sr-only">Ações</span></th>':''}</tr></thead><tbody>${items.map(p=>`<tr><td><div class="table-person">${type==='professionals'?photo(p):''}<div><strong>${esc(p.name)}</strong><span class="subline">${esc(p.email||'Sem e-mail')}</span></div></div></td><td>${esc(p.city||'Não informada')}</td><td>${badge(p.status)}${type==='professionals'&&pendingRequests(p.id).length?'<span class="subline">Nova categoria pendente</span>':''}</td>${type==='professionals'?`<td>${badge(p.subscriptionStatus||'inactive')}${professionalDebt(p.id).length?'<span class="subline">Mensalidade em atraso</span>':''}</td>`:''}<td>${date(p.createdAt)}</td>${type==='professionals'?`<td class="actions-cell"><a href="#/profissional/${esc(p.id)}" class="btn btn-small">Abrir ${icon('chevron',14)}</a></td>`:''}</tr>`).join('')}</tbody></table></div>`:empty('Nenhum cadastro com esses filtros','Tente outro nome, cidade ou situação para encontrar o cadastro.')}<div class="section-note">${type==='clients'?'Clientes usam a plataforma gratuitamente. Uma conta de cliente não é uma assinatura inadimplente.':'Um profissional pode atender várias cidades e atuar em mais de uma categoria. A aprovação cadastral não confirma pagamento.'}</div></section>`;
}
function profileDetail(id){
  const p=state.data.professionals.find(p=>p.id===id);if(!p)return empty('Cadastro não encontrado','Volte para a lista de cadastros e escolha um profissional.');
  const requests=pendingRequests(id);const hasPhoto=Boolean(p.photoUrl)||Number.isInteger(p.photoIndex);const checks=[[hasPhoto,'Foto de perfil'],[Boolean(p.name?.trim()),'Nome informado'],[String(p.description||'').trim().length>=30,'Descrição com pelo menos 30 caracteres'],[list(p.skills).length>0,'Trabalhos e habilidades'],[list(p.categories).length>0,'Categoria definida'],[list(p.cities).length>0,'Cidades de atendimento'],[requests.length===0,'Sem pedido de categoria pendente']];const ready=checks.every(([ok])=>ok);const transactions=state.data.transactions.filter(t=>t.professionalId===id);
  return `<a href="#/cadastros" class="back-link">${icon('chevron',15)} Voltar aos cadastros</a>${title('Analisar cadastro','Confira as informações e as categorias antes da decisão.',`<a class="btn" href="#/editar-profissional/${esc(id)}">Editar informações</a>`)}<div class="detail-grid"><section class="panel"><div class="panel-body"><div class="detail-profile">${photo(p)}<div><h2>${esc(p.name)}</h2><div class="tags">${badge(p.status)}${badge(p.subscriptionStatus||'inactive',`Assinatura ${statusNames[p.subscriptionStatus||'inactive'].toLowerCase()}`)}</div></div></div><dl class="detail-list"><div><dt>Cidade de cadastro</dt><dd>${esc(p.city)}</dd></div><div><dt>Cadastrado em</dt><dd>${date(p.createdAt)}</dd></div><div><dt>E-mail</dt><dd>${esc(p.email||'Não informado')}</dd></div><div><dt>Telefone</dt><dd>${esc(p.phone||'Não informado')}</dd></div><div class="wide"><dt>Descrição</dt><dd>${esc(p.description||'Descrição pendente')}</dd></div><div class="wide"><dt>Trabalhos e habilidades</dt><dd><div class="tags">${list(p.skills).map(s=>`<span class="tag">${esc(s)}</span>`).join('')||'Não informados'}</div></dd></div><div class="wide"><dt>Categorias</dt><dd><div class="tags">${list(p.categories).map(c=>`<span class="tag">${esc(categoryFor(c))}</span>`).join('')||'Não definidas'}</div></dd></div><div class="wide"><dt>Cidades atendidas</dt><dd>${list(p.cities).map(esc).join(', ')||'Não informadas'}</dd></div>${p.notes?`<div class="wide"><dt>Observações da equipe</dt><dd>${esc(p.notes)}</dd></div>`:''}</dl>${requests.length?`<div class="inline-alert"><strong>Solicitação de categoria</strong>${requests.map(r=>esc(r.name)).join(', ')}<br><a class="text-link" href="#/categorias">Criar ou vincular categoria ${icon('arrow',15)}</a></div>`:''}</div></section><div><section class="panel"><div class="panel-head"><h2>Revisão da equipe</h2></div><div class="panel-body"><ul class="review-checklist">${checks.map(([ok,label])=>`<li>${icon(ok?'check':'info',18)}<span class="${ok?'ok':'missing'}">${esc(label)}</span></li>`).join('')}</ul><form id="decision-form" data-id="${esc(id)}">${formErrorBox()}<label class="field"><span>Observação ou pendência</span><textarea name="notes" placeholder="Registre o que precisa ser ajustado…">${esc(p.notes||'')}</textarea></label><p class="help" style="margin-top:8px">A observação fica no cadastro. Esta ação não envia mensagem ao profissional.</p><div class="form-actions"><button class="btn btn-primary" type="submit" name="decision" value="approved" ${!ready||p.status==='approved'?'disabled':''}>${icon('check',17)} Aprovar</button><button class="btn" type="submit" name="decision" value="pending">Registrar pendência</button><button class="btn btn-danger" type="submit" name="decision" value="rejected" ${p.status==='rejected'?'disabled':''}>Não aprovar</button></div></form></div></section><section class="panel"><div class="panel-head"><h2>Financeiro do profissional</h2></div><div class="panel-body"><p class="small muted">${transactions.length} ${transactions.length===1?'lançamento vinculado':'lançamentos vinculados'} · ${professionalDebt(id).length} em atraso</p><a class="text-link" href="#/lancamento?professional=${esc(id)}">Registrar mensalidade ${icon('plus',17)}</a><p class="help">A assinatura é controlada separadamente da aprovação do cadastro.</p></div></section></div></div>`;
}
function professionalForm(id){const p=state.data.professionals.find(p=>p.id===id)||{categories:[],cities:[],skills:[],subscriptionStatus:'inactive'};return `<a href="${id?'#/profissional/'+esc(id):'#/cadastros'}" class="back-link">${icon('chevron',15)} Voltar</a>${title(id?'Editar profissional':'Adicionar profissional','Registro administrativo. O cadastro será analisado antes de uma aprovação.')}<section class="panel"><div class="panel-body"><form id="professional-form" data-id="${esc(id||'')}">${formErrorBox()}<div class="form-grid">${field('Nome completo','name',p.name,{required:true})}${field('E-mail','email',p.email,{type:'email',required:true})}${field('Telefone','phone',p.phone)}${field('Cidade de cadastro','city',p.city,{required:true})}${field('Cidades atendidas','cities',list(p.cities).join(', '),{full:true,required:true,help:'Separe as cidades por vírgulas.'})}<label class="field full"><span>Descrição profissional</span><textarea name="description" required minlength="30">${esc(p.description||'')}</textarea><small class="help">Pelo menos 30 caracteres.</small></label>${field('Trabalhos e habilidades','skills',list(p.skills).join(', '),{required:true,full:true,help:'Separe as habilidades por vírgulas.'})}${field('Endereço da foto','photoUrl',p.photoUrl?.startsWith('../assets/')?'':p.photoUrl,{type:'url',full:true,help:state.store.mode==='demo'&&p.photoUrl?.startsWith('../assets/')?'A foto ilustrativa atual será preservada se este campo ficar vazio.':'URL HTTPS da foto autorizada. O envio de arquivos será conectado na etapa de cadastros.'})}<fieldset class="full" style="border:0;padding:0;margin:0"><legend style="font-size:.84rem;font-weight:800;margin-bottom:10px">Categorias</legend><div class="tags">${state.data.categories.filter(c=>c.active!==false).map(c=>`<label class="field-inline"><input type="checkbox" name="categories" value="${esc(c.id)}" ${list(p.categories).includes(c.id)?'checked':''}>${esc(c.name)}</label>`).join('')}</div></fieldset><label class="field"><span>Situação da assinatura</span><select name="subscriptionStatus">${['inactive','active','cancelled'].map(s=>`<option value="${s}" ${p.subscriptionStatus===s?'selected':''}>${statusNames[s]}</option>`).join('')}</select><small class="help">Controle manual, separado dos recebimentos.</small></label><label class="field full"><span>Observações da equipe</span><textarea name="notes">${esc(p.notes||'')}</textarea></label></div><div class="form-actions"><button class="btn btn-primary" type="submit">Salvar cadastro</button><a class="btn" href="${id?'#/profissional/'+esc(id):'#/cadastros'}">Cancelar edição</a></div></form></div></section>`;}
function categoriesPage(){const requests=state.data.categoryRequests.filter(r=>r.status==='pending');return `${title('Categorias','Organize as especialidades e resolva os pedidos enviados com os cadastros.')}<div class="detail-grid"><div><section class="panel"><div class="panel-head"><div><h2>Solicitações de nova categoria</h2><p>${requests.length} aguardando análise</p></div></div>${requests.length?requests.map(r=>`<article class="request-card"><div class="request-top"><div><h3>${esc(r.name)}</h3><p>Solicitada por ${esc(nameFor(r.professionalId))}</p></div>${badge('pending','Pendente')}</div><form data-category-request="${esc(r.id)}">${formErrorBox()}<label class="field"><span>Vincular a uma categoria existente</span><select name="categoryId" required><option value="">Escolha uma categoria</option>${state.data.categories.filter(c=>c.active!==false).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><button class="btn btn-primary" type="submit">Vincular</button></form><p class="help" style="margin-top:12px">Se ela ainda não existir, crie a categoria no formulário ao lado e depois vincule este pedido. O cadastro continuará aguardando sua aprovação.</p></article>`).join(''):empty('Nenhuma categoria pendente','Pedidos de novas especialidades aparecerão nesta lista.','check')}</section><section class="panel"><div class="panel-head"><h2>Categorias cadastradas</h2><span class="tag">${state.data.categories.length}</span></div>${state.data.categories.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Categoria</th><th>Profissionais</th><th>Situação</th></tr></thead><tbody>${state.data.categories.map(c=>`<tr><td><strong>${esc(c.name)}</strong><span class="subline">${esc(c.description||'Sem descrição')}</span></td><td class="numeric">${state.data.professionals.filter(p=>list(p.categories).includes(c.id)).length}</td><td>${badge(c.active===false?'inactive':'active')}</td></tr>`).join('')}</tbody></table></div>`:empty('Comece pelas especialidades','Adicione as categorias que serão usadas nos cadastros.','filter')}</section></div><section class="panel" style="align-self:start"><div class="panel-head"><h2>Criar categoria</h2></div><div class="panel-body"><form id="category-form">${formErrorBox()}<div class="form-grid">${field('Nome da categoria','name','',{required:true,full:true,placeholder:'Ex.: Jardinagem'})}<label class="field full"><span>Descrição</span><textarea name="description" placeholder="Quais serviços pertencem a esta categoria?"></textarea></label></div><div class="form-actions"><button class="btn btn-primary" type="submit">${icon('plus',17)} Criar categoria</button></div></form></div></section></div>`;}
function financeRows(){const f=state.filters.finance;return state.data.transactions.filter(t=>(!f.direction||t.direction===f.direction)&&(!f.status||txState(t)===f.status)&&(!f.city||state.data.professionals.find(p=>p.id===t.professionalId)?.city===f.city)&&(!f.month||(t.status==='paid'?t.paidOn:t.dueOn)?.startsWith(f.month))).sort((a,b)=>b.dueOn.localeCompare(a.dueOn));}
function financePage(){const f=state.filters.finance;const transactions=financeRows();const total=accounting(transactions);return `${title('Financeiro','Controle os valores previstos, os recebimentos e as despesas do Achei Quem.',`<a class="btn btn-primary" href="#/lancamento">${icon('plus',18)} Novo lançamento</a>`)}<div class="stats">${stat('Entradas recebidas',money(total.received),'Valores efetivamente recebidos','income')}${stat('Saídas pagas',money(total.paid),'Valores efetivamente pagos','expense')}${stat('Saldo dos lançamentos',money(total.received-total.paid),'Recebido menos pago, sem saldo inicial')}${stat('A receber',money(total.receivable),`${money(total.overdue)} em atraso`,total.overdue?'warning':'')}</div><section class="panel"><form class="filters" data-filter="finance"><label class="field"><span>Tipo</span><select name="direction"><option value="">Entradas e saídas</option><option value="income" ${f.direction==='income'?'selected':''}>Entradas</option><option value="expense" ${f.direction==='expense'?'selected':''}>Saídas</option></select></label><label class="field"><span>Situação</span><select name="status"><option value="">Todas</option><option value="pending" ${f.status==='pending'?'selected':''}>A vencer</option><option value="overdue" ${f.status==='overdue'?'selected':''}>Em atraso</option><option value="paid" ${f.status==='paid'?'selected':''}>Recebido / pago</option><option value="cancelled" ${f.status==='cancelled'?'selected':''}>Cancelado</option></select></label><label class="field"><span>Cidade do profissional</span><select name="city">${options(allCities(),f.city,'Todas')}</select></label><label class="field"><span>Mês</span><input type="month" name="month" value="${esc(f.month)}"></label><button class="btn" type="submit">${icon('filter',16)} Filtrar</button><button class="btn" type="button" data-clear-finance>Limpar</button></form><div class="filter-summary">${transactions.length} lançamentos · ${money(total.payable)} a pagar. Filtro de mês considera pagamento nos realizados e vencimento nos pendentes.</div>${transactions.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Lançamento</th><th scope="col">Vencimento</th><th scope="col">Valor</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>${transactions.map(t=>`<tr><td><strong>${esc(t.description)}</strong><span class="subline">${t.direction==='income'?'Entrada':'Saída'} · ${t.professionalId?esc(nameFor(t.professionalId)):t.kind==='expense'?'Despesa da plataforma':'Outras receitas'}</span></td><td class="numeric">${date(t.dueOn)}${t.paidOn?`<span class="subline">${t.direction==='income'?'Recebido':'Pago'} em ${date(t.paidOn)}</span>`:''}</td><td class="amount ${t.direction}">${t.direction==='income'?'+':'−'} ${money(t.amountCents)}</td><td>${txBadge(t)}</td><td class="actions-cell"><a class="btn btn-small" href="#/lancamento?id=${esc(t.id)}">${t.status==='pending'?'Gerenciar':'Detalhes'} ${icon('chevron',14)}</a></td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum lançamento encontrado','Registre uma entrada ou saída, ou ajuste os filtros para visualizar outro período.','calendar')}<div class="section-note">Controle manual, sem gateway conectado. Valores de serviços negociados entre clientes e profissionais não entram como receita da plataforma.</div></section>`;}
function transactionForm(){const {params}=currentRoute();const id=params.get('id');const existing=state.data.transactions.find(t=>t.id===id);if(id&&!existing)return empty('Lançamento não encontrado','Volte ao financeiro e escolha outro registro.');const t=existing||{direction:'income',kind:params.has('professional')?'subscription':'other',professionalId:params.get('professional')||'',dueOn:day(),status:'pending'};const readonly=Boolean(existing&&existing.status!=='pending');return `<a href="#/financeiro" class="back-link">${icon('chevron',15)} Voltar ao financeiro</a>${title(existing?'Gerenciar lançamento':'Novo lançamento','Registre a previsão e confirme a movimentação somente quando o valor for recebido ou pago.')}<section class="panel"><div class="panel-body">${readonly?`<div class="readiness">${icon('info',20)}<span>Este lançamento está ${t.status==='paid'?'confirmado':'cancelado'} e foi preservado no histórico. ${t.paidOn?`Data do pagamento: ${date(t.paidOn)}.`:''}</span></div>`:''}<form id="transaction-form" data-id="${esc(id||'')}">${formErrorBox()}<fieldset ${readonly?'disabled':''} style="border:0;padding:0;margin:0"><div class="form-grid"><label class="field"><span>Tipo de movimentação</span><select name="direction"><option value="income" ${t.direction==='income'?'selected':''}>Entrada</option><option value="expense" ${t.direction==='expense'?'selected':''}>Saída</option></select></label><label class="field"><span>Categoria financeira</span><select name="kind"><option value="subscription" ${t.kind==='subscription'?'selected':''}>Mensalidade profissional</option><option value="expense" ${t.kind==='expense'?'selected':''}>Despesa da plataforma</option><option value="other" ${t.kind==='other'?'selected':''}>Outra receita</option></select></label>${field('Descrição','description',t.description,{required:true,full:true,placeholder:'Ex.: Mensalidade de novembro'})}${field('Valor em reais','amount',t.amountCents ? (t.amountCents/100).toFixed(2) : '',{type:'number',required:true,min:'0.01',max:'9999999.99',step:'0.01'})}${field('Vencimento','dueOn',t.dueOn,{type:'date',required:true})}<label class="field"><span>Profissional vinculado</span><select name="professionalId"><option value="">Sem vínculo</option>${state.data.professionals.map(p=>`<option value="${esc(p.id)}" ${t.professionalId===p.id?'selected':''}>${esc(p.name)} · ${esc(p.city)}</option>`).join('')}</select></label>${paymentField(t.paymentMethod)}<label class="field full"><span>Observações</span><textarea name="notes">${esc(t.notes||'')}</textarea></label></div></fieldset>${!readonly?`<div class="form-actions"><button class="btn btn-primary" type="submit">Salvar ${existing?'alterações':'previsão'}</button><a class="btn" href="#/financeiro">Cancelar edição</a></div>`:''}</form>${existing&&t.status==='pending'?`<form id="settle-form" data-id="${esc(t.id)}" class="edit-panel" style="margin-top:30px;border-top:1px solid var(--line);padding-top:26px"><h2>${t.direction==='income'?'Confirmar recebimento':'Confirmar pagamento'}</h2><p class="help" style="margin:8px 0 20px">Esta ação registra a baixa integral de ${money(t.amountCents)} e mantém o histórico.</p>${formErrorBox()}<div class="form-grid">${field('Data da movimentação','paidOn',day(),{type:'date',required:true,max:day()})}</div><div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check',17)} Confirmar ${t.direction==='income'?'recebimento':'pagamento'}</button></div></form><form id="cancel-transaction-form" data-id="${esc(t.id)}" style="border-top:1px solid var(--line);padding-top:22px">${formErrorBox()}<label class="field-inline"><input type="checkbox" name="confirmed" required>Quero cancelar esta previsão, mantendo o registro no histórico.</label><button class="btn btn-danger" type="submit" style="margin-top:15px">Cancelar lançamento</button></form>`:''}</div></section>`;}
function citiesPage(){const cities=[...new Set([...allCities(),...state.data.professionals.flatMap(p=>list(p.cities))])].sort((a,b)=>a.localeCompare(b,'pt-BR'));const max=Math.max(1,...cities.map(city=>state.data.professionals.filter(p=>p.city===city).length));return `${title('Cidades','Veja onde estão os cadastros e quais regiões os profissionais atendem.')}<div class="stats">${stat('Cidades com cadastros',allCities().length,'Cidades de base de clientes ou profissionais')}${stat('Profissionais únicos',state.data.professionals.length,'Cada profissional é contado uma vez')}${stat('Clientes únicos',state.data.clients.length,'Cada cliente é contado uma vez')}${stat('Cidades atendidas',new Set(state.data.professionals.flatMap(p=>list(p.cities))).size,'Cobertura declarada pelos profissionais')}</div><section class="panel"><div class="panel-head"><div><h2>Distribuição dos cadastros</h2><p>A cidade de base é diferente da área de atendimento.</p></div></div>${cities.length?`<div class="table-scroll"><table class="data-table city-table"><thead><tr><th scope="col">Cidade</th><th scope="col">Profissionais de base</th><th scope="col">Clientes</th><th scope="col">Aprovados</th><th scope="col">Assinaturas ativas</th><th scope="col">Atendem a cidade</th></tr></thead><tbody>${cities.map(city=>{const pros=state.data.professionals.filter(p=>p.city===city);return `<tr><td><strong>${esc(city)}</strong><span class="city-bar"><span style="width:${Math.round(pros.length/max*100)}%"></span></span></td><td class="numeric">${pros.length}</td><td class="numeric">${state.data.clients.filter(c=>c.city===city).length}</td><td class="numeric">${pros.filter(p=>p.status==='approved').length}</td><td class="numeric">${pros.filter(p=>p.subscriptionStatus==='active').length}</td><td class="numeric">${state.data.professionals.filter(p=>list(p.cities).includes(city)).length}</td></tr>`;}).join('')}</tbody></table></div>`:empty('Os cadastros vão desenhar este mapa','Os indicadores aparecerão quando houver clientes e profissionais cadastrados.','pin')}<div class="legend">O total geral conta pessoas únicas. A coluna “Atendem a cidade” pode incluir a mesma pessoa em mais de um município.</div></section>`;}
function historyPage(){return `${title('Histórico','Acompanhe o registro das ações administrativas realizadas na plataforma.')}<section class="panel"><div class="panel-head"><h2>Atividades registradas</h2><span class="tag">${state.data.audit.length}</span></div><div class="panel-body">${activity(state.data.audit)}</div></section>`;}
function render(){
  document.body.classList.toggle('navigation-open',Boolean(state.menu));
  if(state.initializing){app.innerHTML=`<main id="content" class="boot" aria-busy="true"><span class="aq-brand">${brandMark}</span><p role="status">Verificando seu acesso…</p></main>`;return;}
  if(!state.session){login();return;}
  if(state.loading){shell('<div aria-busy="true"><div class="skeleton-title"></div><section class="panel"><div class="loading-rows"><span class="loading-line"></span><span class="loading-line"></span><span class="loading-line"></span><span class="loading-line"></span></div></section><p class="help">Carregando informações do painel…</p></div>');return;}
  if(state.error){shell(`<section class="page-error"><h1>Não foi possível carregar o painel</h1><p>${esc(state.error)}</p><button class="btn btn-primary" data-refresh>Tentar novamente</button></section>`);return;}
  const {path}=currentRoute();let content;
  if(path==='/visao-geral'||path==='/')content=dashboard();
  else if(path==='/cadastros')content=registrationList();
  else if(path.startsWith('/profissional/'))content=profileDetail(path.split('/')[2]);
  else if(path==='/novo-profissional')content=professionalForm();
  else if(path.startsWith('/editar-profissional/'))content=professionalForm(path.split('/')[2]);
  else if(path==='/categorias')content=categoriesPage();
  else if(path==='/financeiro')content=financePage();
  else if(path==='/lancamento')content=transactionForm();
  else if(path==='/cidades')content=citiesPage();
  else if(path==='/historico')content=historyPage();
  else content=`${empty('Página não encontrada','Use a navegação para acessar uma área do painel.')}<a class="text-link" href="#/visao-geral">Voltar à visão geral</a>`;
  shell(content);document.title=`${({cadastros:'Cadastros',categorias:'Categorias',financeiro:'Financeiro',cidades:'Cidades',historico:'Histórico'}[path.split('/')[1]])||'Administração'} | Achei Quem`;
}
function clearPrivateState(message='Sua sessão foi encerrada. Entre novamente para continuar.', initializing=false) {
  authEpoch++;
  storeSelection++;
  clearTimeout(authCheckTimer);
  authCheckTimer=null;
  unsubscribeAuth?.();
  unsubscribeAuth=null;
  state.session=null;
  state.initializing=initializing;
  state.data={professionals:[],clients:[],categories:[],categoryRequests:[],transactions:[],audit:[]};
  state.filters={professionals:{query:'',city:'',status:'',subscription:''},clients:{query:'',city:'',status:''},finance:{direction:'',status:'',city:'',month:''}};
  state.loading=false;
  state.error='';
  state.menu=false;
  state.loginError=message;
  render();
}
function currentOperation(store,epoch) { return state.store===store && authEpoch===epoch; }
async function verifyAccess(store,epoch) {
  if(!currentOperation(store,epoch))return false;
  try {
    const session=await store.getSession();
    if(!currentOperation(store,epoch))return false;
    if(!session || !session.isAdmin || (state.session && session.user.id!==state.session.user.id)) {
      clearPrivateState('Seu acesso administrativo precisa ser confirmado. Entre novamente para continuar.');
      return false;
    }
    state.session=session;
    return true;
  } catch(error) {
    if(currentOperation(store,epoch))clearPrivateState(error.message || 'Não foi possível confirmar sua permissão administrativa. Entre novamente.');
    return false;
  }
}
function watchAuth() {
  unsubscribeAuth?.();
  clearTimeout(authCheckTimer);
  authEpoch++;
  const store=state.store, epoch=authEpoch;
  unsubscribeAuth=store.subscribeAuth(event=>{
    if(!currentOperation(store,epoch))return;
    if(event==='SIGNED_OUT') { clearPrivateState(); return; }
    if(!state.session || store.mode!=='supabase' || !['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
    clearTimeout(authCheckTimer);
    // A macrotask runs after the Supabase auth callback/lock has finished.
    authCheckTimer=setTimeout(()=>{authCheckTimer=null;void verifyAccess(store,epoch);},0);
  });
}
async function loadData() {
  const store=state.store, epoch=authEpoch;
  state.loading=true;state.error='';render();
  try {
    const result=await store.load();
    if(!await verifyAccess(store,epoch))return;
    for(const key of Object.keys(state.data))state.data[key]=list(result[key]);
  } catch(error) {
    if(!await verifyAccess(store,epoch))return;
    state.error=error.message || 'Tente novamente em alguns instantes.';
  } finally {
    if(currentOperation(store,epoch)){state.loading=false;render();}
  }
}
async function start(demo=false) {
  clearPrivateState('',true);
  const selection=storeSelection;
  try {
    const store=demo ? await createStore(window.AQCRM_CONFIG||{},{demo:true}) : await connectedStore();
    if(selection!==storeSelection)return;
    state.store=store;watchAuth();
    const epoch=authEpoch;
    const session=await store.getSession();
    if(!currentOperation(store,epoch))return;
    state.session=session;state.initializing=false;
    if(session)await loadData();else render();
  } catch(error) {
    if(selection===storeSelection)clearPrivateState(error.message || 'Não foi possível iniciar o painel.');
  }
}
async function mutate(form,work,message,route) {
  const store=state.store,epoch=authEpoch;
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  form.querySelector('.form-error')?.setAttribute('hidden','');
  try {
    await work(store);
    if(!currentOperation(store,epoch))return;
    const data=await store.load();
    if(!await verifyAccess(store,epoch))return;
    state.data=data;
    if(route)go(route);else render();notify(message);
  } catch(error) {
    if(!await verifyAccess(store,epoch))return;
    formError(form,error.message||'Não foi possível salvar. Tente novamente.');
    buttons.forEach(b=>b.disabled=false);
  }
}
document.addEventListener('click',async event=>{const target=event.target.closest('button,a');if(!target)return;
  if(target.matches('[data-demo]')){target.disabled=true;try{await start(true);}catch(error){state.loginError=error.message;login();}return;}
  if(target.matches('[data-logout]')){const store=state.store;clearPrivateState('');try{await store.signOut();}catch(error){state.loginError='O painel foi fechado neste navegador. Não foi possível confirmar o encerramento da sessão: '+(error.message||'tente novamente.');login();}return;}
  if(target.matches('[data-refresh]')){await loadData();return;}
  if(target.matches('[data-menu]')){state.menu=true;render();document.querySelector('.sidebar-close')?.focus();return;}
  if(target.matches('[data-menu-close]')){state.menu=false;render();document.querySelector('.menu-toggle')?.focus();return;}
  if(target.matches('[data-clear-finance]')){state.filters.finance={direction:'',status:'',city:'',month:''};render();return;}
  if(target.matches('.skip-link')){event.preventDefault();document.querySelector('#content')?.focus();}
});
document.addEventListener('keydown',event=>{
  if(!state.menu)return;
  if(event.key==='Escape'){event.preventDefault();state.menu=false;render();document.querySelector('.menu-toggle')?.focus();return;}
  if(event.key!=='Tab')return;
  const sidebar=document.querySelector('#sidebar');
  const controls=[...sidebar.querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length);
  const first=controls[0],last=controls[controls.length-1];
  if(!first)return;
  if(event.shiftKey&&(document.activeElement===first||!sidebar.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!sidebar.contains(document.activeElement))){event.preventDefault();first.focus();}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);
  if(form.id==='login-form'){
    clearPrivateState('');
    const selection=storeSelection;
    let loginStore=null;
    const button=document.querySelector('#login-form button');
    if(button){button.disabled=true;button.textContent='Entrando…';}
    try {
      const store=await connectedStore();
      if(selection!==storeSelection)return;
      loginStore=store;state.store=store;watchAuth();
      const epoch=authEpoch;
      await store.signIn(String(data.get('email')).trim(),String(data.get('password')));
      if(!await verifyAccess(store,epoch))return;
      state.loginError='';await loadData();
    } catch(error){
      if(selection===storeSelection || (loginStore && state.store===loginStore && !state.session)){
        clearPrivateState(error.message||'Não foi possível entrar. Confira seus dados.');
        document.querySelector('.form-error')?.focus();
      }
    }
    return;
  }
  if(form.dataset.filter){const key=form.dataset.filter;state.filters[key]=Object.fromEntries(data.entries());render();return;}
  if(form.id==='category-form'){await mutate(form,store=>store.saveCategory({name:String(data.get('name')).trim(),description:String(data.get('description')).trim(),active:true}),'Categoria criada. Agora você pode vinculá-la a uma solicitação.');return;}
  if(form.dataset.categoryRequest){await mutate(form,store=>store.resolveCategoryRequest(form.dataset.categoryRequest,String(data.get('categoryId'))),'Categoria vinculada. O cadastro está pronto para continuar a análise.');return;}
  if(form.id==='professional-form'){const old=state.data.professionals.find(p=>p.id===form.dataset.id);const input={...old,name:String(data.get('name')).trim(),email:String(data.get('email')).trim(),phone:String(data.get('phone')).trim(),city:String(data.get('city')).trim(),cities:splitValues(data.get('cities')),description:String(data.get('description')).trim(),skills:splitValues(data.get('skills')),categories:data.getAll('categories').map(String),photoUrl:String(data.get('photoUrl')).trim() || (state.store.mode==='demo'&&old?.photoUrl?.startsWith('../assets/')?old.photoUrl:''),subscriptionStatus:String(data.get('subscriptionStatus')),notes:String(data.get('notes')).trim(),status:old?.status||'pending'};if(!input.categories.length){formError(form,'Selecione pelo menos uma categoria.');return;}if(input.photoUrl&&!input.photoUrl.startsWith('https://')&&!(state.store.mode==='demo'&&input.photoUrl.startsWith('../assets/'))){formError(form,'Informe um endereço HTTPS válido para a foto.');return;}await mutate(form,store=>store.saveProfessional(input),'Cadastro salvo.','/cadastros');return;}
  if(form.id==='decision-form'){const p=state.data.professionals.find(p=>p.id===form.dataset.id);const decision=event.submitter?.value;const notes=String(data.get('notes')).trim();if(!decision)return;if(decision==='pending'&&!notes){formError(form,'Descreva a pendência antes de registrá-la.');return;}await mutate(form,async store=>{if(notes!==String(p.notes||''))await store.saveProfessional({...p,notes});await store.decideProfessional(p.id,decision);},decision==='approved'?'Cadastro aprovado.':decision==='rejected'?'Decisão registrada no cadastro.':'Pendência registrada. Nenhuma mensagem foi enviada.');return;}
  if(form.id==='transaction-form'){const text=String(data.get('amount')).replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(text)){formError(form,'Informe um valor positivo com até duas casas decimais.');return;}const [whole,decimal='']=text.split('.');const amountCents=Number(whole)*100+Number(decimal.padEnd(2,'0'));const direction=String(data.get('direction'));const kind=String(data.get('kind'));if((direction==='income'&&kind==='expense')||(direction==='expense'&&kind!=='expense')){formError(form,'Escolha “Despesa da plataforma” para saídas, ou mensalidade/outra receita para entradas.');return;}const professionalId=String(data.get('professionalId'))||null;if(kind==='subscription'&&!professionalId){formError(form,'Vincule um profissional para registrar uma mensalidade.');return;}const old=state.data.transactions.find(t=>t.id===form.dataset.id);await mutate(form,store=>store.saveTransaction({...old,direction,kind,description:String(data.get('description')).trim(),amountCents,dueOn:String(data.get('dueOn')),professionalId,paymentMethod:String(data.get('paymentMethod')).trim(),notes:String(data.get('notes')).trim(),status:'pending',paidOn:null}),'Lançamento salvo como previsão.','/financeiro');return;}
  if(form.id==='settle-form'){await mutate(form,store=>store.settleTransaction(form.dataset.id,String(data.get('paidOn'))),'Movimentação confirmada e registrada no histórico.','/financeiro');return;}
  if(form.id==='cancel-transaction-form'){await mutate(form,store=>store.cancelTransaction(form.dataset.id),'Previsão cancelada. O histórico foi preservado.','/financeiro');}
});
const mobileNavigation=window.matchMedia('(max-width:760px)');
mobileNavigation.addEventListener('change',event=>{
  if(event.matches||!state.menu)return;
  state.menu=false;render();document.querySelector('#content')?.focus({preventScroll:true});
});
window.addEventListener('hashchange',()=>{state.menu=false;render();document.querySelector('#content')?.focus({preventScroll:true});window.scrollTo({top:0});});
start(false).catch(error=>{state.loginError=error.message||'Não foi possível iniciar o painel.';login();});
