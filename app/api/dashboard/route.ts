import prisma from "@/lib/prisma";
import { garantirDadosRecentes } from "@/lib/dados-demo";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    // Dados de demo sempre atuais: regenera se não houver pedido de hoje
    await garantirDadosRecentes();

    const now = new Date();

    /* ============================
       DATAS BASE
    ============================ */

    // hoje
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // últimos 30 dias 
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    // 🔴 CORRETO: últimos 3 meses 
    const startOf90Days = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    /* ============================
       MÉTRICAS (CARDS)
    ============================ */
    const [totalSales90Days, ordersToday, orders30Days, newCustomers30Days] =
      await Promise.all([
        // TOTAL DE VENDAS – últimos 3 meses
        prisma.order.aggregate({
          where: {
            createdAt: {
              gte: startOf90Days,
              lte: now,
            },
          },
          _sum: { total: true },
        }),

        // pedidos de hoje
        prisma.order.count({
          where: {
            createdAt: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
        }),

        // pedidos últimos 30 dias
        prisma.order.count({
          where: {
            createdAt: {
              gte: last30Days,
              lte: now,
            },
          },
        }),

        // novos clientes últimos 30 dias
        prisma.customer.count({
          where: {
            createdAt: {
              gte: last30Days,
              lte: now,
            },
          },
        }),
      ]);

    /* ============================
       COMPARATIVO MÊS ATUAL x ANTERIOR
    ============================ */
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const endOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    const [currentMonthSales, previousMonthSales] = await Promise.all([
      // mês atual até hoje
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: startOfCurrentMonth,
            lte: now,
          },
        },
        _sum: { total: true },
      }),

      // mês anterior fechado
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: startOfPreviousMonth,
            lte: endOfPreviousMonth,
          },
        },
        _sum: { total: true },
      }),
    ]);

    const currentTotal = currentMonthSales._sum.total ?? 0;
    const previousTotal = previousMonthSales._sum.total ?? 0;

    const growth =
      previousTotal === 0
        ? 100
        : ((currentTotal - previousTotal) / previousTotal) * 100;

    /* ============================
       GRÁFICO – ÚLTIMOS 12 MESES 
    ============================ */
    const monthsLabel = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    // começa 11 meses atrás
    const startRolling = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const ordersRolling = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startRolling,
          lte: now,
        },
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    const totalsMap = new Map<string, number>();

    for (const order of ordersRolling) {
      const y = order.createdAt.getFullYear();
      const m = order.createdAt.getMonth();
      const key = `${y}-${m}`;
      totalsMap.set(key, (totalsMap.get(key) ?? 0) + order.total);
    }

    const monthlySales = Array.from({ length: 12 }).map((_, i) => {
      const date = new Date(
        startRolling.getFullYear(),
        startRolling.getMonth() + i,
        1
      );

      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const key = `${year}-${monthIndex}`;

      const total = totalsMap.get(key) ?? 0;
      const desktop = Math.round(total * 0.64);
      const mobile = total - desktop;

      return {
        month: `${monthsLabel[monthIndex]}/${year}`,
        total,
        desktop,
        mobile,
      };
    });

    /* ============================
       RESPONSE FINAL
    ============================ */
    return Response.json({
      metrics: {
        totalSales90Days: totalSales90Days._sum.total ?? 0,
        ordersToday,
        orders30Days,
        newCustomers30Days,
        currentMonthSales: currentTotal,
        previousMonthSales: previousTotal,
        monthGrowth: Math.round(growth),
      },
      charts: {
        monthlySales,
      },
      lastUpdated: now.toISOString(),
    });
  } catch (error) {
    console.error("[DASHBOARD_API_ERROR]", error);
    return Response.json(
      { error: "Erro ao buscar dados do dashboard" },
      { status: 500 }
    );
  }
}
