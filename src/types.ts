export type OrderStatus =
  | 'aguardando_confirmacao'
  | 'confirmado'
  | 'em_producao'
  | 'pronto_retirada'
  | 'entregue'
  | 'cancelado';

export type WhatsAppTemplateKey =
  | 'registro'
  | 'confirmacao'
  | 'producao'
  | 'pronto'
  | 'entregue';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  perfil: 'admin' | 'atendente';
  ativo: boolean;
}

export interface Category {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
}

export interface Client {
  id: number;
  nome: string;
  telefone: string;
  telefoneLimpo: string;
  empresa?: string;
  observacoes?: string;
  ativo: boolean;
  criadoEm?: string;
}

export interface Product {
  id: number;
  categoriaId: number;
  categoria: string;
  nome: string;
  codigo: string;
  descricao: string;
  preco: number;
  unidadeMedida: string;
  ativo: boolean;
}

export interface OrderItem {
  id: number;
  produtoId: number | null;
  descricaoItem: string;
  unidadeMedida: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

export interface OrderHistoryEntry {
  id: number;
  statusAnterior: OrderStatus | null;
  statusNovo: OrderStatus;
  observacao: string;
  usuarioNome: string;
  criadoEm: string;
}

export interface Order {
  id: number;
  numero: string;
  clienteId: number;
  usuarioId?: string | null;
  dataCadastro: string;
  dataPrevisao: string;
  subtotal: number;
  desconto: number;
  valorTotal: number;
  status: OrderStatus;
  observacoes: string;
  itens: OrderItem[];
  historico: OrderHistoryEntry[];
}

export interface SystemConfig {
  nomeEmpresa: string;
  telefoneEmpresa: string;
  enderecoEmpresa: string;
  cnpjEmpresa: string;
  templates: Record<WhatsAppTemplateKey, string>;
}
