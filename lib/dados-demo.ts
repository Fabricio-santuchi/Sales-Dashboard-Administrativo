import prisma from "@/lib/prisma";

// Dados de demonstração do dashboard.
// As métricas são calculadas a partir de "hoje" (últimos 30/90 dias, mês atual...),
// então dados fixos envelhecem e o painel zera. Aqui os dados são gerados
// sempre relativos à data atual, e a API regenera quando ficam velhos.

function aleatorio(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function gerarDadosDemo() {
  const agora = new Date();
  const inicioDeHoje = new Date(agora);
  inicioDeHoje.setHours(0, 0, 0, 0);

  const pedidos: { total: number; createdAt: Date }[] = [];

  // Pedidos dos últimos 12 meses (o mês atual só até hoje, nunca no futuro)
  for (let i = 11; i >= 0; i--) {
    const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const ano = inicioDoMes.getFullYear();
    const mes = inicioDoMes.getMonth();
    const ehMesAtual = i === 0;
    const ultimoDia = ehMesAtual ? agora.getDate() : new Date(ano, mes + 1, 0).getDate();
    const quantidade = ehMesAtual
      ? Math.max(5, Math.round((aleatorio(20, 45) * ultimoDia) / 30))
      : aleatorio(20, 45);

    for (let j = 0; j < quantidade; j++) {
      let data = new Date(ano, mes, aleatorio(1, ultimoDia), aleatorio(8, 20), aleatorio(0, 59));
      if (data > agora) data = new Date(agora.getTime() - aleatorio(1, 120) * 60_000);
      pedidos.push({ total: aleatorio(300, 1800), createdAt: data });
    }
  }

  // Alguns pedidos de hoje, pro card "Pedidos hoje" não ficar zerado
  const msDesdeMeiaNoite = agora.getTime() - inicioDeHoje.getTime();
  for (let k = 0; k < aleatorio(3, 8); k++) {
    pedidos.push({
      total: aleatorio(300, 1800),
      createdAt: new Date(inicioDeHoje.getTime() + Math.random() * msDesdeMeiaNoite),
    });
  }

  // Clientes dos últimos 180 dias
  const clientes = Array.from({ length: 90 }, () => ({
    createdAt: new Date(agora.getTime() - aleatorio(0, 180) * 24 * 60 * 60 * 1000),
  }));

  await prisma.$transaction([
    prisma.order.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.order.createMany({ data: pedidos }),
    prisma.customer.createMany({ data: clientes }),
  ]);
}

// Regenera os dados se ainda não existe nenhum pedido de hoje.
// Na prática roda uma vez por dia, na primeira visita.
export async function garantirDadosRecentes() {
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);

  const ultimoPedido = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!ultimoPedido || ultimoPedido.createdAt < inicioDeHoje) {
    await gerarDadosDemo();
  }
}
