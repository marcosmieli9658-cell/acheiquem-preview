import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Local logic checks only. Browser layout, native form validation and real image
// decoding are verified separately; this harness does not simulate production.
const dataSource = fs.readFileSync(new URL('../dist/data.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
const exportPoint = /  render\(\);\s*\}\)\(\);\s*$/;
assert.match(appSource, exportPoint, 'The harness must attach at the final render call.');

function harness() {
  const handlers = {};
  const nodes = new Map();
  function node() {
    return {textContent:'', innerHTML:'', open:false, focused:0, scrolled:0,
      classList:{add(){}, remove(){}}, setAttribute(){},
      focus(){this.focused++;}, scrollIntoView(){this.scrolled++;},
      showModal(){this.open=true;}, close(){this.open=false;}};
  }
  const document = {
    body:{dataset:{}},
    addEventListener(type, handler){handlers[type]=handler;},
    querySelector(selector){if(!nodes.has(selector)) nodes.set(selector,node());return nodes.get(selector);},
    querySelectorAll(){return [];}
  };
  let hash = '#/inicio';
  const location = {search:'', get hash(){return hash;}, set hash(value){hash=value.startsWith('#')?value:'#'+value;}};
  class FormData {
    constructor(form){this.fields=form.fields;}
    get(key){return this.fields[key] ?? null;}
    getAll(key){const value=this.fields[key];return Array.isArray(value)?value:value==null?[]:[value];}
  }
  const context = {console, URLSearchParams, Map, FormData, document, location,
    localStorage:{getItem(){return null;}}, setTimeout(){return 1;}, clearTimeout(){},
    FileReader:class {readAsDataURL(file){this.result=file.data;queueMicrotask(()=>this.onload());}},
    Image:class {set src(value){this.width=10;this.height=10;queueMicrotask(()=>value==='invalid'?this.onerror():this.onload());}}
  };
  context.window={AQIcons:()=>'', scrollTo(){}, addEventListener(){}};
  vm.createContext(context);
  vm.runInContext(dataSource,context);
  vm.runInContext(appSource.replace(exportPoint,
    '  window.check={state,registrationPage,accountPage,servicePage,finishLogin,ratingFor,currentSubscription,reviewCard,reviewPage,readPhoto,searchPage};\n})();'),context);
  const api=context.window.check;
  const form = (id,fields,dataset={},files=[]) => {
    const error=node();const button=node();
    return {id,fields,dataset,elements:{photos:{files}},error,button,
      matches(){return false;},reportValidity(){return true;},
      querySelector(selector){return selector==='.form-error'?error:button;}};
  };
  const submit = form => handlers.submit({target:form,preventDefault(){}});
  const click = (attribute,dataset={},href=null) => {
    let prevented=false;
    const target={dataset,matches:selector=>selector===`[${attribute}]`,getAttribute:name=>name==='href'?href:null,closest(){return this;}};
    handlers.click({target,preventDefault(){prevented=true;}});
    return prevented;
  };
  return {api,data:context.window.AQData,form,submit,click,nodes,document,location};
}

const professionalFields = {
  name:'Profissional Local',email:'pro@exemplo.test',city:'Taubaté',title:'Eletricista e acabamentos',
  description:'Descrição fictícia suficientemente longa para testar a apresentação.',
  categories:['eletrica','acabamento'],cities:['Taubaté','Tremembé'],skills:'Instalação elétrica, Pisos',consent:'on'
};
const clientFields = (name,email) => ({name,email,city:'Taubaté',consent:'on'});
const serviceFields = title => ({title,description:'Descrição fictícia para este serviço.',city:'Taubaté'});
let checks=0;
async function check(name,run){await run();checks++;console.log(`OK ${name}`);}

await check('35 cidades e médias derivadas dos relatos existentes',()=>{
  const h=harness();
  assert.equal(h.data.cities.length,35);
  assert.equal(h.api.ratingFor(h.data.professionals.find(p=>p.id==='rafael')).score,'4,7');
  assert.equal(h.api.ratingFor(h.data.professionals.find(p=>p.id==='carlos')).score,'4,0');
  assert.equal(h.api.ratingFor(h.data.professionals.find(p=>p.id==='juliana')).count,0);
  assert.ok(h.data.professionals.every(p=>!Object.hasOwn(p,'rating')&&!Object.hasOwn(p,'reviews')));
});

await check('cadastro e edição mantêm foto de exemplo, categorias e cidades',async()=>{
  const h=harness();h.api.state.photo='demo';
  await h.submit(h.form('registration-form',professionalFields,{role:'professional',edit:'0'}));
  assert.deepEqual([...h.api.state.profile.categories],['eletrica','acabamento']);
  assert.deepEqual([...h.api.state.profile.cities],['Taubaté','Tremembé']);
  assert.match(h.api.registrationPage(new URLSearchParams('role=professional&edit=1')),/portrait-0/);
  assert.equal(h.api.state.photo,'demo');
  const edit=h.form('registration-form',{...professionalFields,title:'Eletricista atualizado'},{role:'professional',edit:'1'});
  await h.submit(edit);
  assert.equal(edit.error.textContent,'');
  assert.equal(h.api.state.profile.title,'Eletricista atualizado');
  assert.equal(h.api.state.profile.demoPhoto,true);
});

await check('logout e outra conta não podem editar ou responder pelo perfil local',async()=>{
  const h=harness();h.api.state.photo='demo';
  await h.submit(h.form('registration-form',professionalFields,{role:'professional',edit:'0'}));
  h.api.state.user=null;
  assert.match(h.api.registrationPage(new URLSearchParams('role=professional&edit=1')),/conta responsável/);
  const edit=h.form('registration-form',{...professionalFields,title:'Alteração indevida'},{role:'professional',edit:'1'});
  await h.submit(edit);
  assert.match(edit.error.textContent,/conta responsável/);
  h.api.finishLogin('professional');
  assert.match(h.api.accountPage(),/<h2>Rafael Almeida<\/h2>/);
  assert.doesNotMatch(h.api.accountPage(),/<h2>Profissional Local<\/h2>|Editar meu perfil/);
  assert.match(h.api.registrationPage(new URLSearchParams('role=professional&edit=1')),/conta responsável/);
  const review={id:'local-test',proId:'meu-perfil',author:'Cliente',service:'Serviço',date:'2026-10-29',score:2,text:'Relato de teste',photos:[]};
  h.api.state.reviews.push(review);
  assert.doesNotMatch(h.api.reviewCard(review,h.api.state.profile),/data-respond/);
  await h.submit(h.form('response-form',{response:'Uma resposta indevida.'},{review:'local-test'}));
  assert.equal(review.response,undefined);
  h.click('data-local-login');
  assert.match(h.api.accountPage(),/<h2>Profissional Local<\/h2>/);
  await h.submit(h.form('response-form',{response:'Uma resposta do profissional correto.'},{review:'local-test'}));
  assert.equal(review.response,'Uma resposta do profissional correto.');
});

await check('assinatura segue o profissional e o perfil próprio pode ser retomado',async()=>{
  const h=harness();h.api.state.photo='demo';
  await h.submit(h.form('registration-form',professionalFields,{role:'professional',edit:'0'}));
  h.click('data-confirm-subscribe');assert.equal(h.api.currentSubscription(),'active');
  h.api.finishLogin('professional');assert.equal(h.api.currentSubscription(),'inactive');
  h.click('data-confirm-subscribe');h.click('data-confirm-cancel');assert.equal(h.api.currentSubscription(),'canceled');
  h.api.finishLogin('client');assert.equal(h.api.currentSubscription(),'inactive');
  h.click('data-local-login');assert.equal(h.api.currentSubscription(),'active');
  assert.match(h.api.registrationPage(new URLSearchParams('role=professional')),/um perfil profissional próprio por sessão/);
});

await check('contato profissional exige troca explícita para cliente e preserva destino',async()=>{
  const h=harness();h.api.finishLogin('professional');
  const page=h.api.servicePage('mariana');
  assert.doesNotMatch(page,/id="service-form"/);
  assert.match(page,/data-demo-login="client" data-next="contato" data-pro="mariana"/);
  const denied=h.form('service-form',serviceFields('Serviço profissional bloqueado'),{pro:'mariana'});
  await h.submit(denied);assert.equal(h.api.state.services.length,0);assert.match(denied.error.textContent,/conta de cliente/);
  h.click('data-demo-login',{demoLogin:'client',next:'contato',pro:'mariana'});
  assert.equal(h.location.hash,'#/registrar-servico/mariana');
  await h.submit(h.form('service-form',serviceFields('Pedido do cliente'),{pro:'mariana'}));
  assert.equal(h.api.state.services[0].clientId,'demo-client');
});

await check('clientes têm identidade estável por e-mail e só veem seus registros',async()=>{
  const h=harness();
  await h.submit(h.form('registration-form',clientFields('Alice Exemplo','Alice@EXEMPLO.test'),{role:'client'}));
  const aliceId=h.api.state.user.id;
  await h.submit(h.form('service-form',serviceFields('Pedido exclusivo Alice'),{pro:'mariana'}));
  const aliceService=h.api.state.services[0];
  await h.submit(h.form('registration-form',clientFields('Bruno Exemplo','bruno@exemplo.test'),{role:'client'}));
  assert.notEqual(h.api.state.user.id,aliceId);
  assert.doesNotMatch(h.api.accountPage(),/Pedido exclusivo Alice/);
  h.click('data-job',{job:aliceService.id,jobAction:'confirm'});assert.equal(aliceService.status,'requested');
  await h.submit(h.form('service-form',serviceFields('Pedido exclusivo Bruno'),{pro:'mariana'}));
  await h.submit(h.form('registration-form',clientFields('Alice Exemplo',' alice@exemplo.test '),{role:'client'}));
  assert.equal(h.api.state.user.id,aliceId);
  assert.match(h.api.accountPage(),/Pedido exclusivo Alice/);
  assert.doesNotMatch(h.api.accountPage(),/Pedido exclusivo Bruno/);
});

await check('avaliação exige conclusão e autoria, e permanece única por serviço',async()=>{
  const h=harness();h.api.finishLogin('client');
  await h.submit(h.form('service-form',serviceFields('Serviço para avaliar'),{pro:'mariana'}));
  const s=h.api.state.services[0];
  const review=()=>h.form('review-form',{score:'2',text:'O resultado ficou abaixo do combinado.',consent:'on'},{service:s.id});
  await h.submit(review());assert.equal(h.api.state.reviews.length,0);
  h.click('data-job',{job:s.id,jobAction:'confirm'});assert.equal(s.status,'confirmed');
  h.click('data-job',{job:s.id,jobAction:'pro-complete'});assert.equal(s.status,'professional_completed');
  h.click('data-job',{job:s.id,jobAction:'complete'});assert.equal(s.status,'completed');
  await h.submit(review());assert.equal(h.api.state.reviews.length,1);assert.equal(h.api.state.reviews[0].score,2);
  await h.submit(review());assert.equal(h.api.state.reviews.length,1);
  await h.submit(h.form('registration-form',clientFields('Outro Cliente','outro@exemplo.test'),{role:'client'}));
  assert.doesNotMatch(h.api.reviewPage(s.id),/id="review-form"/);
  await h.submit(review());assert.equal(h.api.state.reviews.length,1);
});

await check('campos com espaços e arquivos inválidos são rejeitados',async()=>{
  const h=harness();
  const blank=h.form('registration-form',clientFields('     ','vazio@exemplo.test'),{role:'client'});
  await h.submit(blank);assert.equal(h.api.state.user,null);assert.match(blank.error.textContent,/nome/);
  h.api.state.photo='demo';
  const pro=h.form('registration-form',{...professionalFields,description:' '.repeat(35)},{role:'professional'});
  await h.submit(pro);assert.equal(h.api.state.profile,null);assert.match(pro.error.textContent,/descrição/);
  await assert.rejects(h.api.readPhoto({type:'text/plain',size:4}),/JPG/);
  await assert.rejects(h.api.readPhoto({type:'image/png',size:2*1024*1024+1}),/2 MB/);
  await assert.rejects(h.api.readPhoto({type:'image/png',size:8,data:'invalid'}),/imagem válida/);
  assert.equal(await h.api.readPhoto({type:'image/png',size:8,data:'data:image/png;base64,dGVzdA=='}),'data:image/png;base64,dGVzdA==');
});

await check('atalho para conteúdo mantém a rota e foca o main',()=>{
  const h=harness();h.location.hash='#/buscar?city=Taubat%C3%A9';
  assert.equal(h.click(null,{},'#main'),true);
  assert.equal(h.location.hash,'#/buscar?city=Taubat%C3%A9');
  assert.equal(h.document.querySelector('#main').focused,1);
  assert.equal(h.document.querySelector('#main').scrolled,1);
});

console.log(`${checks} verificações de lógica passaram. O navegador ainda deve conferir a interface.`);
