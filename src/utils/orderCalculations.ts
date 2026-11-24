import { Product } from '../types';

export interface OrderItemDraftLike {
  tempId: number;
  produtoId: number | null;
  descricaoItem: string;
  unidadeMedida: string;
  quantidade: number;
  valorUnitario: number;
}

const FRACTIONAL_UNITS = new Set([
  'kg',
  'g',
  'mg',
  'm',
  'cm',
  'mm',
  'm2',
  'm²',
  'l',
  'ml',
  'metro',
  'metros',
  'litro',
  'litros',
  'quilo',
  'quilos',
  'grama',
  'gramas',
]);

/**
 * Retorna true apenas para unidades vendidas por peso, comprimento, área ou volume.
 * Produtos padrão (un, folha, cento, milheiro, caixa, bloco, etc.) usam quantidade inteira.
 */
export function isFractionalUnit(unidadeMedida: string): boolean {
  const normalized = (unidadeMedida || '').trim().toLowerCase();
  return FRACTIONAL_UNITS.has(normalized);
}

/**
 * Arredondamento monetário seguro usando aritmética de centavos para evitar imprecisões de ponto flutuante.
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  return (sign * Math.round(abs * 100 + 1e-9)) / 100;
}

export function normalizeQuantity(rawValue: number, unidadeMedida: string): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) return 0;
  if (isFractionalUnit(unidadeMedida)) {
    return roundCurrency(rawValue);
  }
  return Math.max(1, Math.round(rawValue));
}

export function stepQuantity(currentQty: number, delta: number, unidadeMedida: string): number {
  if (isFractionalUnit(unidadeMedida)) {
    const next = roundCurrency((Number.isFinite(currentQty) ? currentQty : 0) + delta);
    if (next <= 0) {
      return currentQty > 0 ? currentQty : 1;
    }
    return next;
  }

  const base = Number.isFinite(currentQty) && currentQty > 0 ? Math.round(currentQty) : 0;
  return Math.max(1, base + Math.round(delta));
}

/**
 * Adiciona 1 unidade do produto ao pedido.
 * Se o mesmo produto já estiver na lista, incrementa sua quantidade em exatamente 1 unidade
 * em vez de duplicar a linha.
 */
export function addOrIncrementProductItem<T extends OrderItemDraftLike>(
  items: T[],
  product: Pick<Product, 'id' | 'nome' | 'unidadeMedida' | 'preco'>,
  createTempId: () => number = () => Date.now() + Math.random()
): T[] {
  const existingIndex = items.findIndex((item) => item.produtoId === product.id);
  if (existingIndex >= 0) {
    return items.map((item, idx) => {
      if (idx !== existingIndex) return item;
      const nextQty = isFractionalUnit(item.unidadeMedida)
        ? roundCurrency((Number.isFinite(item.quantidade) ? item.quantidade : 0) + 1)
        : Math.max(1, Math.round(Number.isFinite(item.quantidade) ? item.quantidade : 0) + 1);
      return {
        ...item,
        quantidade: nextQty,
      };
    });
  }

  const newItem = {
    tempId: createTempId(),
    produtoId: product.id,
    descricaoItem: product.nome,
    unidadeMedida: product.unidadeMedida || 'un',
    quantidade: 1,
    valorUnitario: roundCurrency(Math.max(0, product.preco)),
  } as T;

  return [...items, newItem];
}

export function calculateItemSubtotal(quantidade: number, valorUnitario: number): number {
  const safeQty = Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 0;
  const safePriceCents = Math.round(
    (Number.isFinite(valorUnitario) && valorUnitario > 0 ? valorUnitario : 0) * 100 + 1e-9
  );
  return Math.round(safeQty * safePriceCents + 1e-9) / 100;
}

export function parseCurrencyInput(raw: number | string): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? roundCurrency(raw) : 0;
  }
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return 0;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? roundCurrency(parsed) : 0;
}

export function calculateOrderTotals(
  items: Array<{ quantidade: number; valorUnitario: number }>,
  discountInput: number | string
): { subtotal: number; desconto: number; valorTotal: number } {
  const subtotalCents = items.reduce((acc, item) => {
    const itemSub = calculateItemSubtotal(item.quantidade, item.valorUnitario);
    return acc + Math.round(itemSub * 100 + 1e-9);
  }, 0);

  const rawDiscount = parseCurrencyInput(discountInput);
  const rawDiscountCents = Math.round(rawDiscount * 100 + 1e-9);
  const discountCents = Math.min(subtotalCents, Math.max(0, rawDiscountCents));
  const totalCents = Math.max(0, subtotalCents - discountCents);

  return {
    subtotal: subtotalCents / 100,
    desconto: discountCents / 100,
    valorTotal: totalCents / 100,
  };
}
