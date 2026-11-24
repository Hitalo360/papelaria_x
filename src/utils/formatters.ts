import { Client, Order, OrderStatus, SystemConfig } from '../types';

export const STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClass: string; color: string }
> = {
  aguardando_confirmacao: {
    label: 'Aguardando confirmação',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    color: '#D97706',
  },
  confirmado: {
    label: 'Confirmado',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    color: '#2563EB',
  },
  em_producao: {
    label: 'Em produção',
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
    color: '#7C3AED',
  },
  pronto_retirada: {
    label: 'Pronto para retirada',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    color: '#0D9488',
  },
  entregue: {
    label: 'Entregue',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    color: '#16A34A',
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    color: '#DC2626',
  },
};

export const DEFAULT_CONFIG: SystemConfig = {
  nomeEmpresa: 'Papelaria X',
  telefoneEmpresa: '',
  enderecoEmpresa: '',
  cnpjEmpresa: '',
  templates: {
    registro: `Olá, {cliente}!\n\nSeu pedido na {empresa} foi registrado!\n\nPedido nº: {numero}\n\nItens:\n{itens}\n\nTotal: {total}\n\nPrevisão de entrega: {previsao}.\n\nObrigado pela preferência!\n{empresa}.`,
    confirmacao: `Olá, {cliente}!\n\nConfirmamos o seu pedido nº {numero} na {empresa}.\n\nItens:\n{itens}\n\nValor total: {total}\nPrevisão de entrega: {previsao}.\n\nQualquer dúvida, estamos à disposição!`,
    producao: `Olá, {cliente}!\n\nBoa notícia: o seu pedido nº {numero} já entrou em produção na {empresa}.\n\nPrevisão de entrega: {previsao}.\n\nAssim que estiver pronto, avisaremos por aqui!`,
    pronto: `Olá, {cliente}!\n\nSeu pedido nº {numero} está PRONTO para retirada na {empresa}!\n\nValor total: {total}\n\nAguardamos você!`,
    entregue: `Olá, {cliente}!\n\nConfirmamos a entrega do seu pedido nº {numero}.\n\nMuito obrigado por escolher a {empresa}! Conte sempre conosco.`,
  },
};

export function formatBRL(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function cleanDigits(phone: string): string {
  return phone.replace(/\D+/g, '');
}

export function formatPhone(phone: string): string {
  const d = cleanDigits(phone);
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return phone;
}

export function waPhone(phone: string): string {
  const d = cleanDigits(phone).replace(/^0+/, '');
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

export function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return '-';
  const dt = new Date(isoDateTime);
  if (Number.isNaN(dt.getTime())) return isoDateTime;
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildWhatsAppMessage(
  template: string,
  order: Order,
  client: Client,
  config: SystemConfig
): string {
  const itensText = order.itens
    .map((it) => `- ${it.quantidade}x ${it.descricaoItem} — ${formatBRL(it.subtotal)}`)
    .join('\n');

  const previsao = order.dataPrevisao ? formatDateBR(order.dataPrevisao) : 'A combinar';

  return template
    .replaceAll('{cliente}', client.nome)
    .replaceAll('{numero}', order.numero)
    .replaceAll('{itens}', itensText)
    .replaceAll('{total}', formatBRL(order.valorTotal))
    .replaceAll('{previsao}', previsao)
    .replaceAll('{empresa}', config.nomeEmpresa || 'Papelaria X');
}
