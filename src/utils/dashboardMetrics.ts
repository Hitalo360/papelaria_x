import { Client, Order, OrderStatus, Product } from '../types';
import {
  extractOrderLocalDate,
  parseISODateLocal,
  resolvePresetRange,
  toLocalISODate,
} from './dateRange';
import { roundCurrency } from './orderCalculations';

export type DashboardPeriodKey =
  | 'hoje'
  | 'ontem'
  | 'ultimos_7_dias'
  | 'ultimos_30_dias'
  | 'este_mes';

export const DASHBOARD_PERIOD_OPTIONS: Array<{ key: DashboardPeriodKey; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'ultimos_7_dias', label: 'Últimos 7 dias' },
  { key: 'ultimos_30_dias', label: 'Últimos 30 dias' },
  { key: 'este_mes', label: 'Este mês' },
];

export interface DailyChartPoint {
  iso: string;
  label: string;
  shortLabel: string;
  count: number;
  revenue: number;
}

export interface MonthlyChartPoint {
  key: string;
  label: string;
  count: number;
  revenue: number;
}

export interface RecentHistoryActivity {
  id: string;
  orderId: number;
  orderNumero: string;
  clientName: string;
  statusAnterior: OrderStatus | null;
  statusNovo: OrderStatus;
  observacao: string;
  usuarioNome: string;
  criadoEm: string;
}

export interface DashboardAnalyticsData {
  todayISO: string;
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;

  // KPIs principais
  todayRevenue: number;
  todayOrdersCount: number;
  yesterdayRevenue: number;
  monthRevenue: number;
  monthOrdersCount: number;
  prevMonthRevenue: number;

  periodOrdersCount: number;
  periodRevenue: number;
  prevPeriodOrdersCount: number;
  prevPeriodRevenue: number;
  revenueDeltaPct: number | null;
  ordersDeltaPct: number | null;

  pendingOrdersCount: number;
  awaitingConfirmationCount: number;
  inProductionCount: number;
  readyForPickupCount: number;
  completedTotalCount: number;
  completedThisMonthCount: number;
  completedInPeriodCount: number;
  canceledInPeriodCount: number;

  activeClientsCount: number;
  totalClientsCount: number;
  activeProductsCount: number;
  totalProductsCount: number;

  // Gráficos
  series7d: DailyChartPoint[];
  series30d: DailyChartPoint[];
  byStatus7d: Record<OrderStatus, { count: number; total: number }>;
  byStatus30d: Record<OrderStatus, { count: number; total: number }>;
  monthlySeries: MonthlyChartPoint[];
  byStatusInPeriod: Record<OrderStatus, { count: number; total: number }>;
  topProductsInPeriod: Array<{ nome: string; qtd: number; pedidos: number; valor: number }>;

  // Alertas reais
  overdueOrders: Order[];
  awaitingConfirmationOrders: Order[];
  readyForPickupOrders: Order[];

  // Atividades recentes
  recentOrders: Order[];
  recentClients: Client[];
  recentHistory: RecentHistoryActivity[];
}

const MONTH_ABBR = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function computeDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function buildDailySeries(orders: Order[], days: number, referenceDate: Date): DailyChartPoint[] {
  const map = new Map<string, DailyChartPoint>();
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const iso = toLocalISODate(dt);
    const dd = iso.slice(8, 10);
    const mm = iso.slice(5, 7);
    map.set(iso, {
      iso,
      label: `${dd}/${mm}`,
      shortLabel: days > 10 ? dd : `${dd}/${mm}`,
      count: 0,
      revenue: 0,
    });
  }

  orders.forEach((o) => {
    const d = extractOrderLocalDate(o.dataCadastro);
    const point = map.get(d);
    if (!point) return;
    point.count += 1;
    if (o.status !== 'cancelado') {
      point.revenue = roundCurrency(point.revenue + o.valorTotal);
    }
  });

  return Array.from(map.values());
}

export function computeDashboardAnalytics(
  orders: Order[],
  clients: Client[],
  products: Product[],
  clientById: Map<number, Client>,
  periodKey: DashboardPeriodKey,
  referenceDate: Date = new Date()
): DashboardAnalyticsData {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const todayISO = toLocalISODate(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = toLocalISODate(yesterday);

  const currentMonthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const prevMonthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const prevMonthEnd = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 0));

  const start7dDt = new Date(today);
  start7dDt.setDate(start7dDt.getDate() - 6);
  const start7dISO = toLocalISODate(start7dDt);

  const start30dDt = new Date(today);
  start30dDt.setDate(start30dDt.getDate() - 29);
  const start30dISO = toLocalISODate(start30dDt);

  const { startDate: periodStart, endDate: periodEnd } = resolvePresetRange(periodKey, today);

  // Calcula período anterior de igual duração para comparativo
  const startDt = parseISODateLocal(periodStart) ?? today;
  const endDt = parseISODateLocal(periodEnd) ?? today;
  const spanDays =
    Math.max(1, Math.round((endDt.getTime() - startDt.getTime()) / 86400000) + 1);

  const prevEndDt = new Date(startDt);
  prevEndDt.setDate(prevEndDt.getDate() - 1);
  const prevStartDt = new Date(prevEndDt);
  prevStartDt.setDate(prevStartDt.getDate() - (spanDays - 1));

  const previousPeriodStart = toLocalISODate(prevStartDt);
  const previousPeriodEnd = toLocalISODate(prevEndDt);

  let todayRevenueCents = 0;
  let todayOrdersCount = 0;
  let yesterdayRevenueCents = 0;
  let monthRevenueCents = 0;
  let monthOrdersCount = 0;
  let prevMonthRevenueCents = 0;

  let periodOrdersCount = 0;
  let periodRevenueCents = 0;
  let prevPeriodOrdersCount = 0;
  let prevPeriodRevenueCents = 0;

  let awaitingConfirmationCount = 0;
  let inProductionCount = 0;
  let readyForPickupCount = 0;
  let completedTotalCount = 0;
  let completedThisMonthCount = 0;
  let completedInPeriodCount = 0;
  let canceledInPeriodCount = 0;

  const createEmptyStatusMap = (): Record<OrderStatus, { count: number; total: number }> => ({
    aguardando_confirmacao: { count: 0, total: 0 },
    confirmado: { count: 0, total: 0 },
    em_producao: { count: 0, total: 0 },
    pronto_retirada: { count: 0, total: 0 },
    entregue: { count: 0, total: 0 },
    cancelado: { count: 0, total: 0 },
  });

  const byStatusInPeriod = createEmptyStatusMap();
  const byStatus7d = createEmptyStatusMap();
  const byStatus30d = createEmptyStatusMap();

  const prodAgg = new Map<string, { nome: string; qtd: number; pedidos: number; valor: number }>();

  // Últimos 6 meses reais
  const monthMap = new Map<string, MonthlyChartPoint>();
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_ABBR[dt.getMonth()]}/${String(dt.getFullYear()).slice(-2)}`;
    monthMap.set(key, { key, label, count: 0, revenue: 0 });
  }

  const overdueOrders: Order[] = [];
  const awaitingConfirmationOrders: Order[] = [];
  const readyForPickupOrders: Order[] = [];

  orders.forEach((o) => {
    const orderDate = extractOrderLocalDate(o.dataCadastro);
    const totalCents = Math.round(o.valorTotal * 100 + 1e-9);
    const isCanceled = o.status === 'cancelado';

    // Hoje / Ontem / Mês atual / Mês anterior
    if (orderDate === todayISO) {
      todayOrdersCount += 1;
      if (!isCanceled) todayRevenueCents += totalCents;
    }
    if (orderDate === yesterdayISO && !isCanceled) {
      yesterdayRevenueCents += totalCents;
    }
    if (orderDate >= currentMonthStart && orderDate <= todayISO) {
      monthOrdersCount += 1;
      if (!isCanceled) monthRevenueCents += totalCents;
      if (o.status === 'entregue') completedThisMonthCount += 1;
    }
    if (o.status === 'entregue') {
      completedTotalCount += 1;
    }
    if (orderDate >= prevMonthStart && orderDate <= prevMonthEnd && !isCanceled) {
      prevMonthRevenueCents += totalCents;
    }

    if (orderDate >= start7dISO && orderDate <= todayISO) {
      const b7 = byStatus7d[o.status];
      if (b7) {
        b7.count += 1;
        b7.total = roundCurrency(b7.total + o.valorTotal);
      }
    }
    if (orderDate >= start30dISO && orderDate <= todayISO) {
      const b30 = byStatus30d[o.status];
      if (b30) {
        b30.count += 1;
        b30.total = roundCurrency(b30.total + o.valorTotal);
      }
    }

    // Série mensal (últimos 6 meses)
    const monthKey = orderDate.slice(0, 7);
    const mPoint = monthMap.get(monthKey);
    if (mPoint) {
      mPoint.count += 1;
      if (!isCanceled) mPoint.revenue = roundCurrency(mPoint.revenue + o.valorTotal);
    }

    // Pendências globais atuais (independente de filtro de data)
    if (o.status === 'aguardando_confirmacao') {
      awaitingConfirmationCount += 1;
      awaitingConfirmationOrders.push(o);
    } else if (o.status === 'confirmado') {
      awaitingConfirmationCount += 1;
    } else if (o.status === 'em_producao') {
      inProductionCount += 1;
    } else if (o.status === 'pronto_retirada') {
      readyForPickupCount += 1;
      readyForPickupOrders.push(o);
    }

    if (
      o.dataPrevisao &&
      o.dataPrevisao < todayISO &&
      o.status !== 'entregue' &&
      o.status !== 'cancelado'
    ) {
      overdueOrders.push(o);
    }

    // Período selecionado
    if (orderDate >= periodStart && orderDate <= periodEnd) {
      periodOrdersCount += 1;
      if (!isCanceled) periodRevenueCents += totalCents;
      if (o.status === 'entregue') completedInPeriodCount += 1;
      if (o.status === 'cancelado') canceledInPeriodCount += 1;

      const stBucket = byStatusInPeriod[o.status];
      if (stBucket) {
        stBucket.count += 1;
        stBucket.total = roundCurrency(stBucket.total + o.valorTotal);
      }

      if (!isCanceled) {
        const seenProd = new Set<string>();
        o.itens.forEach((it) => {
          const cur = prodAgg.get(it.descricaoItem) ?? {
            nome: it.descricaoItem,
            qtd: 0,
            pedidos: 0,
            valor: 0,
          };
          cur.qtd = roundCurrency(cur.qtd + it.quantidade);
          cur.valor = roundCurrency(cur.valor + it.subtotal);
          if (!seenProd.has(it.descricaoItem)) {
            cur.pedidos += 1;
            seenProd.add(it.descricaoItem);
          }
          prodAgg.set(it.descricaoItem, cur);
        });
      }
    }

    // Período anterior equivalente
    if (orderDate >= previousPeriodStart && orderDate <= previousPeriodEnd) {
      prevPeriodOrdersCount += 1;
      if (!isCanceled) prevPeriodRevenueCents += totalCents;
    }
  });

  const periodRevenue = periodRevenueCents / 100;
  const prevPeriodRevenue = prevPeriodRevenueCents / 100;

  const recentOrders = [...orders]
    .sort((a, b) => b.dataCadastro.localeCompare(a.dataCadastro) || b.id - a.id)
    .slice(0, 8);

  const recentClients = [...clients]
    .sort((a, b) => {
      if (a.criadoEm && b.criadoEm) {
        return b.criadoEm.localeCompare(a.criadoEm);
      }
      return b.id - a.id;
    })
    .slice(0, 6);

  const historyList: RecentHistoryActivity[] = [];
  orders.forEach((o) => {
    const cliName = clientById.get(o.clienteId)?.nome || 'Cliente';
    o.historico.forEach((h) => {
      historyList.push({
        id: `${o.id}-${h.id}`,
        orderId: o.id,
        orderNumero: o.numero,
        clientName: cliName,
        statusAnterior: h.statusAnterior,
        statusNovo: h.statusNovo,
        observacao: h.observacao,
        usuarioNome: h.usuarioNome,
        criadoEm: h.criadoEm,
      });
    });
  });

  const recentHistory = historyList
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 8);

  overdueOrders.sort((a, b) => a.dataPrevisao.localeCompare(b.dataPrevisao));

  return {
    todayISO,
    periodStart,
    periodEnd,
    previousPeriodStart,
    previousPeriodEnd,

    todayRevenue: todayRevenueCents / 100,
    todayOrdersCount,
    yesterdayRevenue: yesterdayRevenueCents / 100,
    monthRevenue: monthRevenueCents / 100,
    monthOrdersCount,
    prevMonthRevenue: prevMonthRevenueCents / 100,

    periodOrdersCount,
    periodRevenue,
    prevPeriodOrdersCount,
    prevPeriodRevenue,
    revenueDeltaPct: computeDeltaPct(periodRevenue, prevPeriodRevenue),
    ordersDeltaPct: computeDeltaPct(periodOrdersCount, prevPeriodOrdersCount),

    pendingOrdersCount: awaitingConfirmationCount + inProductionCount + readyForPickupCount,
    awaitingConfirmationCount,
    inProductionCount,
    readyForPickupCount,
    completedTotalCount,
    completedThisMonthCount,
    completedInPeriodCount,
    canceledInPeriodCount,

    activeClientsCount: clients.filter((c) => c.ativo).length,
    totalClientsCount: clients.length,
    activeProductsCount: products.filter((p) => p.ativo).length,
    totalProductsCount: products.length,

    series7d: buildDailySeries(orders, 7, today),
    series30d: buildDailySeries(orders, 30, today),
    byStatus7d,
    byStatus30d,
    monthlySeries: Array.from(monthMap.values()),
    byStatusInPeriod,
    topProductsInPeriod: Array.from(prodAgg.values())
      .sort((a, b) => b.valor - a.valor || b.qtd - a.qtd)
      .slice(0, 6),

    overdueOrders,
    awaitingConfirmationOrders,
    readyForPickupOrders,

    recentOrders,
    recentClients,
    recentHistory,
  };
}
