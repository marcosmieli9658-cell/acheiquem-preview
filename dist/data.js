(function () {
  'use strict';
  const categories = [
    { id: 'eletrica', name: 'Elétrica', icon: 'electric', description: 'Instalações e reparos elétricos' },
    { id: 'arquitetura', name: 'Arquitetura', icon: 'ruler', description: 'Projetos para transformar espaços' },
    { id: 'engenharia', name: 'Engenharia', icon: 'engineering', description: 'Projetos e acompanhamento de obras' },
    { id: 'alvenaria', name: 'Obras e alvenaria', icon: 'brick', description: 'Pedreiros e mestres de obras' },
    { id: 'pintura', name: 'Pintura', icon: 'paint', description: 'Pintura interna e externa' },
    { id: 'acabamento', name: 'Pisos e acabamentos', icon: 'floor', description: 'Instalação de pisos e revestimentos' },
    { id: 'hidraulica', name: 'Hidráulica', icon: 'water', description: 'Instalações, vazamentos e reparos' },
    { id: 'marcenaria', name: 'Marcenaria', icon: 'wood', description: 'Móveis e soluções sob medida' }
  ];
  // Recorte operacional de demonstração: municípios interiores da RM Vale,
  // incluindo cidades serranas; as quatro cidades litorâneas não foram incluídas.
  // A delimitação comercial definitiva deve ser confirmada antes do lançamento.
  const cities = ['Aparecida','Arapeí','Areias','Bananal','Caçapava','Cachoeira Paulista','Campos do Jordão','Canas','Cruzeiro','Cunha','Guaratinguetá','Igaratá','Jacareí','Jambeiro','Lagoinha','Lavrinhas','Lorena','Monteiro Lobato','Natividade da Serra','Paraibuna','Pindamonhangaba','Piquete','Potim','Queluz','Redenção da Serra','Roseira','Santa Branca','Santo Antônio do Pinhal','São Bento do Sapucaí','São José do Barreiro','São José dos Campos','São Luiz do Paraitinga','Silveiras','Taubaté','Tremembé'];
  const professionals = [
    { id:'rafael', name:'Rafael Almeida', title:'Eletricista e especialista em acabamentos', categories:['eletrica','acabamento'], skills:['Instalações elétricas','Troca de tomadas','Quadros de distribuição','Instalação de pisos'], city:'São José dos Campos', cities:['São José dos Campos','Jacareí','Caçapava'], photoIndex:0, description:'Cuido das instalações elétricas e dos acabamentos da sua casa, do pequeno reparo à reforma. Gosto de explicar cada etapa e combinar o serviço com clareza antes de começar.', projects:['Elétrica de cozinha','Instalação de porcelanato'] },
    { id:'mariana', name:'Mariana Costa', title:'Arquiteta e engenheira civil', categories:['arquitetura','engenharia'], skills:['Projeto arquitetônico','Reforma residencial','Acompanhamento de obra','Planejamento de espaços'], city:'Taubaté', cities:['Taubaté','Tremembé','Pindamonhangaba','Caçapava','São José dos Campos'], photoIndex:1, description:'Projetos pensados para o seu jeito de viver. Trabalho com arquitetura e engenharia para acompanhar as decisões da reforma, do primeiro desenho aos detalhes da execução.', projects:['Projeto de apartamento','Planejamento de reforma'] },
    { id:'carlos', name:'Carlos Oliveira', title:'Mestre de obras e pedreiro', categories:['alvenaria','acabamento'], skills:['Gestão de obra','Alvenaria','Assentamento de pisos','Reboco e acabamento'], city:'Guaratinguetá', cities:['Guaratinguetá','Aparecida','Lorena','Potim','Roseira'], photoIndex:2, description:'Faço obras e reformas com atenção à organização e ao acabamento. Atuo como mestre de obras e também executo serviços de alvenaria e assentamento de pisos.', projects:['Reforma de área externa','Acabamento de banheiro'] },
    { id:'juliana', name:'Juliana Santos', title:'Pintora residencial', categories:['pintura','acabamento'], skills:['Pintura interna','Pintura externa','Preparação de paredes','Texturas decorativas'], city:'Jacareí', cities:['Jacareí','São José dos Campos','Santa Branca','Igaratá'], photoIndex:3, description:'Uma pintura bem feita começa no preparo. Cuido da proteção dos ambientes, da preparação das paredes e do acabamento para renovar o seu espaço.', projects:['Pintura de sala','Renovação de fachada'] },
    { id:'andre', name:'André Ferreira', title:'Encanador e instalador hidráulico', categories:['hidraulica'], skills:['Reparo de vazamentos','Instalação de torneiras','Tubulações','Manutenção hidráulica'], city:'Pindamonhangaba', cities:['Pindamonhangaba','Taubaté','Tremembé','Roseira','Campos do Jordão'], photoIndex:4, description:'Atendo reparos e instalações hidráulicas residenciais. Avalio a necessidade, explico as opções e combino os detalhes antes de realizar o serviço.', projects:['Revisão hidráulica','Instalação de banheiro'] },
    { id:'beatriz', name:'Beatriz Ribeiro', title:'Engenheira civil', categories:['engenharia'], skills:['Planejamento de obras','Orçamento de reforma','Acompanhamento técnico','Projetos residenciais'], city:'Lorena', cities:['Lorena','Cruzeiro','Cachoeira Paulista','Guaratinguetá','Canas'], photoIndex:5, description:'Ajudo você a organizar a sua obra com planejamento, acompanhamento e comunicação clara em cada etapa do projeto.', projects:['Planejamento residencial','Acompanhamento de obra'] }
  ];
  const reviews = [
    { id:'r1', proId:'rafael', author:'Ana P. · exemplo', score:5, service:'Revisão elétrica', date:'2026-10-15', text:'Explicou o que precisava ser feito e deixou tudo organizado. O serviço ficou como tínhamos combinado.', photos:[] },
    { id:'r2', proId:'rafael', author:'Felipe M. · exemplo', score:5, service:'Troca de tomadas', date:'2026-10-10', text:'Consegui combinar o atendimento e tirar as dúvidas antes da visita. Boa experiência.', photos:[] },
    { id:'r3', proId:'rafael', author:'Luiza S. · exemplo', score:4, service:'Instalação de piso', date:'2026-10-01', text:'O acabamento ficou bom. O horário precisou ser ajustado, mas fomos avisados.', photos:[] },
    { id:'r4', proId:'carlos', author:'Bruno L. · exemplo', score:2, service:'Acabamento de parede', date:'2026-10-12', text:'O acabamento de uma parede ficou diferente do combinado. Entrei em contato e estou aguardando o ajuste.', response:'Obrigado pelo relato. Combinei uma nova visita para avaliar o acabamento e alinhar a correção.', photos:[] },
    { id:'r5', proId:'carlos', author:'Marta R. · exemplo', score:5, service:'Assentamento de piso', date:'2026-10-05', text:'O piso foi instalado com cuidado. A comunicação durante o serviço ajudou bastante.', photos:[] },
    { id:'r6', proId:'carlos', author:'Diego S. · exemplo', score:5, service:'Alvenaria', date:'2026-09-22', text:'O serviço foi concluído conforme combinado e o espaço ficou organizado.', photos:[] },
    { id:'r7', proId:'mariana', author:'Renata A. · exemplo', score:5, service:'Projeto de reforma', date:'2026-10-18', text:'O projeto considerou a rotina da família e trouxe soluções para os espaços menores.', photos:[] },
    { id:'r8', proId:'mariana', author:'Paulo F. · exemplo', score:5, service:'Planejamento de obra', date:'2026-09-30', text:'Recebi explicações claras sobre as etapas e consegui organizar melhor a reforma.', photos:[] }
  ];
  window.AQData = { categories, cities, professionals, reviews };
})();
