# Achei Quem — protótipo

Três propostas de interface para um catálogo de profissionais do Vale do Paraíba paulista: **Praça**, **Bora resolver** e **Perto de você**.

HTML, CSS e JavaScript sem dependências de execução ou build. Imagens e fontes são servidas junto com o site. A interface se adapta a celular e computador.

## Abrir localmente

Abra `dist/index.html` no navegador ou execute, na raiz:

```powershell
node scripts/serve.mjs
```

O servidor escuta somente em `http://127.0.0.1:4173`. Para encerrar, use Ctrl+C.

## Experimentar

1. Alterne entre as três propostas pela barra superior.
2. Busque por cidade, categoria e habilidade.
3. Abra um perfil e use uma conta de exemplo para registrar um serviço.
4. Simule o aceite e a conclusão pelo profissional, confirme como cliente e avalie.
5. Experimente o cadastro profissional com foto, várias categorias e cidades.

Contas, serviços, fotos adicionadas, avaliações e assinaturas são **simulações em memória da aba**. Recarregar apaga esses dados. Apenas a escolha visual pode ficar no armazenamento local do navegador. Não há autenticação real, banco, cobrança, mensagens nem contratação.

Os retratos foram gerados para demonstração. Nomes e avaliações são fictícios. Não use dados pessoais reais. Nunito Sans e Lora usam a licença OFL incluída em `dist/assets/fonts`.

## Verificações locais

```powershell
node scripts/check-flows.mjs
node --check dist/app.js
node --check dist/home.js
```

O teste de lógica não substitui a validação visual no navegador nem testes do futuro backend.

## Publicação

A publicação no GitHub Pages foi solicitada para compartilhar a prévia. A branch `gh-pages` contém somente os arquivos de `dist`; documentos de planejamento, notas de trabalho e capturas ficam locais.

Após uma mudança revisada e commitada:

```powershell
git subtree split --prefix dist -b publicacao-atual
git push origin publicacao-atual:gh-pages
git branch -d publicacao-atual
```

Não use force-push. O site público é apenas uma prévia, sem recursos de produção.
