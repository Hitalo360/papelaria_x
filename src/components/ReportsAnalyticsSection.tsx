import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  History,
} from 'lucide-react';
import { Client, OrderStatus } from '../types';
import { DashboardAnalyticsData } from '../utils/dashboardMetrics';
import { ReportSummary } from '../utils/dateRange';
import { formatBRL, formatDateBR, formatDateTimeBR, STATUS_META } from '../utils/formatters';

interface ReportsAnalyticsSectionProps {
  analytics: DashboardAnalyticsData;
  reportData: ReportSummary;
  reportStart: string;
  reportEnd: string;
  onOpenOrder: (orderId: number) => void;
  onOpenClient: (clientId: number) => void;
  onOpenOrdersWithStatus: (status: OrderStatus) => void;
}

export const ReportsAnalyticsSection: React.FC<ReportsAnalyticsSectionProps> = ({
  analytics,
  reportData,
  reportStart,
  reportEnd,
  onOpenOrder,
  onOpenClient,
  onOpenOrdersWithStatus,
}) => {
  const [chartWindow, setChartWindow] = useState<'7d' | '30d'>('7d');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'count'>('revenue');
  const [hoveredDailyIso, setHoveredDailyIso] = useState<string | null>(null);
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<'historico' | 'clientes'>('historico');

  const activeSeries = chartWindow === '7d' ? analytics.series7d : analytics.series30d;

  const maxDailyValue = useMemo(
    () =>
      Math.max(
        1,
        ...activeSeries.map((pt) => (chartMetric === 'revenue' ? pt.revenue : pt.count))
      ),
    [activeSeries, chartMetric]
  );

  const maxMonthlyRevenue = useMemo(
    () => Math.max(1, ...analytics.monthlySeries.map((m) => m.revenue)),
    [analytics.monthlySeries]
  );

  const hoveredDailyPoint = useMemo(
    () => activeSeries.find((p) => p.iso === hoveredDailyIso) ?? null,
    [activeSeries, hoveredDailyIso]
  );

  const hoveredMonthPoint = useMemo(
    () => analytics.monthlySeries.find((m) => m.key === hoveredMonthKey) ?? null,
    [analytics.monthlySeries, hoveredMonthKey]
  );

  const periodRangeLabel =
    reportStart && reportEnd
      ? reportStart === reportEnd
        ? formatDateBR(reportStart)
        : `${formatDateBR(reportStart)} — ${formatDateBR(reportEnd)}`
      : 'Todo o período';

  const statusEntries = useMemo(() => {
    const keys = Object.keys(STATUS_META) as OrderStatus[];
    const total = reportData.totalPedidos;
    let cumulative = 0;
    return keys.map((key) => {
      const bucket = reportData.byStatus[key];
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
  }, [reportData]);

  const monthDeltaPct = useMemo(() => {
    if (analytics.prevMonthRevenue <= 0) {
      return analytics.monthRevenue > 0 ? 100 : null;
    }
    return Math.round(
      ((analytics.monthRevenue - analytics.prevMonthRevenue) / analytics.prevMonthRevenue) * 100
    );
  }, [analytics.monthRevenue, analytics.prevMonthRevenue]);

  const renderDeltaBadge = (deltaPct: number | null) => {
    if (deltaPct === null) {
      return <span className="text-xs text-slate-400">Sem base anterior</span>;
    }
    const positive = deltaPct >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
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
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Gráficos de Vendas (7d/30d) + Comparativo + Faturamento Mensal */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Vendas diárias ({chartWindow === '7d' ? 'últimos 7 dias' : 'últimos 30 dias'})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Comparativo de faturamento e volume real no mês atual vs. mês anterior
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

          <div className="mb-3 flex min-h-[30px] flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
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
                <span>Comparativo mensal</span>
                <div className="flex flex-wrap items-center gap-3 font-mono-num">
                  <span>
                    Este mês:{' '}
                    <strong className="text-slate-900">{formatBRL(analytics.monthRevenue)}</strong>
                  </span>
                  <span>
                    Mês anterior:{' '}
                    <strong className="text-slate-700">
                      {formatBRL(analytics.prevMonthRevenue)}
                    </strong>
                  </span>
                  {renderDeltaBadge(monthDeltaPct)}
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

        {/* Faturamento Mensal (6 meses) */}
        <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Faturamento mensal (6 meses)</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {hoveredMonthPoint
                ? `${hoveredMonthPoint.label}: ${hoveredMonthPoint.count} pedidos · ${formatBRL(
                    hoveredMonthPoint.revenue
                  )}`
                : 'Evolução de faturamento confirmado por mês'}
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

      {/* Distribuição visual de Pedidos por Status no período selecionado */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Pedidos por status</h2>
            <p className="text-xs text-slate-500">Período: {periodRangeLabel}</p>
          </div>
          <span className="font-mono-num text-xs font-semibold text-slate-600">
            {reportData.totalPedidos} pedidos no período
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-3 lg:items-center">
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 36 36" className="h-28 w-28 shrink-0 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="4.5" />
              {reportData.totalPedidos > 0 &&
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
              <div className="font-semibold text-slate-900">Distribuição do período</div>
              <p className="text-slate-500">
                Clique em qualquer status ao lado para abrir os pedidos filtrados.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
            {statusEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => onOpenOrdersWithStatus(entry.key)}
                className="flex flex-col justify-between rounded-md border border-slate-200 bg-slate-50/50 p-3.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-100/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${entry.meta.badgeClass}`}
                  >
                    {entry.meta.label}
                  </span>
                  <span className="font-mono-num text-xs font-medium text-slate-500">
                    {Math.round(entry.pct)}%
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-mono-num text-lg font-bold text-slate-900">
                    {entry.count}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      {entry.count === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </span>
                  <span className="font-mono-num text-xs font-semibold text-slate-700">
                    {formatBRL(entry.total)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Atividades e Alterações Detalhadas */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Histórico e cadastros recentes</h2>
          </div>

          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
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
          </div>
        </div>

        {activityTab === 'historico' ? (
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
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Nenhuma alteração de status registrada ainda.
                    </td>
                  </tr>
                ) : (
                  analytics.recentHistory.map((h) => {
                    const nextMeta = STATUS_META[h.statusNovo];
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="font-mono-num px-4 py-2.5 text-xs text-slate-600">
                          {formatDateTimeBR(h.criadoEm)}
                        </td>
                        <td className="font-mono-num px-4 py-2.5 font-semibold text-slate-900">
                          #{h.orderNumero}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{h.clientName}</td>
                        <td className="px-4 py-2.5">
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
                        <td className="px-4 py-2.5 text-xs text-slate-600">{h.usuarioNome}</td>
                        <td className="px-4 py-2.5 text-right">
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
        ) : (
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
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Nenhum cliente cadastrado ainda.
                    </td>
                  </tr>
                ) : (
                  analytics.recentClients.map((cli: Client) => (
                    <tr key={cli.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{cli.nome}</td>
                      <td className="font-mono-num px-4 py-2.5 text-xs text-slate-600">
                        {cli.telefone}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{cli.empresa || '—'}</td>
                      <td className="font-mono-num px-4 py-2.5 text-xs text-slate-500">
                        {cli.criadoEm ? formatDateTimeBR(cli.criadoEm) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
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
      </div>
    </div>
  );
};
