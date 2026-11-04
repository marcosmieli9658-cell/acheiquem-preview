(function () {
  'use strict';

  // Hash routes share one document. Keep canonical, social cards and the
  // reviewed WebSite/WebPage graph at the preview root, including on profiles.
  const homeTitle = 'Achei Quem — prévia de profissionais no Vale do Paraíba';
  const defaultDescription = 'Conheça a prévia do Achei Quem, um projeto para encontrar profissionais de serviços no Vale do Paraíba paulista. Perfis e avaliações são fictícios.';
  const descriptions = {
    '/buscar': 'Explore a busca demonstrativa do Achei Quem por serviço, categoria e cidade atendida no Vale do Paraíba paulista. Os perfis apresentados são fictícios.',
    '/como-funciona': 'Entenda a proposta do Achei Quem: busca por serviço e cidade, contato direto e registro do serviço. Nesta prévia, os fluxos e dados são demonstrativos.',
    '/sobre-prototipo': 'Conheça a proposta do Achei Quem, a região inicial e os limites desta prévia com dados fictícios. Cadastros reais serão abertos no lançamento.',
    '/planos': 'Conheça a proposta de assinatura profissional do Achei Quem. O valor será definido antes do lançamento. Esta prévia não realiza cobranças.',
    '/entrar': 'Experimente contas de exemplo do Achei Quem. O site público é uma prévia com dados fictícios e não realiza autenticação de clientes ou profissionais.',
    '/cadastro': 'Experimente o cadastro demonstrativo do Achei Quem usando dados fictícios. Cadastros reais de clientes e profissionais serão abertos no lançamento.'
  };

  function update({ path = '/inicio', title = '' } = {}) {
    const home = path === '/' || path === '/inicio';
    document.title = home ? homeTitle : `${title || 'Demonstração'} | Achei Quem · prévia`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', descriptions[path] || defaultDescription);
  }

  window.AQSEO = Object.freeze({ update });
}());
