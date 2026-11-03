// Fictional fixtures. They are never copied to a connected Supabase project.
export function createDemoData(today = new Date()) {
  const day = (offset = 0) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const timestamp = offset => `${day(offset)}T12:00:00.000Z`;
  const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const categories = [
    ['Elétrica', 'Instalações e reparos elétricos'],
    ['Arquitetura', 'Projetos de arquitetura'],
    ['Engenharia', 'Projetos e acompanhamento de obras'],
    ['Obras e alvenaria', 'Pedreiros e mestres de obras'],
    ['Pintura', 'Pintura e preparação de paredes'],
    ['Pisos e acabamentos', 'Instalação de pisos e revestimentos'],
    ['Hidráulica', 'Instalações e reparos hidráulicos'],
    ['Marcenaria', 'Móveis e soluções sob medida']
  ].map(([name, description], index) => ({id:id(index + 1), name, description, active:true}));
  const professionals = [
    {id:id(101), name:'Rafael Almeida', city:'São José dos Campos', cities:['São José dos Campos','Jacareí','Caçapava'], categories:[id(1),id(6)], skills:['Instalação elétrica','Assentamento de pisos'], description:'Perfil fictício para demonstrar a análise de um profissional de elétrica e acabamentos.', photoIndex:0, status:'approved', subscriptionStatus:'active', createdAt:timestamp(-25)},
    {id:id(102), name:'Mariana Costa', city:'Taubaté', cities:['Taubaté','Tremembé'], categories:[id(2),id(3)], skills:['Projetos arquitetônicos','Acompanhamento de obras'], description:'Perfil fictício para demonstrar o cadastro com mais de uma categoria profissional.', photoIndex:1, status:'pending', subscriptionStatus:'inactive', createdAt:timestamp(-1)},
    {id:id(103), name:'Carlos Oliveira', city:'Guaratinguetá', cities:['Guaratinguetá','Lorena','Aparecida'], categories:[id(4)], skills:['Alvenaria','Instalação de drywall'], description:'Perfil fictício de mestre de obras que solicitou uma categoria ainda não cadastrada.', photoIndex:2, status:'pending', subscriptionStatus:'inactive', createdAt:timestamp(-2)},
    {id:id(104), name:'Juliana Santos', city:'Jacareí', cities:['Jacareí','São José dos Campos'], categories:[id(5)], skills:['Pintura residencial'], description:'Perfil fictício para visualizar assinaturas e cobranças em atraso de forma separada.', photoIndex:3, status:'approved', subscriptionStatus:'active', createdAt:timestamp(-35)},
    {id:id(105), name:'André Ferreira', city:'Pindamonhangaba', cities:['Pindamonhangaba'], categories:[id(7)], skills:['Manutenção hidráulica'], description:'Perfil fictício recusado apenas para exercitar os filtros e estados administrativos.', photoIndex:4, status:'rejected', subscriptionStatus:'inactive', createdAt:timestamp(-8)}
  ].map((professional, index) => ({...professional, email:`profissional${index + 1}@exemplo.test`, phone:'', photoUrl:'../assets/professionals.png', notes:'Dados fictícios de demonstração.'}));
  const clients = [
    {id:id(201), name:'Ana Pereira', email:'ana@exemplo.test', city:'São José dos Campos', status:'active', createdAt:timestamp(-20)},
    {id:id(202), name:'Bruno Lima', email:'bruno@exemplo.test', city:'Taubaté', status:'active', createdAt:timestamp(-14)},
    {id:id(203), name:'Clara Souza', email:'clara@exemplo.test', city:'Jacareí', status:'active', createdAt:timestamp(-5)},
    {id:id(204), name:'Diego Rocha', email:'diego@exemplo.test', city:'Guaratinguetá', status:'inactive', createdAt:timestamp(-18)}
  ];
  const transactions = [
    {id:id(301), direction:'income', kind:'subscription', description:'Mensalidade ilustrativa · Rafael', professionalId:id(101), amountCents:5900, dueOn:day(-7), paidOn:day(-8), status:'paid', paymentMethod:'pix'},
    {id:id(302), direction:'income', kind:'subscription', description:'Mensalidade ilustrativa · Juliana', professionalId:id(104), amountCents:5900, dueOn:day(-4), paidOn:null, status:'pending', paymentMethod:'pix'},
    {id:id(303), direction:'income', kind:'subscription', description:'Próxima mensalidade ilustrativa · Rafael', professionalId:id(101), amountCents:5900, dueOn:day(20), paidOn:null, status:'pending', paymentMethod:'pix'},
    {id:id(304), direction:'expense', kind:'expense', description:'Despesa fictícia de operação', professionalId:null, amountCents:2500, dueOn:day(-3), paidOn:day(-3), status:'paid', paymentMethod:'transfer'},
    {id:id(305), direction:'expense', kind:'expense', description:'Despesa futura ilustrativa', professionalId:null, amountCents:1800, dueOn:day(5), paidOn:null, status:'pending', paymentMethod:'other'}
  ].map(transaction => ({...transaction, notes:'Valor fictício, não define o preço do Achei Quem.', createdAt:timestamp(-10)}));
  return {
    professionals, clients, categories, transactions,
    categoryRequests:[{id:id(401), professionalId:id(103), name:'Drywall', status:'pending', categoryId:null, createdAt:timestamp(-2)}],
    audit:[{id:id(501), entity:'professionals', entityId:id(101), action:'insert', createdAt:timestamp(-25)}, {id:id(502), entity:'transactions', entityId:id(301), action:'insert', createdAt:timestamp(-8)}]
  };
}
