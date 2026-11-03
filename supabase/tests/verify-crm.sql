-- Achei Quem / CRM: verification for the dedicated DEVELOPMENT project.
-- Run the WHOLE script as the database owner in Supabase SQL Editor.
-- There must be exactly one administrator; no identity is hard-coded here.
-- All fixtures and their audit entries are rolled back. No schema, membership,
-- permission or real registration is changed. No email or HTTP request is sent.
-- An unexpected error aborts this transaction: do not replace ROLLBACK with COMMIT.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';

do $setup$
declare
  administrator uuid;
  members integer;
  relation text;
  privilege text;
  tables text[] := array['public.aq_categories','public.aq_professionals',
    'public.aq_clients','public.aq_category_requests','public.aq_transactions','public.aq_audit'];
begin
  select count(*), (array_agg(user_id))[1] into members, administrator
    from aq_private.admin_members;
  if members <> 1 then
    raise exception 'Verification requires exactly one administrator in this dedicated development project; found %.', members;
  end if;
  perform set_config('aq_test.admin_uid', administrator::text, true);
  perform set_config('aq_test.other_uid', gen_random_uuid()::text, true);
  if exists(select 1 from aq_private.admin_members
    where user_id=current_setting('aq_test.other_uid')::uuid) then
    raise exception 'Unexpected collision in non-administrator fixture.';
  end if;
  perform set_config('aq_test.professional_id',gen_random_uuid()::text,true);
  perform set_config('aq_test.client_id',gen_random_uuid()::text,true);
  perform set_config('aq_test.category_id',gen_random_uuid()::text,true);
  perform set_config('aq_test.requested_category_id',gen_random_uuid()::text,true);
  perform set_config('aq_test.request_id',gen_random_uuid()::text,true);
  perform set_config('aq_test.transaction_id',gen_random_uuid()::text,true);
  perform set_config('aq_test.passed','[]',true);

  foreach relation in array tables || array['aq_private.admin_members'] loop
    if not exists(select 1 from pg_class where oid=relation::regclass and relrowsecurity) then
      raise exception 'RLS is not enabled on %.',relation;
    end if;
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if has_table_privilege('anon',relation,privilege) then
        raise exception 'Anonymous role unexpectedly has % on %.',privilege,relation;
      end if;
    end loop;
  end loop;
  foreach relation in array tables loop
    if has_table_privilege('authenticated',relation,'DELETE') then
      raise exception 'Authenticated role unexpectedly has DELETE on %.',relation;
    end if;
  end loop;
  if has_schema_privilege('authenticated','aq_private','USAGE')
    or has_table_privilege('authenticated','aq_private.admin_members','INSERT') then
    raise exception 'Frontend role can access or modify administrative membership.';
  end if;
  if has_table_privilege('authenticated','public.aq_audit','INSERT')
    or has_table_privilege('authenticated','public.aq_audit','UPDATE') then
    raise exception 'Frontend role can forge or edit audit entries.';
  end if;
  if has_function_privilege('anon','public.aq_is_admin()','EXECUTE')
    or has_function_privilege('anon','public.aq_resolve_category_request(uuid,uuid)','EXECUTE') then
    raise exception 'Anonymous role can execute administrative functions.';
  end if;
  perform set_config('aq_test.passed',jsonb_build_array(
    'RLS enabled on all administrative tables',
    'Anonymous grants and administrative function execution denied',
    'No frontend deletion or membership escalation grants',
    'Audit grants are read-only for authenticated users')::text,true);

  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
end;
$setup$;

set local role anon;
do $anonymous$
declare
  relation text;
  denied boolean;
  tables text[] := array['public.aq_categories','public.aq_professionals',
    'public.aq_clients','public.aq_category_requests','public.aq_transactions','public.aq_audit'];
begin
  if current_user <> 'anon' then raise exception 'Anonymous test is running under the wrong role.'; end if;
  foreach relation in array tables loop
    denied := false;
    begin
      execute format('select 1 from %s limit 1',relation);
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Anonymous table access was allowed: %.',relation; end if;
  end loop;
  denied := false;
  begin
    perform public.aq_is_admin();
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Anonymous admin function execution was allowed.'; end if;
  perform set_config('aq_test.passed',(current_setting('aq_test.passed')::jsonb ||
    jsonb_build_array('Actual anonymous table reads denied','Actual anonymous admin RPC denied'))::text,true);
end;
$anonymous$;

reset role;
do $ordinary_claims$
begin
  perform set_config('request.jwt.claim.sub',current_setting('aq_test.other_uid'),true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',current_setting('aq_test.other_uid'),'role','authenticated',
    'user_metadata',jsonb_build_object('is_admin',true,'role','admin'))::text,true);
end;
$ordinary_claims$;
set local role authenticated;

do $ordinary_user$
declare relation text; visible_rows bigint; denied boolean;
begin
  if current_user <> 'authenticated' then raise exception 'Ordinary-user test is running under the wrong role.'; end if;
  if public.aq_is_admin() then raise exception 'Metadata spoofing granted administrative access.'; end if;
  foreach relation in array array['public.aq_categories','public.aq_professionals',
    'public.aq_clients','public.aq_category_requests','public.aq_transactions','public.aq_audit'] loop
    execute format('select count(*) from %s',relation) into visible_rows;
    if visible_rows <> 0 then raise exception 'Ordinary user can read administrative rows in %.',relation; end if;
  end loop;
  denied := false;
  begin
    insert into public.aq_professionals(name,city) values ('__AQ_TEST_UNAUTHORIZED__','Taubaté');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Ordinary user inserted an administrative professional record.'; end if;

  denied := false;
  begin
    insert into aq_private.admin_members(user_id) values(current_setting('aq_test.other_uid')::uuid);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Ordinary user promoted their own identity.'; end if;

  denied := false;
  begin
    perform public.aq_resolve_category_request(current_setting('aq_test.request_id')::uuid,
      current_setting('aq_test.category_id')::uuid);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Ordinary user executed the category-resolution RPC.'; end if;
  perform set_config('aq_test.passed',(current_setting('aq_test.passed')::jsonb || jsonb_build_array(
    'Authenticated non-admin sees no administrative rows',
    'User metadata cannot grant admin membership',
    'Authenticated non-admin insert denied',
    'Self-promotion to administrator denied',
    'Category-resolution RPC denied to non-admin'))::text,true);
end;
$ordinary_user$;

reset role;
do $administrator_claims$
begin
  perform set_config('request.jwt.claim.sub',current_setting('aq_test.admin_uid'),true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',current_setting('aq_test.admin_uid'),'role','authenticated')::text,true);
end;
$administrator_claims$;
set local role authenticated;

do $administrator_workflow$
declare
  professional_id uuid := current_setting('aq_test.professional_id')::uuid;
  client_id uuid := current_setting('aq_test.client_id')::uuid;
  category_id uuid := current_setting('aq_test.category_id')::uuid;
  requested_category_id uuid := current_setting('aq_test.requested_category_id')::uuid;
  request_id uuid := current_setting('aq_test.request_id')::uuid;
  transaction_id uuid := current_setting('aq_test.transaction_id')::uuid;
  blocked boolean;
  observed_message text;
  audited bigint;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if current_user <> 'authenticated' then raise exception 'Administrator test is running under the wrong database role.'; end if;
  if not public.aq_is_admin() then raise exception 'The configured administrator was not recognized.'; end if;
  if not exists(select 1 from public.aq_categories) then raise exception 'Administrator cannot read the initial category catalogue.'; end if;

  insert into public.aq_categories(id,name,description) values
    (category_id,'__AQ_TEST_BASE_'||category_id::text,'Temporary verification fixture; rolled back.');
  insert into public.aq_categories(id,name,description,active) values
    (requested_category_id,'__AQ_TEST_REQUESTED_'||requested_category_id::text,'Temporary verification fixture; rolled back.',false);

  -- photo_index must not substitute for a real HTTPS photo at approval time.
  blocked := false;
  begin
    insert into public.aq_professionals(name,city,cities,description,skills,categories,photo_index,status)
    values ('__AQ_TEST_INVALID_PHOTO__','Taubaté',array['Taubaté'],
      'Temporary synthetic professional used only for transactional verification.',
      array['Test skill'],array[category_id],0,'approved');
  exception when check_violation then
    get stacked diagnostics observed_message = message_text;
    if observed_message not like 'Para aprovar,%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'A professional without an HTTPS photo was approved.'; end if;

  insert into public.aq_professionals(id,name,email,city,cities,description,skills,categories,photo_url,status,subscription_status)
  values (professional_id,'__AQ_TEST_PROFESSIONAL__','fixture@example.test','São José dos Campos',
    array['São José dos Campos','Taubaté'],
    'Temporary synthetic professional used only for transactional verification.',
    array['Test skill'],array[category_id],'https://example.invalid/fixture.png','pending','inactive');
  insert into public.aq_clients(id,name,email,city)
    values(client_id,'__AQ_TEST_CLIENT__','client@example.test','Taubaté');
  insert into public.aq_category_requests(id,professional_id,name)
    values(request_id,professional_id,'__AQ_TEST_REQUEST__');

  blocked := false;
  begin
    update public.aq_professionals set status='approved' where id=professional_id;
  exception when check_violation then
    get stacked diagnostics observed_message = message_text;
    if observed_message not like 'Resolva o pedido de nova categoria%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Pending category request did not block approval.'; end if;

  blocked := false;
  begin
    perform public.aq_resolve_category_request(request_id,requested_category_id);
  exception when check_violation then
    get stacked diagnostics observed_message = message_text;
    if observed_message not like 'Vincule uma categoria ativa.%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Category request resolved to an inactive category.'; end if;
  update public.aq_categories set active=true where id=requested_category_id;
  perform public.aq_resolve_category_request(request_id,requested_category_id);
  if not exists(select 1 from public.aq_category_requests r
    where r.id=request_id and r.status='resolved' and r.category_id=requested_category_id) then
    raise exception 'Resolution RPC did not update the requested category.';
  end if;
  if not exists(select 1 from public.aq_professionals p
    where p.id=professional_id and requested_category_id=any(p.categories)) then
    raise exception 'Resolution RPC did not link the category to its professional.';
  end if;

  blocked := false;
  begin
    perform public.aq_resolve_category_request(request_id,requested_category_id);
  exception when check_violation then
    get stacked diagnostics observed_message = message_text;
    if observed_message not like 'Categoria já analisada.%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Category request was resolved twice.'; end if;

  insert into public.aq_transactions(id,direction,kind,description,professional_id,amount_cents,due_on,payment_method)
    values(transaction_id,'income','subscription','__AQ_TEST_INVOICE__',professional_id,12345,today-1,'pix');
  update public.aq_transactions set status='paid',paid_on=today where id=transaction_id;
  if not exists(select 1 from public.aq_transactions t where t.id=transaction_id
    and t.status='paid' and t.paid_on=today and t.amount_cents=12345) then
    raise exception 'Financial settlement did not preserve its value and payment date.';
  end if;
  if not exists(select 1 from public.aq_professionals p where p.id=professional_id
    and p.status='pending' and p.subscription_status='inactive') then
    raise exception 'Payment unexpectedly changed approval or subscription state.';
  end if;

  blocked := false;
  begin
    update public.aq_transactions set status='paid',paid_on=today where id=transaction_id;
  exception when check_violation then
    get stacked diagnostics observed_message = message_text;
    if observed_message not like 'Este lançamento já foi liquidado%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'A financial transaction was settled twice.'; end if;

  blocked := false;
  begin
    update public.aq_transactions set amount_cents=1 where id=transaction_id;
  exception when check_violation then
    get stacked diagnostics observed_message = message_text;
    if observed_message not like 'Este lançamento já foi liquidado%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'The amount of a paid transaction was overwritten.'; end if;

  update public.aq_professionals set status='approved' where id=professional_id;
  if not exists(select 1 from public.aq_professionals p where p.id=professional_id
    and p.status='approved' and p.subscription_status='inactive') then
    raise exception 'Approval failed or unexpectedly activated the subscription.';
  end if;

  select count(*) into audited from public.aq_audit a
    where a.entity_id=any(array[professional_id,client_id,category_id,requested_category_id,request_id,transaction_id]);
  if audited <> 11 then raise exception 'Expected 11 fixture audit entries; found %.',audited; end if;
  if exists(select 1 from public.aq_audit a where
    a.entity_id=any(array[professional_id,client_id,category_id,requested_category_id,request_id,transaction_id])
    and (a.actor_id is distinct from auth.uid() or cardinality(a.changed_fields)=0)) then
    raise exception 'Audit trail has missing authorship or changed-field information.';
  end if;
  if not exists(select 1 from public.aq_audit a where a.entity_id=transaction_id
    and a.action='update' and 'status'=any(a.changed_fields) and 'paid_on'=any(a.changed_fields)) then
    raise exception 'Audit trail did not record the settlement fields.';
  end if;

  blocked := false;
  begin
    insert into public.aq_audit(entity,entity_id,action) values('test',professional_id,'forged');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Administrator browser role forged an audit entry directly.'; end if;
  blocked := false;
  begin
    update public.aq_audit set action='forged' where entity_id=professional_id;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Administrator browser role edited the audit trail directly.'; end if;

  perform set_config('aq_test.passed',(current_setting('aq_test.passed')::jsonb || jsonb_build_array(
    'Administrator reads catalogue and creates isolated fixtures',
    'Approval rejects a missing photo even with photo_index',
    'Pending category request blocks professional approval',
    'Inactive requested category is rejected',
    'Resolution RPC atomically links category and resolves request',
    'Category request cannot be resolved twice',
    'Financial settlement preserves integer cents and payment date',
    'Payment does not grant approval or activate subscription',
    'Repeated settlement and paid-amount editing are rejected',
    'Professional approval succeeds only after requirements are met',
    'Audit contains all 11 fixture changes with author and changed fields',
    'Direct audit insertion and editing are denied'))::text,true);
end;
$administrator_workflow$;

reset role;
select
  'PASS — all assertions completed; fixtures will be rolled back' as result,
  jsonb_array_length(current_setting('aq_test.passed')::jsonb) as checks_passed,
  current_setting('aq_test.passed')::jsonb as checks;

rollback;
