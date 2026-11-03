import assert from 'node:assert/strict';
import {createRecoveryService, recoveryEntry, recoveryMessage, validateNewPassword} from '../dist/admin/recovery.js';

// Auth adapter tests only: no browser, network, email or real credentials.
// URL removal from browser history and form rendering are verified separately.
const config = {supabaseUrl:'https://example.supabase.co', publishableKey:'sb_publishable_fixture'};
const redirectTo = 'https://acheiquem.pages.dev/admin/redefinir-senha.html';
const password = 'temporary-fixture-only';
const recoveryUrl = `${redirectTo}#type=recovery&access_token=FIXTURE_ACCESS&refresh_token=FIXTURE_REFRESH`;
let passed = 0;

async function check(name, run) {
  await run();
  passed++;
  process.stdout.write(`OK ${name}\n`);
}
function authFixture() {
  const fixture = {
    options:null, callback:null, unsubscribed:0,
    session:{user:{id:'fixture-user'}}, user:{id:'fixture-user'},
    sessionError:null, userError:null, requestError:null, updateError:null, signOutError:null,
    requests:[], updates:[], signOuts:[], getUserCalls:0,
    emit(event, session = fixture.session) {fixture.callback?.(event,session);},
    createClient(_url,_key,options) {
      fixture.options=options;
      return {
        from() {throw new Error('Recovery must not access CRM records.');},
        rpc() {throw new Error('Recovery must not access CRM permissions or records.');},
        auth:{
          onAuthStateChange(callback) {
            fixture.callback=callback;
            if(options.auth.detectSessionInUrl) callback('PASSWORD_RECOVERY',fixture.session);
            return {data:{subscription:{unsubscribe(){fixture.unsubscribed++;fixture.callback=null;}}}};
          },
          getSession:async()=>({data:{session:fixture.session},error:fixture.sessionError}),
          getUser:async()=>{fixture.getUserCalls++;return {data:{user:fixture.user},error:fixture.userError};},
          resetPasswordForEmail:async(email,options)=>{fixture.requests.push({email,...options});return {error:fixture.requestError};},
          updateUser:async(attributes)=>{fixture.updates.push(attributes);return {error:fixture.updateError};},
          signOut:async(options)=>{fixture.signOuts.push(options);return {error:fixture.signOutError};}
        }
      };
    }
  };
  return fixture;
}
async function serviceFor(fixture,url=recoveryUrl) {
  return createRecoveryService(config,recoveryEntry(url),{createClient:fixture.createClient,redirectTo});
}

await check('retorno é classificado sem copiar tokens ou descrições externas',async()=>{
  const entry=recoveryEntry(recoveryUrl);
  assert.deepEqual(entry,{recovery:true,hasAuth:true,hasError:false});
  assert.doesNotMatch(JSON.stringify(entry),/FIXTURE_ACCESS|FIXTURE_REFRESH/);
  assert.deepEqual(recoveryEntry(`${redirectTo}?error=access_denied&error_description=PRIVATE_DIAGNOSTIC`),{recovery:false,hasAuth:false,hasError:true});
});

await check('sessão de recuperação não persiste nem usa a chave de armazenamento do CRM',async()=>{
  const fixture=authFixture();
  const service=await serviceFor(fixture);
  assert.equal(fixture.options.auth.persistSession,false);
  assert.equal(fixture.options.auth.autoRefreshToken,false);
  assert.notEqual(fixture.options.auth.storageKey,'aq-crm-auth');
  assert.equal(fixture.options.auth.detectSessionInUrl,true);
  assert.deepEqual(await service.initialize(),{kind:'password'});
  assert.ok(fixture.getUserCalls>0,'The recovery user must be verified with Auth.');
});

await check('visita normal não autoriza alterar senha mesmo com uma sessão retornada pelo SDK',async()=>{
  const fixture=authFixture();
  const service=await serviceFor(fixture,redirectTo);
  assert.equal(fixture.options.auth.detectSessionInUrl,false);
  assert.deepEqual(await service.initialize(),{kind:'request'});
  await assert.rejects(service.update(password,password),error=>error.code==='session_not_found');
  assert.equal(fixture.updates.length,0);
});

await check('retornos expirados, incompletos e de outro fluxo não liberam o formulário de senha',async()=>{
  for(const suffix of [
    '?error=access_denied&error_code=otp_expired',
    '?code=unsupported-pkce-fixture',
    '#type=invite&access_token=FIXTURE_ACCESS&refresh_token=FIXTURE_REFRESH',
    '#type=recovery&access_token=FIXTURE_ACCESS'
  ]) {
    const fixture=authFixture();
    const service=await serviceFor(fixture,redirectTo+suffix);
    assert.deepEqual(await service.initialize(),{kind:'invalid'});
    await assert.rejects(service.update(password,password),error=>error.code==='session_not_found');
    assert.equal(fixture.updates.length,0);
  }
});

await check('retorno de recuperação precisa de sessão e usuário confirmados pelo servidor',async()=>{
  for(const absent of ['session','user']) {
    const fixture=authFixture();fixture[absent]=null;
    const service=await serviceFor(fixture);
    assert.deepEqual(await service.initialize(),{kind:'invalid'});
    await assert.rejects(service.update(password,password),error=>error.code==='session_not_found');
    assert.equal(fixture.updates.length,0);
  }
});

await check('confirmação divergente e senha curta não chegam ao SDK',async()=>{
  const fixture=authFixture();
  const service=await serviceFor(fixture);await service.initialize();
  await assert.rejects(service.update(password,'different-fixture'),/não coincidem/);
  await assert.rejects(service.update('short','short'),/8 e 128/);
  assert.throws(()=>validateNewPassword('x'.repeat(129),'x'.repeat(129)),/8 e 128/);
  assert.equal(fixture.updates.length,0);
});

await check('solicitação envia e-mail aparado e o redirect HTTPS exato permitido',async()=>{
  const fixture=authFixture();
  const service=await serviceFor(fixture,redirectTo);await service.initialize();
  await service.request('  fixture@example.test  ');
  assert.deepEqual(fixture.requests,[{email:'fixture@example.test',redirectTo}]);
  assert.equal(fixture.updates.length,0);
});

await check('alteração bem-sucedida encerra sessão e não pode ser repetida no mesmo fluxo',async()=>{
  const fixture=authFixture();
  const service=await serviceFor(fixture);await service.initialize();
  assert.deepEqual(await service.update(password,password),{signedOut:true});
  assert.deepEqual(fixture.updates,[{password}]);
  assert.deepEqual(fixture.signOuts,[{scope:'local'}]);
  assert.equal(fixture.unsubscribed,1);
  await assert.rejects(service.update(password,password),error=>error.code==='session_not_found');
  assert.equal(fixture.updates.length,1);
});

await check('falha no encerramento não afirma logout e ainda bloqueia novo envio de senha',async()=>{
  const fixture=authFixture();fixture.signOutError={status:0};
  const service=await serviceFor(fixture);await service.initialize();
  assert.deepEqual(await service.update(password,password),{signedOut:false});
  assert.equal(fixture.unsubscribed,1);
  await assert.rejects(service.update(password,password),error=>error.code==='session_not_found');
  assert.equal(fixture.updates.length,1);
});

await check('expiração ou logout durante o preenchimento impede atualização',async()=>{
  for(const cause of ['missing-user','signed-out']) {
    const fixture=authFixture();
    const service=await serviceFor(fixture);await service.initialize();
    if(cause==='missing-user')fixture.user=null;else fixture.emit('SIGNED_OUT',null);
    await assert.rejects(service.update(password,password),error=>error.code==='session_not_found');
    assert.equal(fixture.updates.length,0);
  }
});

await check('erros do provedor não são convertidos em sucesso ou encerramento',async()=>{
  const fixture=authFixture();fixture.requestError={code:'over_email_send_rate_limit'};
  const service=await serviceFor(fixture);await service.initialize();
  await assert.rejects(service.request('fixture@example.test'),error=>error.code==='over_email_send_rate_limit');
  fixture.updateError={code:'weak_password'};
  await assert.rejects(service.update(password,password),error=>error.code==='weak_password');
  assert.equal(fixture.signOuts.length,0);
  fixture.updateError=null;
  assert.deepEqual(await service.update(password,password),{signedOut:true});
});

await check('mensagens orientam recuperação sem exibir detalhes internos',async()=>{
  const cases=[
    [{code:'otp_expired'},/expirou/],
    [{status:401},/novo link/],
    [{code:'same_password'},/diferente/],
    [{code:'weak_password'},/mais forte/],
    [{code:'over_email_send_rate_limit'},/limite de tentativas/],
    [{status:429},/Aguarde/],
    [{code:'email_not_confirmed'},/confirmado/],
    [{name:'AuthRetryableFetchError'},/conexão/],
    [{status:0},/conexão/],
    [{status:500},/indisponível/]
  ];
  for(const [error,expected] of cases) {
    const message=recoveryMessage({...error,message:'PRIVATE_DIAGNOSTIC'});
    assert.match(message,expected);assert.doesNotMatch(message,/PRIVATE_DIAGNOSTIC/);
  }
});

await check('configuração rejeita segredo e destino sem HTTPS antes de carregar o SDK',async()=>{
  const fixture=authFixture();
  await assert.rejects(createRecoveryService({...config,publishableKey:'sb_secret_fixture'},recoveryEntry(recoveryUrl),{createClient:fixture.createClient,redirectTo}),/não foi configurada/);
  await assert.rejects(createRecoveryService(config,recoveryEntry(recoveryUrl),{createClient:fixture.createClient,redirectTo:'http://example.test/admin/redefinir-senha.html'}),/HTTPS/);
  assert.equal(fixture.options,null);
});

process.stdout.write(`${passed} cenários de recuperação passaram. Nenhum e-mail enviado ou senha real alterada. O link completo e a limpeza do histórico exigem validação no navegador.\n`);
