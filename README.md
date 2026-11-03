# Achei Quem — protótipo

Catálogo de profissionais do Vale do Paraíba paulista. **Bora resolver** é a direção visual escolhida em 03/11/2026. As alternativas anteriores permanecem no histórico do Git.

HTML, CSS e JavaScript, sem etapa de build. Imagens e fontes são servidas junto com o site. O CRM conectado carrega o SDK oficial do Supabase; a demonstração pública funciona sem essa dependência. A interface se adapta a celular e computador.

## Abrir localmente

Abra `dist/index.html` no navegador ou execute, na raiz:

```powershell
node scripts/serve.mjs
```

O servidor escuta somente em `http://127.0.0.1:4173`. Para encerrar, use Ctrl+C.

## Experimentar

1. Explore a direção Bora resolver na página inicial.
2. Busque por cidade, categoria e habilidade.
3. Abra um perfil e use uma conta de exemplo para registrar um serviço.
4. Simule o aceite e a conclusão pelo profissional, confirme como cliente e avalie.
5. Experimente o cadastro profissional com foto, várias categorias e cidades.

No site público, contas, serviços, fotos adicionadas, avaliações e assinaturas são **simulações em memória da aba**. Recarregar apaga esses dados. Os cadastros públicos reais ficam para o lançamento. Nenhuma cobrança, mensagem ou contratação real é executada.

## Painel administrativo

O CRM fica em `/admin/`, separado da demonstração pública. Possui modo de demonstração explícito e conexão com Supabase. Somente administradores autorizados no banco podem acessar dados conectados; o login não concede acesso administrativo por si só.

Inclui análise de profissionais, múltiplas categorias e cidades, resolução de pedidos de categoria, consulta de clientes, situação de assinaturas, entradas e saídas manuais, vencimentos e histórico administrativo. Aprovação, assinatura e pagamento são estados independentes. Não há gateway nem movimentação de dinheiro.

`dist/admin/config.js` aceita apenas a URL do projeto e a chave pública publishable. Nunca inclua chaves secret/service_role ou senhas nesse arquivo. Configuração vazia mantém a conexão indisponível; erros de autenticação não devem levar silenciosamente para dados fictícios. A preparação do banco e as políticas de acesso ficam em `supabase/`.

O e-mail e a senha do CRM pertencem ao usuário criado em **Supabase → Authentication → Users**. São independentes da senha do banco e do acesso ao painel do provedor. O login reutiliza uma única conexão por página e diferencia problemas de credenciais, rede, confirmação e limite de tentativas.

Em **Esqueci minha senha**, informe o e-mail da conta e abra o link mais recente recebido. A página de recuperação mantém uma sessão temporária em memória, separada do CRM, remove os dados de autenticação da URL e encerra essa sessão após a alteração. O formulário exige HTTPS e não executa a recuperação pelo servidor local HTTP. O envio depende da configuração e dos limites de e-mail do Supabase.

Os retratos foram gerados para demonstração. Nomes e avaliações são fictícios. Não use dados pessoais reais. Nunito Sans e Lora usam a licença OFL incluída em `dist/assets/fonts`.

## Verificações locais

```powershell
node scripts/check-flows.mjs
node scripts/check-crm-data.mjs
node --check dist/app.js
node --check dist/admin/app.js
```

Em 03/11/2026: nove cenários da demonstração pública e doze do adaptador do CRM aprovados; layout e fluxos conferidos no navegador em desktop e celular. A verificação `supabase/tests/verify-crm.sql` passou nas 23 asserções no projeto dedicado, com ROLLBACK de todos os registros e auditoria de teste. Esses checks não equivalem a uma auditoria completa de segurança.

## Publicação

### Cloudflare Pages — hospedagem escolhida

Em 03/11/2026 o usuário escolheu Cloudflare Pages gratuito com Supabase Free. O diretório estático é `dist`, sem instalação ou build; a publicação pode usar Git ou envio de ZIP pelo painel. O arquivo `dist/_headers` define cabeçalhos e desativa o cache da interface administrativa. A API do Supabase segue protegida pelas políticas do banco.

Publicado e renderizado no navegador em 03/11/2026:

- Site: [acheiquem.pages.dev](https://acheiquem.pages.dev/)
- CRM: [acheiquem.pages.dev/admin/](https://acheiquem.pages.dev/admin/)

Projeto Cloudflare `acheiquem`, com **Direct Upload**: ZIP do conteúdo de `dist`, mantendo `index.html` na raiz do arquivo. Não há integração automática com o GitHub. Para atualizar, revisar e salvar o código, gerar outro ZIP e usar **Criar implantação → Produção → Salvar e implantar** no painel. Conferir a URL publicada após a implantação; preservar a versão anterior para eventual rollback.

O cadastro público permanece demonstrativo. A migração do Supabase foi aplicada, o signup público está desativado e a conta administrativa foi autorizada. O CRM real requer essa conta; a demonstração não grava dados no banco. Ambos os serviços usam os planos gratuitos, sujeitos às cotas e condições dos provedores; o Supabase Free pode pausar por inatividade.

### Vercel — configuração alternativa

O arquivo `vercel.json` configura site estático: framework Other, comandos de instalação e build vazios, diretório de saída `dist`. O CRM usa `/admin/index.html` (ou `/admin/`); o site público mantém navegação por hash. `docs`, `evidencias`, `supabase` e notas locais ficam fora do pacote de publicação, conforme `.vercelignore`.

A configuração no repositório não comprova publicação na Vercel. O plano Hobby é restrito a uso pessoal não comercial; esta alternativa ficou para depois. Nenhum plano pago foi contratado.

### GitHub Pages existente

A publicação no GitHub Pages foi solicitada para compartilhar a prévia. A branch `gh-pages` contém somente os arquivos de `dist`; documentos de planejamento, notas de trabalho e capturas ficam locais.

Após uma mudança revisada e commitada:

```powershell
git subtree split --prefix dist -b publicacao-atual
git push origin publicacao-atual:gh-pages
git branch -d publicacao-atual
```

Não use force-push. O site público é apenas uma prévia, sem recursos de produção.
