(function () {
  'use strict';

  const icon = (name, size) => window.AQIcons ? window.AQIcons(name, size || 24) : '';
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const fallbackCategories = [
    { id: 'eletrica', name: 'Elétrica', icon: 'electric', description: 'Instalações e reparos' },
    { id: 'arquitetura', name: 'Arquitetura', icon: 'ruler', description: 'Ideias que viram espaços' },
    { id: 'engenharia', name: 'Engenharia', icon: 'engineering', description: 'Do projeto à obra' },
    { id: 'alvenaria', name: 'Alvenaria', icon: 'brick', description: 'Construção e reforma' },
    { id: 'pintura', name: 'Pintura', icon: 'paint', description: 'Um novo olhar para a casa' },
    { id: 'acabamento', name: 'Acabamento', icon: 'floor', description: 'Cuidado em cada detalhe' },
    { id: 'hidraulica', name: 'Hidráulica', icon: 'water', description: 'Instalações e manutenção' },
    { id: 'marcenaria', name: 'Marcenaria', icon: 'wood', description: 'Soluções sob medida' }
  ];
  const fallbackProfessionals = [
    { id: 'rafael', name: 'Rafael Almeida', title: 'Eletricista', city: 'São José dos Campos', photoIndex: 0, skills: ['Instalações', 'Manutenção'], rating: '4,8', reviews: 3 },
    { id: 'mariana', name: 'Mariana Costa', title: 'Arquiteta', city: 'Taubaté', photoIndex: 1, skills: ['Interiores', 'Projetos'], rating: '5,0', reviews: 8 },
    { id: 'carlos', name: 'Carlos Oliveira', title: 'Pedreiro', city: 'Guaratinguetá', photoIndex: 2, skills: ['Reformas', 'Alvenaria'], rating: '4,3', reviews: 3 }
  ];
  const categories = () => window.AQData && window.AQData.categories || fallbackCategories;
  const professionals = () => (window.AQData && window.AQData.professionals || fallbackProfessionals).slice(0, 3);
  const portrait = (index, extraClass, label) => '<span class="portrait portrait-' + index + ' ' + (extraClass || '') + '" role="img" aria-label="' + escape(label || 'Retrato ilustrativo de profissional') + '"></span>';

  function searchForm(variant) {
    const cityValues = window.AQData && window.AQData.cities || ['São José dos Campos', 'Taubaté', 'Jacareí', 'Pindamonhangaba', 'Guaratinguetá', 'Caçapava'];
    return '<form class="home-search home-search--' + variant + '" data-search-form aria-label="Buscar profissionais">' +
      '<label class="search-field search-field--term"><span class="search-field-icon">' + icon('search', 21) + '</span><span class="search-field-content"><span class="search-field-label">O que você precisa?</span><input name="term" type="search" placeholder="Eletricista, arquiteto, pedreiro..." autocomplete="off"></span></label>' +
      '<label class="search-field search-field--city"><span class="search-field-icon">' + icon('pin', 21) + '</span><span class="search-field-content"><span class="search-field-label">Em qual cidade?</span><select name="city" aria-label="Cidade"><option value="">Todo o Vale do Paraíba</option>' + cityValues.map(city => '<option value="' + escape(typeof city === 'string' ? city : city.name) + '">' + escape(typeof city === 'string' ? city : city.name) + '</option>').join('') + '</select></span></label>' +
      '<button class="btn btn-primary search-submit" type="submit">' + icon('search', 21) + '<span>Buscar profissionais</span></button></form>';
  }

  function categoryLinks(variant) {
    return '<div class="category-grid category-grid--' + variant + '">' + categories().map((category, index) => '<a class="category-link category-link--' + index + '" href="#/buscar?category=' + encodeURIComponent(category.id) + '"><span class="category-icon">' + icon(category.icon, variant === 'vivo' ? 34 : 28) + '</span><span class="category-copy"><strong>' + escape(category.name) + '</strong>' + (variant === 'editorial' || variant === 'vivo' ? '<span>' + escape(category.description || 'Encontre um profissional') + '</span>' : '') + '</span>' + (variant === 'editorial' || variant === 'vivo' ? '<span class="category-arrow">' + icon('arrow', 20) + '</span>' : '') + '</a>').join('') + '</div>';
  }

  function fallbackCard(professional) {
    return '<article class="pro-card"><a class="pro-photo" href="#/profissional/' + escape(professional.id) + '" aria-label="Ver perfil de ' + escape(professional.name) + '">' + portrait(professional.photoIndex) + '</a><div class="pro-card-body"><div class="pro-card-top"><span class="pro-title">' + escape(professional.title) + '</span><span class="pro-rating">' + icon('star', 16) + ' ' + escape(professional.rating) + '</span></div><h3><a href="#/profissional/' + escape(professional.id) + '">' + escape(professional.name) + '</a></h3><p class="pro-meta">' + icon('pin', 16) + escape(professional.city) + '</p><div class="pro-tags">' + (professional.skills || []).slice(0, 2).map(skill => '<span>' + escape(skill) + '</span>').join('') + '</div><a class="pro-card-link" href="#/profissional/' + escape(professional.id) + '">Conhecer profissional' + icon('arrow', 19) + '</a></div></article>';
  }

  function professionalsSection(variant, title, description) {
    return '<section class="home-professionals section-space home-professionals--' + variant + '"><div class="container"><div class="section-heading"><div><h2>' + title + '</h2><p>' + description + '</p></div><a class="text-link" href="#/buscar">Ver todos os profissionais ' + icon('arrow', 20) + '</a></div><div class="professionals-grid">' + professionals().map(professional => window.AQCard ? window.AQCard(professional) : fallbackCard(professional)).join('') + '</div></div></section>';
  }

  function howItWorks(variant) {
    return '<section class="home-how section-space home-how--' + variant + '"><div class="container"><div class="how-heading"><h2>Do “preciso de alguém”<br>ao “achei quem faz”.</h2><p>Você escolhe o profissional.<br>A conversa acontece direto com ele.</p><a class="text-link" href="#/como-funciona">Entenda como funciona ' + icon('arrow', 20) + '</a></div><ol class="how-steps"><li><span class="step-icon">' + icon('search', 28) + '</span><div><h3>Encontre o seu profissional</h3><p>Busque pela especialidade e pela cidade onde você precisa do serviço.</p></div></li><li><span class="step-icon">' + icon('message', 28) + '</span><div><h3>Converse e combine</h3><p>Crie sua conta grátis para entrar em contato. Preço e detalhes são combinados no WhatsApp.</p></div></li><li><span class="step-icon">' + icon('star', 28) + '</span><div><h3>Registre e compartilhe</h3><p>Registre o serviço e conte como foi. Sua avaliação pode incluir fotos do resultado.</p></div></li></ol></div></section>';
  }

  function professionalInvite(variant) {
    return '<section class="professional-invite professional-invite--' + variant + '"><div class="container invite-inner"><div class="invite-portraits" aria-hidden="true">' + portrait(3) + portrait(4) + portrait(5) + '</div><div class="invite-copy"><h2>Seu talento merece<br>ser encontrado.</h2><p>Mostre seu trabalho e apresente seus serviços<br class="desktop-break"> para quem procura um profissional no Vale.</p><span class="invite-note">Perfil profissional com assinatura.</span></div><a class="btn ' + (variant === 'editorial' ? 'btn-primary' : 'btn-coral') + '" href="#/cadastro?role=professional">Quero ser encontrado ' + icon('arrow', 21) + '</a></div></section>';
  }

  function praca() {
    return '<div class="home-page home-page--praca"><section class="hero hero--praca"><div class="container hero-praca-grid"><div class="hero-copy"><h1>Tem um projeto?<br>Ache <span>quem faz.</span></h1><p class="hero-description">Da pequena reforma à grande ideia,<br class="desktop-break"> encontre profissionais aqui no Vale do Paraíba.</p>' + searchForm('praca') + '<p class="search-note">' + icon('check', 17) + ' Para quem contrata, é grátis.</p></div><div class="hero-people" aria-label="Exemplos ilustrativos de profissionais da plataforma"><div class="people-backdrop"></div>' + portrait(0, 'hero-person hero-person--rafael', 'Retrato ilustrativo de um eletricista') + portrait(1, 'hero-person hero-person--mariana', 'Retrato ilustrativo de uma arquiteta') + '<div class="person-caption caption-rafael"><span class="caption-icon">' + icon('electric', 22) + '</span><span><strong>Rafael Almeida</strong><small>Eletricista · São José dos Campos</small></span></div><div class="person-caption caption-mariana"><span class="caption-icon">' + icon('ruler', 22) + '</span><span><strong>Mariana Costa</strong><small>Arquiteta · Taubaté</small></span></div><div class="people-statement">Gente do Vale.<br><strong>Talento de perto.</strong><span>' + icon('heart', 27) + '</span></div></div></div></section><section class="home-categories section-space"><div class="container"><div class="section-heading"><div><h2>Qual é o seu próximo projeto?</h2><p>Da ideia ao último acabamento.</p></div></div>' + categoryLinks('praca') + '</div></section>' + professionalsSection('praca', 'Gente boa no que faz.', 'Conheça alguns perfis e encontre quem combina com seu projeto.') + howItWorks('praca') + professionalInvite('praca') + '</div>';
  }

  function vivo() {
    return '<div class="home-page home-page--vivo"><section class="hero hero--vivo"><div class="container"><div class="vivo-title-row"><div class="vivo-symbol vivo-symbol--left" aria-hidden="true">' + icon('paint', 62) + '</div><div class="vivo-title-copy"><h1>Bora tirar isso<br><span>da lista?</span></h1><p>Tem alguém no Vale do Paraíba<br class="mobile-break"> que sabe fazer o que você precisa.</p></div><div class="vivo-symbol vivo-symbol--right" aria-hidden="true">' + icon('electric', 66) + '</div></div>' + searchForm('vivo') + '<p class="search-note">' + icon('check', 17) + ' Encontrar e conversar é grátis para quem contrata.</p><div class="vivo-category-heading"><h2>Comece pelo que você precisa</h2><span>Escolha uma especialidade ' + icon('arrow', 20) + '</span></div>' + categoryLinks('vivo') + '</div></section><div class="vivo-message-strip"><div class="container"><span>Um reparo que ficou para depois.</span>' + icon('plus', 22) + '<strong>Uma ideia que merece sair do papel.</strong></div></div>' + professionalsSection('vivo', 'Quem resolve está aqui.', 'Explore perfis, habilidades e avaliações antes de conversar.') + howItWorks('vivo') + professionalInvite('vivo') + '</div>';
  }

  function editorial() {
    return '<div class="home-page home-page--editorial"><section class="hero hero--editorial"><div class="container editorial-hero-grid"><div class="editorial-hero-copy"><h1>Quem faz bem,<br>está <em>por perto.</em></h1><p>Encontre quem cuida do seu projeto com o talento de quem é daqui. Profissionais de todo o Vale do Paraíba, em um só lugar.</p>' + searchForm('editorial') + '<p class="search-note">Sua próxima boa escolha começa com uma conversa.</p></div><div class="editorial-portrait-scene">' + portrait(1, 'editorial-main-portrait', 'Retrato ilustrativo de uma arquiteta') + '<div class="editorial-photo-caption"><span>Projeto, cuidado e personalidade.</span><strong>Mariana Costa</strong><span>Arquiteta · Taubaté</span><a href="#/profissional/mariana" aria-label="Conhecer Mariana Costa">' + icon('arrow', 24) + '</a></div><div class="editorial-side-note"><span>Da nossa região.<br>Para o seu projeto.</span>' + icon('pin', 24) + '</div></div></div></section>' + professionalsSection('editorial', 'Conheça quem pode fazer parte.', 'Projetos têm mais a ver com pessoas do que parece.') + '<section class="home-categories home-categories--editorial section-space"><div class="container editorial-category-layout"><div class="editorial-section-intro"><h2>Para cada ideia,<br>um saber diferente.</h2><p>Construir, transformar, reparar.<br>Encontre a especialidade que seu espaço precisa.</p><a class="text-link" href="#/buscar">Explorar profissionais ' + icon('arrow', 20) + '</a></div>' + categoryLinks('editorial') + '</div></section>' + howItWorks('editorial') + professionalInvite('editorial') + '</div>';
  }

  window.AQHome = { render: theme => ({ praca: praca, vivo: vivo, editorial: editorial }[theme] || praca)() };
}());
