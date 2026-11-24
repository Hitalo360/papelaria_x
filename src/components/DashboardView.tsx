import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  History,
  Package,
  PackagePlus,
  Plus,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { Client, Order, OrderStatus } from '../types';
import {
  DASHBOARD_PERIOD_OPTIONS,
  DashboardAnalyticsData,
  DashboardPeriodKey,
} from '../utils/dashboardMetrics';
import { formatBRL, formatDateBR, formatDateTimeBR, STATUS_META } from '../utils/formatters';

interface DashboardViewProps {
  analytics: DashboardAnalyticsData;
  periodKey: DashboardPeriodKey;
  onPeriodChange: (next: DashboardPeriodKey) => void;
  clientById: Map<number, Client>;
  onNewOrder: () => void;
  onOpenOrders: (statusFilter?: OrderStatus | '') => void;
  onOpenOrder: (orderId: number) => void;
  onOpenClients: () => void;
  onOpenClient: (clientId: number) => void;
  onOpenProducts: () => void;
  onOpenReports: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  analytics,
  periodKey,
  onPeriodChange,
  clientById,
  onNewOrder,
  onOpenOrders,
  onOpenOrder,
  onOpenClients,
  onOpenClient,
  onOpenProducts,
  onOpenReports,
}) => {
  const [chartWindow, setChartWindow] = useState<'7d' | '30d'>('7d');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'count'>('revenue');
  const [hoveredDailyIso, setHoveredDailyIso] = useState<string | null>(null);
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<'pedidos' | 'clientes' | 'historico'>('pedidos');

  const activeSeries = chartWindow === '7d' ? analytics.series7d : analytics.series30d;

  const maxDailyValue = useMemo(() => {
    const max = Math.max(
      1,
      ...activeSeries.map((pt) => (chartMetric === 'revenue' ? pt.revenue : pt.count))
    );
    return max;
  }, [activeSeries, chartMetric]);

  const maxMonthlyRevenue = useMemo(
    () => Math.max(1, ...analytics.monthlySeries.map((m) => m.revenue)),
    [analytics.monthlySeries]
  );

  const periodRangeLabel =
    analytics.periodStart === analytics.periodEnd
      ? formatDateBR(analytics.periodStart)
      : `${formatDateBR(analytics.periodStart)} — ${formatDateBR(analytics.periodEnd)}`;

  const previousRangeLabel =
    analytics.previousPeriodStart === analytics.previousPeriodEnd
      ? formatDateBR(analytics.previousPeriodStart)
      : `${formatDateBR(analytics.previousPeriodStart)} — ${formatDateBR(
          analytics.previousPeriodEnd
        )}`;

  // Gráfico donut de status (SVG)
  const statusEntries = useMemo(() => {
    const keys = Object.keys(STATUS_META) as OrderStatus[];
    const total = analytics.periodOrdersCount;
    let cumulative = 0;
    return keys.map((key) => {
      const bucket = analytics.byStatusInPeriod[key];
      const pct = total > 0 ? (bucket.count / total) * 100 : 0;
      const startPct = cumulative;
      cumulative += pct;
      return {
        key,
        meta: STATUS_META[key],
        count: bucket.count,
        total: bucket.total,
        pct,
        startPct,
      };
    });
  }, [analytics.byStatusInPeriod, analytics.periodOrdersCount]);

  const topProdMax = useMemo(
    () => Math.max(1, ...analytics.topProductsInPeriod.map((p) => p.valor)),
    [analytics.topProductsInPeriod]
  );

  const hoveredDailyPoint = useMemo(
    () => activeSeries.find((p) => p.iso === hoveredDailyIso) ?? null,
    [activeSeries, hoveredDailyIso]
  );

  const hoveredMonthPoint = useMemo(
    () => analytics.monthlySeries.find((m) => m.key === hoveredMonthKey) ?? null,
    [analytics.monthlySeries, hoveredMonthKey]
  );

  const totalAlerts =
    analytics.overdueOrders.length +
    analytics.awaitingConfirmationOrders.length +
    analytics.readyForPickupOrders.length;

  const renderDeltaBadge = (deltaPct: number | null, suffix: string) => {
    if (deltaPct === null) {
      return <span className="text-xs text-slate-400">Sem base anterior para comparar</span>;
    }
    const positive = deltaPct >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium ${
          positive ? 'text-emerald-700' : 'text-red-700'
        }`}
      >
        {positive ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5" />
        )}
        <span className="font-mono-num">
          {positive ? '+' : ''}
          {deltaPct}%
        </span>
        <span className="text-slate-500">{suffix}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Barra de Período e Atalhos Rápidos */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Período dos indicadores:</span>
              <span className="font-mono-num text-slate-900">{periodRangeLabel}</span>
            </div>

            <div className="inline-flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {DASHBOARD_PERIOD_OPTIONS.map((opt) => {
                const active = periodKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onPeriodChange(opt.key)}
                    className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onNewOrder}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo pedido</span>
            </button>
            <button
              type="button"
              onClick={onOpenProducts}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <PackagePlus className="h-3.5 w-3.5 text-slate-500" />
              <span>Cadastrar produto</span>
            </button>
            <button
              type="button"
              onClick={onOpenClients}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <UserPlus className="h-3.5 w-3.5 text-slate-500" />
              <span>Cadastrar cliente</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenOrders('')}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span>Consultar pedidos</span>
            </button>
            <button
              type="button"
              onClick={onOpenReports}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
              <span>Abrir relatórios</span>
            </button>
          </div>
        </div>
      </div>

      {/* Linha 1 de Indicadores Principais (Financeiro e Volume) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Faturamento do dia</span>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <div className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {formatBRL(analytics.todayRevenue)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono-num">
              {analytics.todayOrdersCount}{' '}
              {analytics.todayOrdersCount === 1 ? 'pedido hoje' : 'pedidos hoje'}
            </span>
            <span className="font-mono-num">Ontem: {formatBRL(analytics.yesterdayRevenue)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Faturamento do mês</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-mono-num mt-2 text-2xl font-bold text-slate-900">
            {formatBRL(analytics.monthRevenue)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono-num">{analytics.monthOrdersCount} pedidos no mês</span>
            <span className="font-mono-num">
              Mês ant.: {formatBRL(analytics.prevMonthRevenue)}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pedidos no período</span>
            <ShoppingBag className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-mono-num text-2xl font-bold text-slate-900">
              {analytics.periodOrdersCount}
            </span>
            <span className="font-mono-num text-sm font-semibold text-blue-700">
              {formatBRL(analytics.periodRevenue)}
            </span>
          </div>
          <div className="mt-2">
            {renderDeltaBadge(analytics.ordersDeltaPct, 'vs. período anterior')}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pedidos pendentes</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="font-mono-num mt-2 text-2xl font-bold text-amber-700">
            {analytics.pendingOrdersCount}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="font-mono-num">{analytics.awaitingConfirmationCount} fila</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{analytics.inProductionCount} produção</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{analytics.readyForPickupCount} prontos</span>
          </div>
        </div>
      </div>

      {/* Linha 2 de Indicadores (Conclusão e Cadastros) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onOpenOrders('entregue')}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/50"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">
              Pedidos concluídos no período
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono-num text-xl font-bold text-emerald-700">
                {analytics.completedInPeriodCount}
              </span>
              <span className="font-mono-num text-xs text-slate-500">
                {analytics.periodOrdersCount > 0
                  ? `${Math.round(
                      (analytics.completedInPeriodCount / analytics.periodOrdersCount) * 100
                    )}% de conclusão`
                  : 'Nenhum pedido no período'}
              </span>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </button>

        <button
          type="button"
          onClick={onOpenClients}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/50"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Clientes cadastrados</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono-num text-xl font-bold text-slate-900">
                {analytics.activeClientsCount}
              </span>
              <span className="font-mono-num text-xs text-slate-500">
                ativos ({analytics.totalClientsCount} no total)
              </span>
            </div>
          </div>
          <Users className="h-5 w-5 text-blue-600" />
        </button>

        <button
          type="button"
          onClick={onOpenProducts}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/50"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Produtos e serviços</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono-num text-xl font-bold text-slate-900">
                {analytics.activeProductsCount}
              </span>
              <span className="font-mono-num text-xs text-slate-500">
                ativos ({analytics.totalProductsCount} cadastrados)
              </span>
            </div>
          </div>
          <Package className="h-5 w-5 text-teal-600" />
        </button>
      </div>

      {/* Gráficos Principais: Vendas Diárias (7d/30d) + Faturamento Mensal */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Vendas 7 ou 30 dias + Comparativo entre períodos */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Desempenho de vendas ({chartWindow === '7d' ? 'últimos 7 dias' : 'últimos 30 dias'})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Passe o cursor sobre as barras para ver os valores diários reais
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartMetric('revenue')}
                  className={`rounded px-2.5 py-1 ${
                    chartMetric === 'revenue'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Faturamento
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('count')}
                  className={`rounded px-2.5 py-1 ${
                    chartMetric === 'count'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pedidos
                </button>
              </div>

              <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartWindow('7d')}
                  className={`rounded px-2.5 py-1 ${
                    chartWindow === '7d'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7 dias
                </button>
                <button
                  type="button"
                  onClick={() => setChartWindow('30d')}
                  className={`rounded px-2.5 py-1 ${
                    chartWindow === '30d'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 dias
                </button>
              </div>
            </div>
          </div>

          {/* Barra informativa interativa do ponto selecionado */}
          <div className="mb-3 flex min-h-[28px] items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            {hoveredDailyPoint ? (
              <>
                <span className="font-semibold text-slate-800">
                  Dia <span className="font-mono-num">{formatDateBR(hoveredDailyPoint.iso)}</span>
                </span>
                <div className="flex items-center gap-3 font-mono-num">
                  <span>
                    Pedidos: <strong className="text-slate-900">{hoveredDailyPoint.count}</strong>
                  </span>
                  <span>
                    Faturamento:{' '}
                    <strong className="text-blue-700">
                      {formatBRL(hoveredDailyPoint.revenue)}
                    </strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span>
                  Comparativo ({periodRangeLabel} vs. {previousRangeLabel})
                </span>
                <div className="flex items-center gap-3 font-mono-num">
                  <span>
                    Atual: <strong className="text-slate-900">{formatBRL(analytics.periodRevenue)}</strong>
                  </span>
                  <span>
                    Anterior:{' '}
                    <strong className="text-slate-700">{formatBRL(analytics.prevPeriodRevenue)}</strong>
                  </span>
                  {renderDeltaBadge(analytics.revenueDeltaPct, '')}
                </div>
              </>
            )}
          </div>

          <div className="flex h-48 items-end gap-1 border-b border-slate-200 pt-4 pb-1 sm:gap-1.5">
            {activeSeries.map((pt) => {
              const val = chartMetric === 'revenue' ? pt.revenue : pt.count;
              const pct = val > 0 ? Math.max(8, Math.round((val / maxDailyValue) * 100)) : 3;
              const isHovered = hoveredDailyIso === pt.iso;
              return (
                <button
                  key={pt.iso}
                  type="button"
                  onMouseEnter={() => setHoveredDailyIso(pt.iso)}
                  onMouseLeave={() => setHoveredDailyIso(null)}
                  onFocus={() => setHoveredDailyIso(pt.iso)}
                  onBlur={() => setHoveredDailyIso(null)}
                  aria-label={`${formatDateBR(pt.iso)}: ${pt.count} pedidos, ${formatBRL(
                    pt.revenue
                  )}`}
                  className="group flex h-full flex-1 flex-col items-center justify-end focus:outline-none"
                >
                  {chartWindow === '7d' && (
                    <span className="font-mono-num mb-1 text-[10px] font-semibold text-slate-600">
                      {chartMetric === 'revenue'
                        ? pt.revenue > 0
                          ? `R$${Math.round(pt.revenue)}`
                          : '0'
                        : pt.count}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-t transition-colors ${
                      val === 0
                        ? 'bg-slate-200'
                        : isHovered
                        ? 'bg-blue-700'
                        : chartMetric === 'revenue'
                        ? 'bg-blue-600 group-hover:bg-blue-700'
                        : 'bg-teal-600 group-hover:bg-teal-700'
                    }`}
                    style={{ height: `${pct}%` }}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-1 sm:gap-1.5">
            {activeSeries.map((pt, idx) => {
              const showLabel =
                chartWindow === '7d' || idx % 5 === 0 || idx === activeSeries.length - 1;
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

        {/* Faturamento por Mês (últimos 6 meses reais) */}
        <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Faturamento mensal (6 meses)</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {hoveredMonthPoint
                ? `${hoveredMonthPoint.label}: ${hoveredMonthPoint.count} pedidos · ${formatBRL(
                    hoveredMonthPoint.revenue
                  )}`
                : 'Evolução de vendas confirmadas por mês'}
            </p>
          </div>

          <div className="flex flex-1 items-end gap-2.5 border-b border-slate-200 pt-4 pb-1 min-h-[180px]">
            {analytics.monthlySeries.map((m) => {
              const pct =
                m.revenue > 0 ? Math.max(8, Math.round((m.revenue / maxMonthlyRevenue) * 100)) : 4;
              const isHovered = hoveredMonthKey === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onMouseEnter={() => setHoveredMonthKey(m.key)}
                  onMouseLeave={() => setHoveredMonthKey(null)}
                  onFocus={() => setHoveredMonthKey(m.key)}
                  onBlur={() => setHoveredMonthKey(null)}
                  className="group flex h-full flex-1 flex-col items-center justify-end focus:outline-none"
                >
                  <span className="font-mono-num mb-1 text-[10px] font-semibold text-slate-600">
                    {m.revenue > 0 ? Math.round(m.revenue) : 0}
                  </span>
                  <div
                    className={`w-full max-w-[36px] rounded-t transition-colors ${
                      m.revenue === 0
                        ? 'bg-slate-200'
                        : isHovered
                        ? 'bg-slate-900'
                        : 'bg-slate-700 group-hover:bg-slate-900'
                    }`}
                    style={{ height: `${pct}%` }}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-2.5">
            {analytics.monthlySeries.map((m) => (
              <div
                key={m.key}
                className="font-mono-num flex-1 text-center text-[11px] font-medium text-slate-500"
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribuição por Status + Produtos Mais Vendidos + Alertas Operacionais */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Distribuição por Status */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Pedidos por status (período)</h2>
            <span className="font-mono-num text-xs text-slate-500">
              {analytics.periodOrdersCount} total
            </span>
          </div>

          <div className="mb-5 flex items-center gap-5">
            <svg viewBox="0 0 36 36" className="h-24 w-24 shrink-0 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="4.5"
              />
              {analytics.periodOrdersCount > 0 &&
                statusEntries.map((entry) =>
                  entry.pct > 0 ? (
                    <circle
                      key={entry.key}
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={entry.meta.color}
                      strokeWidth="4.5"
                      strokeDasharray={`${entry.pct * 0.8796} 87.96`}
                      strokeDashoffset={-entry.startPct * 0.8796}
                    />
                  ) : null
                )}
            </svg>
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-slate-900">Visão do período</div>
              <div className="text-slate-500">
                Clique em qualquer status abaixo para consultar os pedidos filtrados.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {statusEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => onOpenOrders(entry.key)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: entry.meta.color }}
                  />
                  <span className="truncate font-medium text-slate-700">{entry.meta.label}</span>
                </div>
                <div className="font-mono-num flex items-center gap-3 shrink-0">
                  <span className="text-slate-500">{Math.round(entry.pct)}%</span>
                  <span className="font-semibold text-slate-900">{entry.count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Produtos Mais Vendidos */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Produtos mais vendidos</h2>
            <button
              type="button"
              onClick={onOpenReports}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Ver relatório
            </button>
          </div>

          {analytics.topProductsInPeriod.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-slate-500">
              <p>Nenhuma venda registrada no período selecionado.</p>
              <button
                type="button"
                onClick={onNewOrder}
                className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Registrar pedido
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {analytics.topProductsInPeriod.map((prod) => {
                const widthPct = Math.max(6, Math.round((prod.valor / topProdMax) * 100));
                return (
                  <div key={prod.nome}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-800">{prod.nome}</span>
                      <span className="font-mono-num shrink-0 font-semibold text-slate-900">
                        {formatBRL(prod.valor)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="font-mono-num mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{prod.qtd} un/medida</span>
                      <span>
                        {prod.pedidos} {prod.pedidos === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertas e Notificações Reais */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Atenção operacional</h2>
            <span className="font-mono-num text-xs text-slate-500">
              {totalAlerts} {totalAlerts === 1 ? 'aviso' : 'avisos'}
            </span>
          </div>

          {totalAlerts === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-8 text-center">
              <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-600" />
              <div className="text-xs font-semibold text-emerald-900">Tudo em dia</div>
              <p className="mt-1 text-xs text-emerald-700">
                Nenhum pedido atrasado ou aguardando confirmação no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.overdueOrders.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50/60 p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-red-800">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Pedidos com prazo vencido
                    </span>
                    <span className="font-mono-num">{analytics.overdueOrders.length}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {analytics.overdueOrders.slice(0, 3).map((ord) => (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => onOpenOrder(ord.id)}
                        className="flex w-full items-center justify-between rounded bg-white px-2.5 py-1.5 text-left text-xs text-slate-800 transition-colors hover:bg-red-100/50"
                      >
                        <span className="truncate font-medium">
                          <span className="font-mono-num font-bold">#{ord.numero}</span> ·{' '}
                          {clientById.get(ord.clienteId)?.nome || 'Cliente'}
                        </span>
                        <span className="font-mono-num shrink-0 text-[11px] font-semibold text-red-700">
                          Prev: {formatDateBR(ord.dataPrevisao)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {analytics.awaitingConfirmationOrders.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span>Aguardando confirmação</span>
                    <span className="font-mono-num">
                      {analytics.awaitingConfirmationOrders.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800">
                    Existem pedidos aguardando confirmação para entrar na fila de produção.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenOrders('aguardando_confirmacao')}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
                  >
                    <span>Ver pedidos aguardando</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}

              {analytics.readyForPickupOrders.length > 0 && (
                <div className="rounded-md border border-teal-200 bg-teal-50/70 p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-teal-900">
                    <span>Prontos para retirada</span>
                    <span className="font-mono-num">{analytics.readyForPickupOrders.length}</span>
                  </div>
                  <p className="mt-1 text-xs text-teal-800">
                    Pedidos finalizados aguardando entrega ou retirada pelo cliente.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenOrders('pronto_retirada')}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-900 hover:underline"
                  >
                    <span>Conferir retiradas</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Atividades Recentes */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Atividades recentes</h2>
          </div>

          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActivityTab('pedidos')}
              className={`rounded px-3 py-1 whitespace-nowrap ${
                activityTab === 'pedidos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Últimos pedidos
            </button>
            <button
              type="button"
              onClick={() => setActivityTab('clientes')}
              className={`rounded px-3 py-1 whitespace-nowrap ${
                activityTab === 'clientes'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clientes recentes
            </button>
            <button
              type="button"
              onClick={() => setActivityTab('historico')}
              className={`rounded px-3 py-1 whitespace-nowrap ${
                activityTab === 'historico'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Alterações nos pedidos
            </button>
          </div>
        </div>

        {activityTab === 'pedidos' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Data e horário</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Nenhum pedido cadastrado ainda.{' '}
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
                  analytics.recentOrders.map((o: Order) => {
                    const cli = clientById.get(o.clienteId);
                    const meta = STATUS_META[o.status];
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="font-mono-num px-4 py-3 font-semibold text-slate-900">
                          #{o.numero}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-xs text-slate-600">
                          {formatDateTimeBR(o.dataCadastro)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {cli?.nome || '-'}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right font-semibold text-slate-900">
                          {formatBRL(o.valorTotal)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenOrder(o.id)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
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
        )}

        {activityTab === 'clientes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3 text-right">Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.recentClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Nenhum cliente cadastrado ainda.
                    </td>
                  </tr>
                ) : (
                  analytics.recentClients.map((cli) => (
                    <tr key={cli.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900">{cli.nome}</td>
                      <td className="font-mono-num px-4 py-3 text-xs text-slate-600">
                        {cli.telefone}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{cli.empresa || '—'}</td>
                      <td className="font-mono-num px-4 py-3 text-xs text-slate-500">
                        {cli.criadoEm ? formatDateTimeBR(cli.criadoEm) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenClient(cli.id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span>Ficha</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activityTab === 'historico' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Data e horário</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Movimentação</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.recentHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Nenhuma alteração de status registrada ainda.
                    </td>
                  </tr>
                ) : (
                  analytics.recentHistory.map((h) => {
                    const nextMeta = STATUS_META[h.statusNovo];
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="font-mono-num px-4 py-3 text-xs text-slate-600">
                          {formatDateTimeBR(h.criadoEm)}
                        </td>
                        <td className="font-mono-num px-4 py-3 font-semibold text-slate-900">
                          #{h.orderNumero}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{h.clientName}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {h.statusAnterior && (
                              <>
                                <span className="text-slate-500">
                                  {STATUS_META[h.statusAnterior]?.label || h.statusAnterior}
                                </span>
                                <span className="text-slate-400">→</span>
                              </>
                            )}
                            <span
                              className={`inline-flex rounded px-2 py-0.5 font-semibold ${nextMeta.badgeClass}`}
                            >
                              {nextMeta.label}
                            </span>
                          </div>
                          {h.observacao && (
                            <div className="mt-0.5 text-xs text-slate-500">{h.observacao}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{h.usuarioNome}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenOrder(h.orderId)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
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
        )}
      </div>
    </div>
  );
};
