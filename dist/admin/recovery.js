// Auth-only page: it never loads administrative records or shares the CRM session.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const EXPIRED_CODES = new Set(['otp_expired','flow_state_expired','flow_state_not_found','session_not_found','refresh_token_not_found','refresh_token_already_used','bad_jwt']);

export function recoveryEntry(url) {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.slice(1));
  const query = parsed.searchParams;
  return {
    recovery:hash.get('type')==='recovery' && hash.has('access_token') && hash.has('refresh_token'),
    hasAuth:hash.has('access_token') || hash.has('refresh_token') || hash.has('type') || query.has('code') || query.has('token_hash'),
    hasError:hash.has('error') || hash.has('error_code') || query.has('error') || query.has('error_code')
  };
}
export function validateNewPassword(password, confirmation) {
  if (typeof password!=='string' || password.length<8 || password.length>128) throw new Error('Use uma senha entre 8 e 128 caracteres.');
  if (password!==confirmation) throw new Error('As senhas não coincidem. Digite a mesma senha nos dois campos.');
}
export function recoveryMessage(error) {
  if (error?.code==='same_password') return 'Escolha uma senha diferente da senha atual.';
  if (error?.code==='weak_password') return 'Use uma senha mais forte e evite senhas comuns.';
  if (['over_request_rate_limit','over_email_send_rate_limit'].includes(error?.code) || error?.status===429) return 'O limite de tentativas foi atingido. Aguarde antes de tentar novamente.';
  if (EXPIRED_CODES.has(error?.code) || error?.status===401 || error?.status===403) return 'Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.';
  if (error?.code==='email_not_confirmed') return 'Seu e-mail ainda precisa ser confirmado. Fale com a equipe do Achei Quem para recuperar o acesso.';
  if (error?.name==='AuthRetryableFetchError' || error?.status===0) return 'Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.';
  return 'A recuperação de acesso está indisponível no momento. Tente mais tarde ou fale com a equipe do Achei Quem.';
}
function publicKey(key) {
  if (key?.startsWith('sb_publishable_')) return true;
  if (!key || key.startsWith('sb_secret_')) return false;
  try {return JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';} catch {return false;}
}

export async function createRecoveryService(config, entry, {createClient, redirectTo} = {}) {
  if (!config?.supabaseUrl || !publicKey(config.publishableKey)) throw new Error('A recuperação de acesso ainda não foi configurada. Fale com a equipe do Achei Quem.');
  const projectUrl=new URL(config.supabaseUrl);
  const destination=new URL(redirectTo);
  if (projectUrl.protocol!=='https:' || destination.protocol!=='https:') throw new Error('Use o endereço HTTPS publicado para recuperar o acesso.');
  const factory=createClient || (await import(SDK_URL)).createClient;
  const client=factory(projectUrl.origin,config.publishableKey,{auth:{
    persistSession:false, autoRefreshToken:false, storageKey:'aq-crm-recovery',
    detectSessionInUrl:entry.recovery && !entry.hasError, flowType:'implicit'
  }});
  let ready=false;
  let recoveryEvent=false;
  const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
    // Do not await auth calls inside an auth event callback.
    if(event==='PASSWORD_RECOVERY' && entry.recovery && session) recoveryEvent=true;
    if(event==='SIGNED_OUT') ready=false;
  });
  return {
    async initialize(){
      if(entry.hasError || (entry.hasAuth && !entry.recovery)) return {kind:'invalid'};
      if(!entry.recovery) return {kind:'request'};
      const {data,error}=await client.auth.getSession(); // Waits for URL consumption.
      if(error)throw error;
      if(!data.session) return {kind:'invalid'};
      const verified=await client.auth.getUser();
      if(verified.error)throw verified.error;
      if(!verified.data.user) return {kind:'invalid'};
      // The original recovery marker and the verified session also cover event
      // delivery scheduled just after getSession resolves in the SDK.
      ready=entry.recovery && Boolean(recoveryEvent || data.session);
      return {kind:'password'};
    },
    async request(email){
      const {error}=await client.auth.resetPasswordForEmail(String(email).trim(),{redirectTo:destination.href});
      if(error)throw error;
    },
    async update(password,confirmation){
      validateNewPassword(password,confirmation);
      if(!ready)throw Object.assign(new Error('Recovery session required'),{code:'session_not_found'});
      const verified=await client.auth.getUser();
      if(verified.error)throw verified.error;
      if(!verified.data.user){ready=false;throw Object.assign(new Error('Recovery session expired'),{code:'session_not_found'});}
      const {error}=await client.auth.updateUser({password});
      if(error)throw error;
      ready=false;
      let signedOut=false;
      try {const result=await client.auth.signOut({scope:'local'});signedOut=!result.error;} catch {}
      subscription.unsubscribe();
      return {signedOut};
    }
  };
}

async function startPage() {
  const $=id=>document.getElementById(id);
  const requestForm=$('request-form'), passwordForm=$('password-form');
  const initial=recoveryEntry(location.href);
  const showError=message=>{$('recovery-error').textContent=message;$('recovery-error').hidden=!message;};
  const showStatus=message=>{$('recovery-status').textContent=message;$('recovery-status').hidden=!message;};
  const cleanUrl=()=>history.replaceState(null,'',location.pathname);
  const invalid=()=>{
    passwordForm.reset();passwordForm.hidden=true;requestForm.hidden=false;
    $('recovery-title').textContent='Peça um novo link';
    $('recovery-description').textContent='O link de recuperação não é válido ou já expirou.';
    showError('Solicite um novo link e abra o e-mail mais recente para continuar.');
  };
  let service;
  let cooldown=0, timer, requesting=false, updating=false;
  function startCooldown(){
    cooldown=Date.now()+60000;clearInterval(timer);
    const update=()=>{
      const seconds=Math.max(0,Math.ceil((cooldown-Date.now())/1000));
      $('request-button').disabled=seconds>0;
      $('request-button').textContent=seconds?`Aguarde ${seconds}s para reenviar`:'Enviar novo link';
      if(!seconds)clearInterval(timer);
    };
    update();timer=setInterval(update,1000);
  }
  try {
    service=await createRecoveryService(window.AQCRM_CONFIG,initial,{redirectTo:new URL('/admin/redefinir-senha.html',location.origin).href});
    const state=await service.initialize();
    cleanUrl();
    if(state.kind==='invalid')invalid();
    else if(state.kind==='password'){
      $('recovery-description').textContent='Escolha uma nova senha para voltar ao painel.';
      passwordForm.hidden=false;$('new-password').focus();
    } else requestForm.hidden=false;
  } catch(error) {
    cleanUrl();
    showError(/^(A recuperação de acesso ainda|Use o endereço HTTPS)/.test(error?.message)?error.message:recoveryMessage(error));
    if(service)requestForm.hidden=false;
  } finally {$('recovery-loading').hidden=true;}

  requestForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!service || requesting || Date.now()<cooldown || !requestForm.reportValidity())return;
    requesting=true;
    showError('');showStatus('');$('request-button').disabled=true;$('request-button').textContent='Enviando link…';
    try {
      await service.request($('recovery-email').value);
      showStatus('Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Confira também a pasta de spam e abra o e-mail mais recente.');
      startCooldown();
    } catch(error){showError(recoveryMessage(error));if(error?.status===429 || error?.code?.includes('rate_limit'))startCooldown();}
    finally{requesting=false;if(Date.now()>=cooldown){$('request-button').disabled=false;$('request-button').textContent='Enviar link de recuperação';}}
  });
  passwordForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!service || updating || !passwordForm.reportValidity())return;
    showError('');showStatus('');
    try{validateNewPassword($('new-password').value,$('confirm-password').value);}catch(error){showError(error.message);return;}
    updating=true;
    $('password-button').disabled=true;$('password-button').textContent='Salvando senha…';
    try{
      const result=await service.update($('new-password').value,$('confirm-password').value);
      passwordForm.reset();passwordForm.hidden=true;requestForm.hidden=true;
      $('recovery-title').textContent='Senha alterada';$('recovery-description').textContent='Você já pode usar sua nova senha.';
      $('success-message').textContent=result.signedOut?'A sessão de recuperação foi encerrada. Entre novamente para acessar o painel.':'Feche esta aba para encerrar a sessão temporária e depois entre com a nova senha.';
      $('recovery-success').hidden=false;$('recovery-title').focus();
    }catch(error){
      if(EXPIRED_CODES.has(error?.code)||error?.status===401||error?.status===403)invalid();else showError(recoveryMessage(error));
    }finally{updating=false;$('password-button').disabled=false;$('password-button').textContent='Salvar nova senha';}
  });
  $('show-passwords').addEventListener('change',event=>{
    const type=event.target.checked?'text':'password';$('new-password').type=type;$('confirm-password').type=type;
  });
  window.addEventListener('pagehide',()=>{clearInterval(timer);passwordForm.reset();},{once:true});
}
if(typeof window!=='undefined' && typeof document!=='undefined') startPage();
