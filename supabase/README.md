# Supabase — primeira etapa administrativa

Esta pasta contém a migração do CRM, aplicada no projeto dedicado em 03/11/2026. O cadastro público foi desativado e a primeira conta administrativa foi autorizada pelo responsável. Esses passos precisam ser executados novamente em qualquer projeto novo; a publicação estática, sozinha, não configura o banco.

## Modelo e isolamento

- `aq_professionals`, `aq_clients`, `aq_categories`, `aq_category_requests`: cadastros administrativos. A aprovação é independente da situação da assinatura.
- `aq_transactions`: entradas e saídas em centavos inteiros; `pending`, `paid` ou `cancelled`. Atraso é calculado pelo vencimento. Um lançamento liquidado não é sobrescrito; estorno/retificação requer evolução própria antes do uso financeiro comercial.
- `aq_audit`: registro de autor, horário, entidade, ação e campos alterados. A trilha não copia dados pessoais completos nem senhas.
- `aq_private.admin_members`: lista de usuários administrativos, fora dos schemas expostos pela API. Não pode ser alterada pelo navegador.
- Todas as tabelas públicas usam RLS. Apenas uma sessão autenticada cuja identidade existe em `admin_members` tem permissão. O público e clientes comuns não têm acesso aos registros do CRM.
- Nenhum dado fictício de pessoa ou financeiro é enviado ao banco. A migração inclui apenas oito categorias iniciais.

## Preparação no painel Supabase

1. Usar um projeto dedicado ao Achei Quem e aplicar `migrations/202611030001_crm.sql` uma vez. A migração é transacional; não a reaplicar em um banco já migrado.
2. Enquanto os cadastros reais não forem lançados, desabilitar o cadastro público em Authentication. Criar a primeira conta administrativa pelo fluxo privado do painel, com senha definida pelo próprio responsável. Não colocar senha em arquivo público ou nesta documentação.
3. O responsável pelo banco autoriza explicitamente a conta administrativa criada, usando o seu UUID confirmado em Authentication → Users:

   ```sql
   insert into aq_private.admin_members(user_id)
   values ('UUID-DA-CONTA-ADMINISTRATIVA'::uuid);
   ```

   Esse passo concede acesso ao financeiro e a todos os cadastros. Não usar e-mail recebido do formulário, user metadata nem código público para conceder esse papel.

4. Configurar somente a URL do projeto e a chave **publishable** (ou a chave `anon` legada) em `dist/admin/config.js`, no objeto usado pela interface. Nunca usar secret/service_role, senha do banco ou token pessoal no frontend.
5. Conferir os testes funcionais e as políticas em um projeto de desenvolvimento antes de inserir dados reais: usuário anônimo sem acesso; usuário autenticado comum sem acesso; administrador consegue consultar/aprovar; usuário comum não consegue promover a si mesmo; ações geram auditoria; foto/categorias/pendências bloqueiam aprovação incompleta; confirmação financeira não pode ocorrer duas vezes.

O CRM usa o SDK oficial `@supabase/supabase-js` 2.118.0, carregado do jsDelivr somente quando há configuração real. O modo demonstrativo é escolhido explicitamente e funciona em memória, sem SDK e sem rede. Falhas de autenticação ou de banco nunca são convertidas automaticamente em demonstração.

## Recuperação de senha

Em Authentication → URL Configuration, Site URL configurado como `https://acheiquem.pages.dev/admin/` e um único Redirect URL permitido: `https://acheiquem.pages.dev/admin/redefinir-senha.html`, sem curingas. O formulário em `dist/admin/redefinir-senha.html` solicita o e-mail de recuperação com esse destino explícito. O botão de recuperação do dashboard usa o Site URL padrão; prefira o formulário do CRM.

O retorno usa `PASSWORD_RECOVERY`, valida a sessão com o serviço de autenticação e permite ao próprio usuário definir e confirmar a nova senha. Não copia a sessão de recuperação para o armazenamento do CRM nem carrega dados administrativos. Links inválidos ou expirados permitem solicitar outro e-mail; a alteração nunca deve ser feita com senha enviada por chat ou salva em SQL.

Ao mudar o domínio, atualizar Site URL, o destino permitido e o frontend no mesmo procedimento. Documentação oficial: [recuperação por senha](https://supabase.com/docs/guides/auth/passwords).

## Limites desta etapa

- O cadastro público, uploads de fotos/portfólio, confirmação de serviços e avaliações reais permanecem para o lançamento funcional; não abrir permissões das tabelas administrativas para tentar habilitá-los.
- Não há gateway, cobrança automática, emissão fiscal, extrato bancário ou integração de WhatsApp. Os lançamentos do CRM representam registro manual, sem movimentar dinheiro.
- O saldo calculado é entradas recebidas menos saídas pagas no período, sem presumir saldo bancário inicial.
- Em produção será preciso evoluir lançamentos para estornos/correções rastreáveis, política de retenção, exportações, regras comerciais e testes de integração do backend.

## Verificação no projeto dedicado

`tests/verify-crm.sql` foi executado integralmente pelo SQL Editor em 03/11/2026: **PASS, 23 verificações**. Testa permissões de visitante e usuário comum, bloqueio de autoconcessão administrativa, aprovação, resolução de categorias, baixa financeira única e auditoria. Usa a identidade administrativa existente, registros sintéticos temporários e `ROLLBACK`; nenhum cadastro ou lançamento de teste foi mantido.

O script exige exatamente um administrador no ambiente dedicado. Não é uma rotina para rodar indiscriminadamente em produção nem deve ser alterado para usar `COMMIT`. Os testes SQL não substituem a validação de login e sessão no navegador.

Em 03/11/2026, após a redefinição confirmada pelo responsável, o acesso real foi observado no navegador: oito categorias ativas, nenhum cadastro ou lançamento financeiro e restauração da sessão após recarregar. A conferência pelo frontend foi de leitura; nenhuma informação de teste foi gravada no banco por essa interface.

Referências consultadas em 03/11/2026: [SDK oficial](https://supabase.com/docs/reference/javascript/installing), [registro oficial da versão](https://registry.npmjs.org/@supabase/supabase-js/2.118.0), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
