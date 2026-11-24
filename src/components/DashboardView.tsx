import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  PackagePlus,
  PlusCircle,
  Users,
} from 'lucide-react';
import { Client, Order, OrderStatus } from '../types';
import { DashboardAnalyticsData } from '../utils/dashboardMetrics';
import { formatBRL, formatDateBR, STATUS_META } from '../utils/formatters';
import { roundCurrency } from '../utils/orderCalculations';

interface DashboardViewProps {
  analytics: DashboardAnalyticsData;
  clientById: Map<number, Client>;
  onNewOrder: () => void;
  onOpenProducts: () => void;
  onOpenClients: () => void;
  onOpenOrders: () => void;
  onOpenOrder: (orderId: number) => void;
}

const DONUT_RADIUS = 13.5;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export const DashboardView: React.FC<DashboardViewProps> = ({
  analytics,
  clientById,
  onNewOrder,
  onOpenProducts,
  onOpenClients,
  onOpenOrders,
  onOpenOrder,
}) => {
  const [periodWindow, setPeriodWindow] = useState<'7d' | '30d'>('7d');
  const [hoveredDayIso, setHoveredDayIso] = useState<string | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<OrderStatus | null>(null);

  const recentFiveOrders = analytics.recentOrders.slice(0, 5);

  const activeSeries = periodWindow === '7d' ? analytics.series7d : analytics.series30d;
  const activeStatusMap = periodWindow === '7d' ? analytics.byStatus7d : analytics.byStatus30d;

  const periodRevenueTotal = useMemo(
    () =>
      activeSeries.reduce((acc, pt) => roundCurrency(acc + pt.revenue), 0),
    [activeSeries]
  );

  const maxDailyRevenue = useMemo(
    () => Math.max(1, ...activeSeries.map((pt) => pt.revenue)),
    [activeSeries]
  );

  const hoveredDayPoint = useMemo(
    () => activeSeries.find((pt) => pt.iso === hoveredDayIso) ?? null,
    [activeSeries, hoveredDayIso]
  );

  const statusData = useMemo(() => {
    const keys = Object.keys(STATUS_META) as OrderStatus[];
    const totalCount = keys.reduce((sum, key) => sum + (activeStatusMap[key]?.count ?? 0), 0);
    let cumulativePct = 0;

    const entries = keys.map((key) => {
      const bucket = activeStatusMap[key] ?? { count: 0, total: 0 };
      const pct = totalCount > 0 ? (bucket.count / totalCount) * 100 : 0;
      const startPct = cumulativePct;
      cumulativePct += pct;
      return {
        key,
        meta: STATUS_META[key],
        count: bucket.count,
        total: bucket.total,
        pct,
        startPct,
      };
    });

    return { totalCount, entries };
  }, [activeStatusMap]);

  const hoveredStatusEntry = useMemo(
    () => statusData.entries.find((e) => e.key === hoveredStatus) ?? null,
    [statusData.entries, hoveredStatus]
  );

  const kpiCards = [
    {
      label: 'Faturamento de hoje',
      value: formatBRL(analytics.todayRevenue),
      description:
        analytics.todayOrdersCount === 0
          ? 'Nenhum pedido registrado hoje'
          : analytics.todayOrdersCount === 1
          ? '1 pedido registrado hoje'
          : `${analytics.todayOrdersCount} pedidos registrados hoje`,
      icon: <DollarSign className="h-4 w-4 text-blue-600" />,
      valueClass: 'text-slate-900',
    },
    {
      label: 'Pedidos pendentes',
      value: String(analytics.pendingOrdersCount),
      description: `${analytics.awaitingConfirmationCount} na fila · ${analytics.inProductionCount} em produção`,
      icon: <Clock className="h-4 w-4 text-amber-600" />,
      valueClass: 'text-amber-700',
    },
    {
      label: 'Pedidos concluídos',
      value: String(analytics.completedTotalCount),
      description: `${analytics.completedThisMonthCount} entregues neste mês`,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      valueClass: 'text-emerald-700',
    },
    {
      label: 'Total de clientes cadastrados',
      value: String(analytics.totalClientsCount),
      description: `${analytics.activeClientsCount} ativos na base`,
      icon: <Users className="h-4 w-4 text-slate-500" />,
      valueClass: 'text-slate-900',
    },
  ];

  const quickActions = [
    {
      title: 'Novo pedido',
      subtitle: 'Registrar venda ou serviço',
      icon: <PlusCircle className="h-4 w-4 text-blue-600" />,
      onClick: onNewOrder,
      primary: true,
    },
    {
      title: 'Cadastrar produto',
      subtitle: 'Atualizar catálogo e preços',
      icon: <PackagePlus className="h-4 w-4 text-slate-600" />,
      onClick: onOpenProducts,
      primary: false,
    },
    {
      title: 'Clientes',
      subtitle: 'Consultar ou adicionar cadastro',
      icon: <Users className="h-4 w-4 text-slate-600" />,
      onClick: onOpenClients,
      primary: false,
    },
    {
      title: 'Consultar pedidos',
      subtitle: 'Acompanhar status e entregas',
      icon: <FileText className="h-4 w-4 text-slate-600" />,
      onClick: onOpenOrders,
      primary: false,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* 1. Indicadores Principais (4 cards) */}
      <section aria-label="Indicadores principais">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                  {card.icon}
                </span>
              </div>
              <div className={`font-mono-num mt-3 text-2xl font-bold tracking-tight ${card.valueClass}`}>
                {card.value}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Acesso Rápido (4 atalhos) */}
      <section aria-label="Acesso rápido" className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-slate-900">Acesso rápido</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={action.onClick}
              className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                action.primary
                  ? 'border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50/80'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    action.primary
                      ? 'border-blue-200 bg-white'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {action.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {action.title}
                  </div>
                  <div className="truncate text-xs text-slate-500">{action.subtitle}</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
            </button>
          ))}
        </div>
      </section>

      {/* 3. Visão Gráfica (2 gráficos equilibrados) */}
      <section aria-label="Gráficos do período">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Gráfico 1: Faturamento Diário (7d / 30d) */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Faturamento diário
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {periodWindow === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'} ·{' '}
                  <span className="font-mono-num font-semibold text-slate-700">
                    {formatBRL(periodRevenueTotal)}
                  </span>
                </p>
              </div>

              <div
                role="group"
                aria-label="Período dos gráficos"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold"
              >
                <button
                  type="button"
                  onClick={() => {
                    setPeriodWindow('7d');
                    setHoveredDayIso(null);
                  }}
                  className={`rounded-md px-3 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    periodWindow === '7d'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7 dias
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodWindow('30d');
                    setHoveredDayIso(null);
                  }}
                  className={`rounded-md px-3 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    periodWindow === '30d'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 dias
                </button>
              </div>
            </div>

            {/* Faixa de leitura ao passar o cursor */}
            <div className="mt-3 flex min-h-[28px] items-center justify-between gap-2 border-y border-slate-100 py-1.5 text-xs">
              {hoveredDayPoint ? (
                <>
                  <span className="font-medium text-slate-700">
                    Dia <span className="font-mono-num font-semibold">{formatDateBR(hoveredDayPoint.iso)}</span>
                  </span>
                  <div className="font-mono-num flex items-center gap-3">
                    <span className="text-slate-600">
                      {hoveredDayPoint.count}{' '}
                      {hoveredDayPoint.count === 1 ? 'pedido' : 'pedidos'}
                    </span>
                    <span className="font-semibold text-blue-700">
                      {formatBRL(hoveredDayPoint.revenue)}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-slate-400">
                  Passe o cursor sobre as barras para ver o faturamento do dia
                </span>
              )}
            </div>

            {/* Barras do gráfico */}
            <div className="relative mt-4 flex h-44 items-end gap-1 border-b border-slate-200 pt-6 pb-1 sm:gap-1.5">
              {activeSeries.map((pt, idx) => {
                const pct =
                  pt.revenue > 0
                    ? Math.max(8, Math.round((pt.revenue / maxDailyRevenue) * 100))
                    : 3;
                const isHovered = hoveredDayIso === pt.iso;
                const tooltipAlignClass =
                  idx <= 1
                    ? 'left-0'
                    : idx >= activeSeries.length - 2
                    ? 'right-0'
                    : 'left-1/2 -translate-x-1/2';

                return (
                  <button
                    key={pt.iso}
                    type="button"
                    onMouseEnter={() => setHoveredDayIso(pt.iso)}
                    onMouseLeave={() => setHoveredDayIso(null)}
                    onFocus={() => setHoveredDayIso(pt.iso)}
                    onBlur={() => setHoveredDayIso(null)}
                    aria-label={`${formatDateBR(pt.iso)}: ${formatBRL(pt.revenue)}, ${pt.count} pedidos`}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end focus:outline-none"
                  >
                    {isHovered && (
                      <div
                        className={`pointer-events-none absolute -top-2 z-10 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm ${tooltipAlignClass}`}
                      >
                        <span className="font-mono-num font-semibold">{formatDateBR(pt.iso)}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="font-mono-num">{formatBRL(pt.revenue)}</span>
                      </div>
                    )}

                    {periodWindow === '7d' && (
                      <span className="font-mono-num mb-1 hidden text-[10px] font-medium text-slate-500 sm:inline">
                        {pt.revenue > 0 ? `R$${Math.round(pt.revenue)}` : '0'}
                      </span>
                    )}

                    <div
                      className={`w-full rounded-t transition-colors duration-150 ${
                        pt.revenue === 0
                          ? isHovered
                            ? 'bg-slate-300'
                            : 'bg-slate-200'
                          : isHovered
                          ? 'bg-blue-700'
                          : 'bg-blue-600 group-hover:bg-blue-700'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Eixo X */}
            <div className="mt-2 flex gap-1 sm:gap-1.5">
              {activeSeries.map((pt, idx) => {
                const showLabel =
                  periodWindow === '7d' ||
                  idx === 0 ||
                  idx % 5 === 0 ||
                  idx === activeSeries.length - 1;
                return (
                  <div
                    key={pt.iso}
                    className="font-mono-num flex-1 text-center text-[10px] text-slate-500"
                  >
                    {showLabel ? pt.shortLabel : ''}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráfico 2: Pedidos por Status (Donut) */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Pedidos por status
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {periodWindow === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'} ·{' '}
                  <span className="font-mono-num font-semibold text-slate-700">
                    {statusData.totalCount}{' '}
                    {statusData.totalCount === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              {/* Donut SVG */}
              <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
                <svg
                  viewBox="0 0 36 36"
                  className="h-full w-full -rotate-90"
                  role="img"
                  aria-label="Distribuição de pedidos por status"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="4.2"
                  />
                  {statusData.totalCount > 0 &&
                    statusData.entries.map((entry) => {
                      if (entry.count === 0) return null;
                      const dashLength = (entry.pct / 100) * DONUT_CIRCUMFERENCE;
                      const dashOffset = -(entry.startPct / 100) * DONUT_CIRCUMFERENCE;
                      const isDimmed = hoveredStatus !== null && hoveredStatus !== entry.key;

                      return (
                        <circle
                          key={entry.key}
                          cx="18"
                          cy="18"
                          r={DONUT_RADIUS}
                          fill="none"
                          stroke={entry.meta.color}
                          strokeWidth={hoveredStatus === entry.key ? '4.8' : '4.2'}
                          strokeDasharray={`${dashLength} ${DONUT_CIRCUMFERENCE}`}
                          strokeDashoffset={dashOffset}
                          onMouseEnter={() => setHoveredStatus(entry.key)}
                          onMouseLeave={() => setHoveredStatus(null)}
                          className={`cursor-pointer transition-opacity duration-150 ${
                            isDimmed ? 'opacity-30' : 'opacity-100'
                          }`}
                        />
                      );
                    })}
                </svg>

                {/* Centro da rosca */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                  {hoveredStatusEntry ? (
                    <>
                      <span className="font-mono-num text-xl font-bold leading-none text-slate-900">
                        {hoveredStatusEntry.count}
                      </span>
                      <span className="font-mono-num mt-1 text-[11px] font-semibold text-slate-600">
                        {Math.round(hoveredStatusEntry.pct)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono-num text-xl font-bold leading-none text-slate-900">
                        {statusData.totalCount}
                      </span>
                      <span className="mt-1 text-[11px] text-slate-500">
                        {statusData.totalCount === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legenda com quantidades */}
              <div className="w-full min-w-0 flex-1 space-y-1.5">
                {statusData.entries.map((entry) => {
                  const isActive = hoveredStatus === entry.key;
                  return (
                    <div
                      key={entry.key}
                      onMouseEnter={() => setHoveredStatus(entry.key)}
                      onMouseLeave={() => setHoveredStatus(null)}
                      className={`flex cursor-default items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                        isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: entry.meta.color }}
                        />
                        <span className="truncate text-slate-700">{entry.meta.label}</span>
                      </div>
                      <div className="font-mono-num flex shrink-0 items-center gap-2">
                        <span className="font-semibold text-slate-900">{entry.count}</span>
                        <span className="w-8 text-right text-[11px] text-slate-400">
                          {Math.round(entry.pct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rodapé de detalhe ao passar o cursor */}
            <div className="mt-4 flex min-h-[24px] items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
              {hoveredStatusEntry ? (
                <>
                  <span className="truncate font-medium text-slate-700">
                    {hoveredStatusEntry.meta.label}
                  </span>
                  <span className="font-mono-num shrink-0 font-semibold text-slate-900">
                    {hoveredStatusEntry.count}{' '}
                    {hoveredStatusEntry.count === 1 ? 'pedido' : 'pedidos'} ·{' '}
                    {formatBRL(hoveredStatusEntry.total)}
                  </span>
                </>
              ) : (
                <span className="text-slate-400">
                  {statusData.totalCount === 0
                    ? 'Nenhum pedido registrado neste período'
                    : 'Passe o cursor sobre um status para ver os valores'}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Pedidos Recentes (últimos 5 pedidos) */}
      <section aria-label="Pedidos recentes" className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">Pedidos recentes</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Últimos 5 pedidos registrados no sistema
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenOrders}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap"
          >
            <span>Visualizar todos</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">Pedido</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentFiveOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    Nenhum pedido registrado ainda.{' '}
                    <button
                      type="button"
                      onClick={onNewOrder}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Criar primeiro pedido
                    </button>
                  </td>
                </tr>
              ) : (
                recentFiveOrders.map((order: Order) => {
                  const client = clientById.get(order.clienteId);
                  const statusMeta = STATUS_META[order.status];
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="font-mono-num px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        #{order.numero}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">
                        {client?.nome || 'Cliente não identificado'}
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateBR(order.dataCadastro)}
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatBRL(order.valorTotal)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenOrder(order.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                          <span>Abrir</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
