import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  DATE_PRESETS,
  DatePresetKey,
  parseISODateLocal,
  resolvePresetRange,
  toLocalISODate,
} from '../utils/dateRange';
import { formatDateBR } from '../utils/formatters';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  preset: DatePresetKey;
  onChange: (next: { startDate: string; endDate: string; preset: DatePresetKey }) => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface MonthCell {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
}

function buildMonthGrid(year: number, month: number): MonthCell[] {
  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: MonthCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const dt = new Date(year, month, -i);
    cells.push({
      iso: toLocalISODate(dt),
      day: dt.getDate(),
      inCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    cells.push({
      iso: toLocalISODate(dt),
      day: d,
      inCurrentMonth: true,
    });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const dt = new Date(year, month + 1, i);
    cells.push({
      iso: toLocalISODate(dt),
      day: dt.getDate(),
      inCurrentMonth: false,
    });
  }

  return cells;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  preset,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const initialAnchor = useMemo(() => {
    const parsed = parseISODateLocal(startDate) ?? new Date();
    return { year: parsed.getFullYear(), month: parsed.getMonth() };
  }, [startDate]);

  const [viewYear, setViewYear] = useState(initialAnchor.year);
  const [viewMonth, setViewMonth] = useState(initialAnchor.month);

  useEffect(() => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const todayISO = useMemo(() => toLocalISODate(new Date()), []);

  const secondMonth = useMemo(() => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [viewYear, viewMonth]);

  const leftGrid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const rightGrid = useMemo(
    () => buildMonthGrid(secondMonth.year, secondMonth.month),
    [secondMonth.year, secondMonth.month]
  );

  const openCalendar = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    const anchor = parseISODateLocal(startDate) ?? new Date();
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
    setOpen(true);
  };

  const handlePresetClick = (key: DatePresetKey) => {
    if (key === 'personalizado') {
      onChange({ startDate, endDate, preset: 'personalizado' });
      openCalendar();
      return;
    }
    const range = resolvePresetRange(key);
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    setOpen(false);
    onChange({
      startDate: range.startDate,
      endDate: range.endDate,
      preset: key,
    });
  };

  const handleDayClick = (iso: string) => {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(iso);
      setDraftEnd('');
      setHoverDate(null);
      return;
    }
    if (iso < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(iso);
    } else {
      setDraftEnd(iso);
    }
    setHoverDate(null);
  };

  const handleClearPeriod = () => {
    setDraftStart('');
    setDraftEnd('');
    setHoverDate(null);
    onChange({
      startDate: '',
      endDate: '',
      preset: 'personalizado',
    });
  };

  const handleApply = () => {
    const finalStart = draftStart;
    const finalEnd = draftEnd || draftStart;
    onChange({
      startDate: finalStart,
      endDate: finalEnd,
      preset: 'personalizado',
    });
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const effectivePreviewEnd = draftEnd || (draftStart && hoverDate ? hoverDate : '');
  const rangeMin =
    draftStart && effectivePreviewEnd
      ? draftStart <= effectivePreviewEnd
        ? draftStart
        : effectivePreviewEnd
      : draftStart;
  const rangeMax =
    draftStart && effectivePreviewEnd
      ? draftStart <= effectivePreviewEnd
        ? effectivePreviewEnd
        : draftStart
      : '';

  const renderMonth = (year: number, month: number, cells: MonthCell[], isSecond = false) => (
    <div className="w-full min-w-[252px]">
      <div className="mb-3 flex items-center justify-between px-1">
        {!isSecond ? (
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Mês anterior"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-7" />
        )}

        <span className="text-sm font-bold text-slate-900">
          {MONTH_NAMES[month]} {year}
        </span>

        {isSecond ? (
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Próximo mês"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Próximo mês"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:invisible"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-1">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {cells.map((cell) => {
          if (!cell.inCurrentMonth) {
            return (
              <div key={cell.iso} className="py-1.5 text-slate-300 select-none">
                {cell.day}
              </div>
            );
          }

          const isStart = rangeMin !== '' && cell.iso === rangeMin;
          const isEnd = rangeMax !== '' && cell.iso === rangeMax;
          const isSingleSelected = draftStart === cell.iso && !effectivePreviewEnd;
          const isSelectedEndpoint = isStart || isEnd || isSingleSelected;
          const isInRange =
            rangeMin !== '' &&
            rangeMax !== '' &&
            cell.iso > rangeMin &&
            cell.iso < rangeMax;
          const isToday = cell.iso === todayISO;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => handleDayClick(cell.iso)}
              onMouseEnter={() => {
                if (draftStart && !draftEnd) {
                  setHoverDate(cell.iso);
                }
              }}
              className={`font-mono-num relative py-1.5 text-xs font-medium transition-colors ${
                isSelectedEndpoint
                  ? 'rounded-md bg-blue-600 font-bold text-white'
                  : isInRange
                  ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  : isToday
                  ? 'rounded-md font-semibold text-blue-700 ring-1 ring-inset ring-blue-300 hover:bg-slate-100'
                  : 'rounded-md text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );

  const periodLabel =
    startDate && endDate
      ? startDate === endDate
        ? formatDateBR(startDate)
        : `${formatDateBR(startDate)} — ${formatDateBR(endDate)}`
      : startDate
      ? `A partir de ${formatDateBR(startDate)}`
      : endDate
      ? `Até ${formatDateBR(endDate)}`
      : 'Todo o período';

  return (
    <div ref={containerRef} className="relative flex-1 space-y-3">
      {/* Filtros Rápidos + Botão do Calendário */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openCalendar())}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            open || preset === 'personalizado'
              ? 'border-blue-500 bg-blue-50/70 text-blue-900'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="font-mono-num text-xs sm:text-sm">{periodLabel}</span>
        </button>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleClearPeriod}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            title="Limpar período selecionado"
          >
            <X className="h-3.5 w-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map((item) => {
          const active = preset === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handlePresetClick(item.key)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Popover / Painel do Calendário Visual */}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-[600px] rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Selecionar intervalo personalizado
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700">
                <span>
                  Inicial:{' '}
                  <strong className="font-mono-num text-slate-900">
                    {draftStart ? formatDateBR(draftStart) : 'Clique no calendário'}
                  </strong>
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  Final:{' '}
                  <strong className="font-mono-num text-slate-900">
                    {draftEnd
                      ? formatDateBR(draftEnd)
                      : draftStart
                      ? 'Selecione a data final'
                      : '—'}
                  </strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar calendário"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {renderMonth(viewYear, viewMonth, leftGrid, false)}
            <div className="hidden md:block">
              {renderMonth(secondMonth.year, secondMonth.month, rightGrid, true)}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={handleClearPeriod}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpar período
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Aplicar filtro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
