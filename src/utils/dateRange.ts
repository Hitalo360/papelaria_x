import { Client, Order, OrderStatus } from '../types';
import { roundCurrency } from './orderCalculations';

export type DatePresetKey =
  | 'hoje'
  | 'ontem'
  | 'ultimos_7_dias'
  | 'ultimos_15_dias'
  | 'ultimos_30_dias'
  | 'este_mes'
  | 'mes_anterior'
  | 'personalizado';

export interface DateRangeValue {
  startDate: string;
  endDate: string;
  preset: DatePresetKey;
}

export const DATE_PRESETS: Array<{ key: DatePresetKey; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'ultimos_7_dias', label: 'Últimos 7 dias' },
  { key: 'ultimos_15_dias', label: 'Últimos 15 dias' },
  { key: 'ultimos_30_dias', label: 'Últimos 30 dias' },
  { key: 'este_mes', label: 'Este mês' },
  { key: 'mes_anterior', label: 'Mês anterior' },
  { key: 'personalizado', label: 'Personalizado' },
];

export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODateLocal(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function resolvePresetRange(
  preset: Exclude<DatePresetKey, 'personalizado'>,
  referenceDate: Date = new Date()
): { startDate: string; endDate: string } {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  switch (preset) {
    case 'hoje': {
      const iso = toLocalISODate(today);
      return { startDate: iso, endDate: iso };
    }
    case 'ontem': {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const iso = toLocalISODate(yest);
      return { startDate: iso, endDate: iso };
    }
    case 'ultimos_7_dias': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: toLocalISODate(start), endDate: toLocalISODate(today) };
    }
    case 'ultimos_15_dias': {
      const start = new Date(today);
      start.setDate(start.getDate() - 14);
      return { startDate: toLocalISODate(start), endDate: toLocalISODate(today) };
    }
    case 'ultimos_30_dias': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { startDate: toLocalISODate(start), endDate: toLocalISODate(today) };
    }
    case 'este_mes': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: toLocalISODate(start), endDate: toLocalISODate(today) };
    }
    case 'mes_anterior': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: toLocalISODate(start), endDate: toLocalISODate(end) };
    }
  }
}

export function extractOrderLocalDate(dataCadastro: string): string {
  if (!dataCadastro) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataCadastro)) {
    return dataCadastro;
  }
  const parsed = new Date(dataCadastro);
  if (Number.isNaN(parsed.getTime())) {
    return dataCadastro.slice(0, 10);
  }
  return toLocalISODate(parsed);
}

export interface ReportSummary {
  orders: Order[];
  totalPedidos: number;
  faturamento: number;
  entregues: number;
  cancelados: number;
  byStatus: Record<OrderStatus, { count: number; total: number }>;
  topProdutos: Array<{ nome: string; qtd: number; pedidos: number; valor: number }>;
  topClientes: Array<{ id: number; nome: string; tel: string; pedidos: number; total: number }>;
}

export function computeReportData(
  orders: Order[],
  clientById: Map<number, Client>,
  startDate: string,
  endDate: string
): ReportSummary {
  const inPeriod = orders.filter((o) => {
    const d = extractOrderLocalDate(o.dataCadastro);
    return (!startDate || d >= startDate) && (!endDate || d <= endDate);
  });

  const byStatus: Record<OrderStatus, { count: number; total: number }> = {
    aguardando_confirmacao: { count: 0, total: 0 },
    confirmado: { count: 0, total: 0 },
    em_producao: { count: 0, total: 0 },
    pronto_retirada: { count: 0, total: 0 },
    entregue: { count: 0, total: 0 },
    cancelado: { count: 0, total: 0 },
  };

  let faturamentoCents = 0;

  inPeriod.forEach((o) => {
    const st = byStatus[o.status];
    if (st) {
      st.count += 1;
      st.total = roundCurrency(st.total + o.valorTotal);
    }
    if (o.status !== 'cancelado') {
      faturamentoCents += Math.round(o.valorTotal * 100 + 1e-9);
    }
  });

  const prodAgg = new Map<string, { nome: string; qtd: number; pedidos: number; valor: number }>();
  const cliAgg = new Map<number, { id: number; nome: string; tel: string; pedidos: number; total: number }>();

  inPeriod
    .filter((o) => o.status !== 'cancelado')
    .forEach((o) => {
      const cli = clientById.get(o.clienteId);
      if (cli) {
        const cur = cliAgg.get(cli.id) ?? {
          id: cli.id,
          nome: cli.nome,
          tel: cli.telefone,
          pedidos: 0,
          total: 0,
        };
        cur.pedidos += 1;
        cur.total = roundCurrency(cur.total + o.valorTotal);
        cliAgg.set(cli.id, cur);
      }

      const seenProdInOrder = new Set<string>();
      o.itens.forEach((it) => {
        const cur = prodAgg.get(it.descricaoItem) ?? {
          nome: it.descricaoItem,
          qtd: 0,
          pedidos: 0,
          valor: 0,
        };
        cur.qtd = roundCurrency(cur.qtd + it.quantidade);
        cur.valor = roundCurrency(cur.valor + it.subtotal);
        if (!seenProdInOrder.has(it.descricaoItem)) {
          cur.pedidos += 1;
          seenProdInOrder.add(it.descricaoItem);
        }
        prodAgg.set(it.descricaoItem, cur);
      });
    });

  return {
    orders: inPeriod,
    totalPedidos: inPeriod.length,
    faturamento: faturamentoCents / 100,
    entregues: byStatus.entregue.count,
    cancelados: byStatus.cancelado.count,
    byStatus,
    topProdutos: Array.from(prodAgg.values()).sort((a, b) => b.qtd - a.qtd),
    topClientes: Array.from(cliAgg.values()).sort((a, b) => b.total - a.total),
  };
}
