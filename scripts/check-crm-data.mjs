import assert from 'node:assert/strict';
import {createStore, isOverdue, summarizeFinance, localDate} from '../dist/admin/data.js';

let passed = 0;
async function check(name, test) {
  await test();
  passed++;
  process.stdout.write(`OK ${name}\n`);
}

await check('configuração ausente não cria sessão nem dados fictícios automaticamente', async () => {
  const store = await createStore({});
  assert.equal(store.mode,'unconfigured');
  assert.equal(await store.getSession(),null);
  await assert.rejects(store.load(),/não foi configurada/);
  await assert.rejects(store.signIn('pessoa@exemplo.test','not-a-secret'),/não foi configurada/);
});
await check('demo explícita isolada e sem dependência de rede', async () => {
  const first=await createStore({}, {demo:true});
  const second=await createStore({}, {demo:true});
  assert.equal(first.mode,'demo');
  assert.equal((await first.getSession()).isAdmin,true);
  const data=await first.load();
  const original=data.professionals[0].name;
  data.professionals[0].name='Alteração fora do store';
  assert.equal((await first.load()).professionals[0].name,original);
  await first.saveCategory({name:'Serralheria',description:'Categoria demonstrativa'});
  assert.equal((await second.load()).categories.length,8);
});
await check('pedido de categoria impede aprovação até resolução e deixa trilha', async () => {
  const store=await createStore({}, {demo:true});
  let data=await store.load();
  const request=data.categoryRequests[0];
  await assert.rejects(store.decideProfessional(request.professionalId,'approved'),/Resolva/);
  const category=await store.saveCategory({name:'Drywall',active:true});
  await store.resolveCategoryRequest(request.id,category.id);
  await store.decideProfessional(request.professionalId,'approved');
  data=await store.load();
  const professional=data.professionals.find(row=>row.id===request.professionalId);
  assert.equal(professional.status,'approved');
  assert.equal(professional.subscriptionStatus,'inactive');
  assert.ok(professional.categories.includes(category.id));
  assert.ok(data.audit.some(row=>row.entity==='categoryRequests'&&row.entityId===request.id));
  await assert.rejects(store.resolveCategoryRequest(request.id,category.id),/já analisada/);
});
await check('aprovação exige foto e descrição suficiente independentemente do pagamento', async () => {
  const store=await createStore({}, {demo:true});
  const professional=(await store.load()).professionals.find(row=>row.status==='pending');
  await store.saveProfessional({...professional,photoUrl:'',subscriptionStatus:'active'});
  await assert.rejects(store.decideProfessional(professional.id,'approved'),/Para aprovar/);
  assert.equal((await store.load()).professionals.find(row=>row.id===professional.id).status,'pending');
});
await check('categoria duplicada ignora acentuação e capitalização', async () => {
  const store=await createStore({}, {demo:true});
  await assert.rejects(store.saveCategory({name:'  eletrica  '}),/já cadastrada/);
});
await check('financeiro distingue vencimento, pagamento, saldo e cancelamento', async () => {
  const rows=[
    {direction:'income',status:'paid',amountCents:10000,dueOn:'2026-10-20',paidOn:'2026-11-01'},
    {direction:'expense',status:'paid',amountCents:2500,dueOn:'2026-11-04',paidOn:'2026-11-02'},
    {direction:'income',status:'pending',amountCents:3000,dueOn:'2026-11-01',paidOn:null},
    {direction:'expense',status:'pending',amountCents:700,dueOn:'2026-11-08',paidOn:null},
    {direction:'income',status:'cancelled',amountCents:990000,dueOn:'2026-11-01',paidOn:null}
  ];
  assert.deepEqual(summarizeFinance(rows,{from:'2026-11-01',to:'2026-11-30',today:'2026-11-03'}),{receivedCents:10000,paidCents:2500,balanceCents:7500,receivableCents:3000,payableCents:700,overdueCents:3000});
  assert.equal(isOverdue(rows[2],'2026-11-01'),false);
  assert.equal(isOverdue(rows[2],'2026-11-02'),true);
  assert.equal(isOverdue(rows[4],'2026-11-03'),false);
});
await check('baixa financeira única e valor em centavos, sem liberar aprovação', async () => {
  const store=await createStore({}, {demo:true});
  const data=await store.load();
  const professional=data.professionals.find(row=>row.status==='pending');
  const input={direction:'income',kind:'subscription',professionalId:professional.id,description:'Mensalidade de teste',amountCents:1000,dueOn:localDate(),status:'pending'};
  await assert.rejects(store.saveTransaction({...input,amountCents:10.5}),/duas casas/);
  await assert.rejects(store.saveTransaction({...input,dueOn:'2026-02-31'}),/vencimento/);
  const transaction=await store.saveTransaction(input);
  await store.settleTransaction(transaction.id,localDate());
  await assert.rejects(store.settleTransaction(transaction.id,localDate()),/liquidado/);
  await assert.rejects(store.cancelTransaction(transaction.id),/liquidado/);
  assert.equal((await store.load()).professionals.find(row=>row.id===professional.id).status,'pending');
});
await check('logout da demonstração bloqueia leitura e escrita', async () => {
  const store=await createStore({}, {demo:true});
  await store.signOut();
  assert.equal(await store.getSession(),null);
  await assert.rejects(store.load(),/novamente/);
  await assert.rejects(store.saveCategory({name:'Categoria inválida após sair'}),/novamente/);
});
await check('configuração recusa chaves secretas antes de carregar SDK', async () => {
  await assert.rejects(createStore({supabaseUrl:'https://example.supabase.co',publishableKey:'sb_secret_fake'}),/chave secreta/);
});
await check('sessão autenticada sem papel admin é recusada e encerrada, sem fallback', async () => {
  let loggedOut=false;
  const client={auth:{getUser:async()=>({data:{user:{id:'ordinary-user',email:'cliente@exemplo.test'}}}),signInWithPassword:async()=>({}),signOut:async()=>{loggedOut=true;return{};}},rpc:async()=>({data:false})};
  const store=await createStore({supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_fake',createClient:()=>client});
  await assert.rejects(store.signIn('cliente@exemplo.test','not-a-secret'),/não possui acesso/);
  assert.equal(loggedOut,true);
  assert.equal(store.mode,'supabase');
  await assert.rejects(store.load(),/não possui acesso/);
});
await check('login distingue credenciais, confirmação, limite, conexão e indisponibilidade sem expor detalhes', async () => {
  const scenarios = [
    [{code:'invalid_credentials',status:400},/Confira e-mail e senha/],
    [{code:'email_not_confirmed',status:400},/Confirme seu e-mail/],
    [{code:'over_request_rate_limit',status:429},/Aguarde alguns minutos/],
    [{code:'over_email_send_rate_limit'},/Aguarde alguns minutos/],
    [{status:429,name:'AuthRetryableFetchError'},/Aguarde alguns minutos/],
    [{name:'AuthRetryableFetchError'},/Confira sua conexão/],
    [{status:0},/Confira sua conexão/],
    [{code:'unexpected_failure',status:500},/indisponível no momento/],
    [{code:'provider_disabled',status:400},/indisponível no momento/]
  ];
  for (const [failure,expected] of scenarios) {
    const client={auth:{signInWithPassword:async()=>({error:{...failure,message:'INTERNAL_DIAGNOSTIC_DO_NOT_EXPOSE'}})}};
    const store=await createStore({supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_fake',createClient:()=>client});
    await assert.rejects(store.signIn('admin@exemplo.test','dummy-password'),error=>{
      assert.match(error.message,expected);
      assert.doesNotMatch(error.message,/INTERNAL_DIAGNOSTIC|dummy-password|admin@/);
      return true;
    });
    assert.equal(store.mode,'supabase');
  }
});
await check('falha lançada pelo SDK também recebe orientação de conexão sem fallback', async () => {
  const client={auth:{signInWithPassword:async()=>{throw Object.assign(new Error('PRIVATE_NETWORK_DETAIL'),{name:'AuthRetryableFetchError',status:0});}}};
  const store=await createStore({supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_fake',createClient:()=>client});
  await assert.rejects(store.signIn('admin@exemplo.test','dummy-password'),/Confira sua conexão/);
  assert.equal(store.mode,'supabase');
});
process.stdout.write(`${passed} cenários passaram. SQL/RLS ainda exigem validação em projeto Supabase de desenvolvimento.\n`);
