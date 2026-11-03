import {createDemoData} from './demo-data.js';

// Verified on the official npm registry on 2026-11-03. Loaded only in connected mode.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const TABLES = {professionals:'aq_professionals', clients:'aq_clients', categories:'aq_categories', categoryRequests:'aq_category_requests', transactions:'aq_transactions', audit:'aq_audit'};
const fields = {
  professionals:{photoUrl:'photo_url', photoIndex:'photo_index', subscriptionStatus:'subscription_status', createdAt:'created_at', updatedAt:'updated_at'},
  clients:{createdAt:'created_at'}, categories:{createdAt:'created_at'},
  categoryRequests:{professionalId:'professional_id', categoryId:'category_id', createdAt:'created_at'},
  transactions:{professionalId:'professional_id', amountCents:'amount_cents', dueOn:'due_on', paidOn:'paid_on', paymentMethod:'payment_method', createdAt:'created_at'},
  audit:{entityId:'entity_id', createdAt:'created_at', actorId:'actor_id'}
};
const writable = {
  professionals:['name','email','phone','city','cities','description','skills','categories','photoUrl','photoIndex','status','subscriptionStatus','notes'],
  categories:['name','description','active'],
  transactions:['direction','kind','description','professionalId','amountCents','dueOn','paidOn','status','paymentMethod','notes']
};
const copy = value => structuredClone(value);
const clean = value => String(value ?? '').trim();
const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const list = value => [...new Set((Array.isArray(value) ? value : []).map(clean).filter(Boolean))];
const uuid = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();

export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'}).format(date);
}
export function isOverdue(transaction, today = localDate()) {
  return transaction.status === 'pending' && transaction.dueOn < today;
}
export function summarizeFinance(transactions, {from='', to='', today=localDate()} = {}) {
  const inside = date => (!from || date >= from) && (!to || date <= to);
  const result = {receivedCents:0, paidCents:0, balanceCents:0, receivableCents:0, payableCents:0, overdueCents:0};
  for (const transaction of transactions) {
    if (transaction.status === 'paid' && inside(transaction.paidOn)) {
      result[transaction.direction === 'income' ? 'receivedCents' : 'paidCents'] += transaction.amountCents;
    } else if (transaction.status === 'pending' && inside(transaction.dueOn)) {
      result[transaction.direction === 'income' ? 'receivableCents' : 'payableCents'] += transaction.amountCents;
      if (transaction.direction === 'income' && isOverdue(transaction,today)) result.overdueCents += transaction.amountCents;
    }
  }
  result.balanceCents = result.receivedCents - result.paidCents;
  return result;
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
}
function validateTransaction(input) {
  if (!['income','expense'].includes(input.direction)) throw new Error('Selecione entrada ou saída.');
  if (!['subscription','expense','other'].includes(input.kind)) throw new Error('Selecione o tipo do lançamento.');
  if (!clean(input.description) || clean(input.description).length > 500) throw new Error('Informe uma descrição de até 500 caracteres.');
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 999999999) throw new Error('Informe um valor positivo com até duas casas decimais.');
  if (!validDate(input.dueOn)) throw new Error('Informe uma data de vencimento válida.');
  if (!['pending','paid','cancelled'].includes(input.status)) throw new Error('Situação financeira inválida.');
  if (input.status === 'paid' && (!validDate(input.paidOn) || input.paidOn > localDate())) throw new Error('Informe a data efetiva do pagamento, até hoje.');
  if (input.status !== 'paid' && input.paidOn) throw new Error('Um lançamento em aberto ou cancelado não pode ter data de pagamento.');
  if (input.kind === 'subscription' && (input.direction !== 'income' || !input.professionalId)) throw new Error('A mensalidade deve estar vinculada a um profissional e ser uma entrada.');
  if (input.kind === 'expense' && input.direction !== 'expense') throw new Error('Selecione saída para registrar uma despesa.');
  if (!['pix','transfer','cash','card','other'].includes(input.paymentMethod)) throw new Error('Selecione um meio de pagamento válido.');
}
function normalizeProfessional(input) {
  const result = {...input, name:clean(input.name), email:clean(input.email).toLowerCase(), phone:clean(input.phone), city:clean(input.city), description:clean(input.description), skills:list(input.skills), categories:list(input.categories), cities:list(input.cities), photoUrl:clean(input.photoUrl), notes:clean(input.notes)};
  if (result.name.length < 2 || result.name.length > 160 || result.city.length < 2 || result.city.length > 100) throw new Error('Informe nome e cidade-base válidos.');
  if (!['pending','approved','rejected'].includes(result.status)) throw new Error('Situação cadastral inválida.');
  if (!['inactive','active','cancelled'].includes(result.subscriptionStatus)) throw new Error('Situação da assinatura inválida.');
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Informe um e-mail válido.');
  if (result.photoUrl && !/^https:\/\/|^\.\.\/assets\//.test(result.photoUrl)) throw new Error('Use um endereço HTTPS para a foto.');
  return result;
}
function validateApproval(professional, dataset) {
  if (!clean(professional.photoUrl) || clean(professional.description).length < 30 || !professional.skills?.length || !professional.categories?.length || !professional.cities?.length) throw new Error('Para aprovar, confira foto, descrição de ao menos 30 caracteres, habilidades, categorias e cidades atendidas.');
  if (professional.categories.some(id => !dataset.categories.some(category => category.id === id && category.active))) throw new Error('Vincule apenas categorias existentes e ativas antes de aprovar.');
  if (dataset.categoryRequests.some(request => request.professionalId === professional.id && request.status === 'pending')) throw new Error('Resolva o pedido de nova categoria antes de aprovar este profissional.');
}
function translateError(error) {
  if (error?.message && /^(Para aprovar|Resolva|Informe|Selecione|Vincule|A mensalidade|Um lançamento|Este lançamento|Categoria|Profissional|Não é possível)/.test(error.message)) return new Error(error.message);
  if (error?.code === '42501') return new Error('Você não tem permissão administrativa para esta ação.');
  if (error?.code === '23505') return new Error('Já existe um cadastro com esses dados.');
  if (error?.code === '23514' || error?.code === '23503') return new Error('Confira os dados e vínculos deste registro antes de salvar.');
  return new Error(error?.message || 'Não foi possível concluir a operação. Tente novamente.');
}
function signInError(error) {
  if (error?.code === 'invalid_credentials') return new Error('Não foi possível entrar. Confira e-mail e senha.');
  if (error?.code === 'email_not_confirmed') return new Error('Confirme seu e-mail antes de entrar. Se precisar de ajuda, fale com a equipe do Achei Quem.');
  if (['over_request_rate_limit','over_email_send_rate_limit'].includes(error?.code) || error?.status === 429) return new Error('Há muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.');
  if (error?.name === 'AuthRetryableFetchError' || error?.status === 0) return new Error('Não foi possível conectar ao serviço de acesso. Confira sua conexão e tente novamente.');
  return new Error('O serviço de acesso está indisponível no momento. Tente novamente mais tarde ou fale com a equipe do Achei Quem.');
}
function fromDb(entity, row) {
  const mapping = fields[entity] || {};
  const reverse = Object.fromEntries(Object.entries(mapping).map(([key,value]) => [value,key]));
  return Object.fromEntries(Object.entries(row).map(([key,value]) => [reverse[key] || key, value]));
}
function toDb(entity, input) {
  const mapping = fields[entity] || {};
  return Object.fromEntries(writable[entity].filter(key => key in input).map(key => [mapping[key] || key,input[key]]));
}

export async function createStore(config = {}, {demo = false} = {}) {
  if (demo) return createDemoStore();
  if (!config.supabaseUrl || !config.publishableKey) {
    const unavailable = async () => {throw new Error('A conexão com o Supabase ainda não foi configurada. A demonstração usa apenas dados fictícios.');};
    return {mode:'unconfigured', getSession:async()=>null, subscribeAuth:()=>()=>{}, signIn:unavailable, signOut:async()=>{}, load:unavailable, saveProfessional:unavailable, decideProfessional:unavailable, saveCategory:unavailable, resolveCategoryRequest:unavailable, saveTransaction:unavailable, settleTransaction:unavailable, cancelTransaction:unavailable};
  }
  const url = new URL(config.supabaseUrl);
  if (url.protocol !== 'https:') throw new Error('A URL do Supabase deve usar HTTPS.');
  if (config.publishableKey.startsWith('sb_secret_')) throw new Error('Não use chave secreta no navegador. Configure somente a chave publishable.');
  // Legacy service-role JWTs must never become a browser configuration either.
  if (config.publishableKey.split('.').length === 3) {
    try {
      const claims = JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if (claims.role !== 'anon') throw new Error('invalid-role');
    } catch {throw new Error('Use somente uma chave publishable ou anon pública.');}
  }
  const createClient = config.createClient || (await import(SDK_URL)).createClient;
  const client = createClient(url.origin,config.publishableKey,{auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false, storageKey:'aq-crm-auth'}});
  async function session() {
    const {data,error} = await client.auth.getUser();
    if (error || !data.user) return null;
    const allowed = await client.rpc('aq_is_admin');
    if (allowed.error) throw translateError(allowed.error);
    if (!allowed.data) throw new Error('Esta conta não possui acesso ao painel administrativo.');
    return {user:{id:data.user.id,email:data.user.email},isAdmin:true};
  }
  async function requireAdmin() {if (!await session()) throw new Error('Entre com sua conta administrativa para continuar.');}
  async function loadTable(entity) {
    const rows = [];
    for (let start=0;; start+=500) {
      const {data,error} = await client.from(TABLES[entity]).select('*').order('id').range(start,start+499);
      if (error) throw translateError(error);
      rows.push(...data.map(row => fromDb(entity,row)));
      if (data.length < 500) return rows;
    }
  }
  async function save(entity,input) {
    await requireAdmin();
    const payload = toDb(entity,input);
    const query = input.id ? client.from(TABLES[entity]).update(payload).eq('id',input.id) : client.from(TABLES[entity]).insert(payload);
    const {data,error} = await query.select().single();
    if (error) throw translateError(error);
    return fromDb(entity,data);
  }
  async function updateTransaction(id,changes) {
    await requireAdmin();
    const {data,error} = await client.from(TABLES.transactions).update(toDb('transactions',changes)).eq('id',id).eq('status','pending').select().single();
    if (error) throw new Error(error.code === 'PGRST116' ? 'Este lançamento já foi alterado. Atualize a lista.' : translateError(error).message);
    return fromDb('transactions',data);
  }
  return {
    mode:'supabase', getSession:session,
    async signIn(email,password) {
      let result;
      try {result = await client.auth.signInWithPassword({email:clean(email),password});}
      catch (error) {throw signInError(error);}
      if (result.error) throw signInError(result.error);
      try {return await session();} catch (error) {await client.auth.signOut({scope:'local'});throw error;}
    },
    async signOut() {const {error}=await client.auth.signOut({scope:'local'});if(error) throw translateError(error);},
    subscribeAuth(callback) {
      const {data} = client.auth.onAuthStateChange((event) => {
        // Supabase warns against awaiting other auth methods within this callback.
        queueMicrotask(() => callback(event));
      });
      return () => data.subscription.unsubscribe();
    },
    async load() {await requireAdmin(); const pairs=await Promise.all(Object.keys(TABLES).map(async entity=>[entity,await loadTable(entity)]));return Object.fromEntries(pairs);},
    async saveProfessional(input) {return save('professionals',normalizeProfessional({status:'pending',subscriptionStatus:'inactive',...input}));},
    async decideProfessional(id,status) {
      if (!['approved','rejected','pending'].includes(status)) throw new Error('Situação cadastral inválida.');
      return save('professionals',{id,status});
    },
    async saveCategory(input) {if(clean(input.name).length<2||clean(input.name).length>100)throw new Error('Informe um nome de categoria entre 2 e 100 caracteres.');return save('categories',{...input,name:clean(input.name),description:clean(input.description),active:input.active!==false});},
    async resolveCategoryRequest(id,categoryId) {
      await requireAdmin();const {error}=await client.rpc('aq_resolve_category_request',{request_id:id,category_id:categoryId});if(error) throw translateError(error);
    },
    async saveTransaction(input) {const row={status:'pending',paidOn:null,paymentMethod:'other',professionalId:null,notes:'',...input};validateTransaction(row);return save('transactions',row);},
    async settleTransaction(id,paidOn) {if(!validDate(paidOn)||paidOn>localDate())throw new Error('Informe a data efetiva do pagamento, até hoje.');return updateTransaction(id,{status:'paid',paidOn});},
    async cancelTransaction(id) {return updateTransaction(id,{status:'cancelled',paidOn:null});}
  };
}

function createDemoStore() {
  const dataset = createDemoData();
  let active = true;
  const listeners = new Set();
  const requireSession = () => {if(!active)throw new Error('Abra novamente a demonstração para continuar.');};
  const record = (entity,entityId,action) => dataset.audit.unshift({id:uuid(),entity,entityId,action,createdAt:timestamp()});
  function find(entity,id) {const row=dataset[entity].find(item=>item.id===id);if(!row)throw new Error('Registro não encontrado. Atualize a lista.');return row;}
  function save(entity,input) {
    requireSession();
    const existing = input.id ? find(entity,input.id) : null;
    const row = {...existing,...copy(input),id:existing?.id||uuid(),createdAt:existing?.createdAt||timestamp()};
    if(existing)dataset[entity][dataset[entity].indexOf(existing)]=row;else dataset[entity].push(row);
    record(entity,row.id,existing?'update':'insert');return copy(row);
  }
  const api = {
    mode:'demo',
    async getSession(){return active?{user:{id:'demo-admin',email:'administrador@exemplo.test'},isAdmin:true}:null;},
    async signIn(){throw new Error('A demonstração não utiliza contas ou senhas reais.');},
    async signOut(){active=false;listeners.forEach(callback=>callback('SIGNED_OUT'));},
    subscribeAuth(callback){listeners.add(callback);return()=>listeners.delete(callback);},
    async load(){requireSession();return copy(dataset);},
    async saveProfessional(input){
      requireSession();const existing=input.id?find('professionals',input.id):{};
      const row=normalizeProfessional({status:'pending',subscriptionStatus:'inactive',...existing,...input});
      if(row.categories.some(id=>!dataset.categories.some(category=>category.id===id)))throw new Error('Vincule categorias existentes.');
      if(row.status==='approved')validateApproval(row,dataset);
      return save('professionals',row);
    },
    async decideProfessional(id,status){if(!['pending','approved','rejected'].includes(status))throw new Error('Situação cadastral inválida.');return api.saveProfessional({...find('professionals',id),status});},
    async saveCategory(input){
      requireSession();const name=clean(input.name);if(name.length<2||name.length>100)throw new Error('Informe um nome de categoria entre 2 e 100 caracteres.');
      if(dataset.categories.some(category=>category.id!==input.id&&normalize(category.name)===normalize(name)))throw new Error('Categoria já cadastrada. Vincule o pedido à categoria existente.');
      return save('categories',{...input,name,description:clean(input.description),active:input.active!==false});
    },
    async resolveCategoryRequest(id,categoryId){
      requireSession();const request=find('categoryRequests',id);const category=find('categories',categoryId);
      if(request.status!=='pending')throw new Error('Categoria já analisada. Atualize a lista.');
      if(!category.active)throw new Error('Vincule uma categoria ativa.');
      const professional=find('professionals',request.professionalId);
      professional.categories=list([...professional.categories,categoryId]);request.status='resolved';request.categoryId=categoryId;
      record('categoryRequests',id,'update');record('professionals',professional.id,'update');
    },
    async saveTransaction(input){
      requireSession();const existing=input.id?find('transactions',input.id):null;
      if(existing&&existing.status!=='pending')throw new Error('Este lançamento já foi liquidado ou cancelado e não pode ser editado.');
      const row={status:'pending',paidOn:null,paymentMethod:'other',professionalId:null,notes:'',...existing,...input};validateTransaction(row);
      if(row.professionalId&&!dataset.professionals.some(professional=>professional.id===row.professionalId))throw new Error('Profissional não encontrado.');
      return save('transactions',row);
    },
    async settleTransaction(id,paidOn){return api.saveTransaction({...find('transactions',id),status:'paid',paidOn});},
    async cancelTransaction(id){return api.saveTransaction({...find('transactions',id),status:'cancelled',paidOn:null});}
  };
  return api;
}
