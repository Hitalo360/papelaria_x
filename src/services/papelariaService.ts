import { getSupabaseClient } from '../lib/supabase';
import {
  Category,
  Client,
  Order,
  OrderHistoryEntry,
  OrderItem,
  OrderStatus,
  Product,
  SystemConfig,
  UserProfile,
} from '../types';
import { cleanDigits, DEFAULT_CONFIG, formatPhone } from '../utils/formatters';
import { calculateItemSubtotal, calculateOrderTotals, roundCurrency } from '../utils/orderCalculations';

function mapClient(row: Record<string, unknown>): Client {
  return {
    id: Number(row.id),
    nome: String(row.nome ?? ''),
    telefone: String(row.telefone ?? ''),
    telefoneLimpo: String(row.telefone_limpo ?? ''),
    empresa: row.empresa ? String(row.empresa) : '',
    observacoes: row.observacoes ? String(row.observacoes) : '',
    ativo: Boolean(row.ativo),
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  const catRel = row.categorias as { nome?: string } | null | undefined;
  return {
    id: Number(row.id),
    categoriaId: Number(row.categoria_id),
    categoria: catRel?.nome ? String(catRel.nome) : 'Geral',
    nome: String(row.nome ?? ''),
    codigo: String(row.codigo ?? ''),
    descricao: row.descricao ? String(row.descricao) : '',
    preco: Number(row.preco ?? 0),
    unidadeMedida: String(row.unidade_medida ?? 'un'),
    ativo: Boolean(row.ativo),
  };
}

function mapOrder(row: Record<string, unknown>): Order {
  const rawItens = Array.isArray(row.pedido_itens) ? row.pedido_itens : [];
  const rawHist = Array.isArray(row.pedido_historico) ? row.pedido_historico : [];

  const itens: OrderItem[] = rawItens
    .map((it: Record<string, unknown>) => ({
      id: Number(it.id),
      produtoId: it.produto_id !== null && it.produto_id !== undefined ? Number(it.produto_id) : null,
      descricaoItem: String(it.descricao_item ?? ''),
      unidadeMedida: String(it.unidade_medida ?? 'un'),
      quantidade: Number(it.quantidade ?? 0),
      valorUnitario: Number(it.valor_unitario ?? 0),
      subtotal: Number(it.subtotal ?? 0),
    }))
    .sort((a, b) => a.id - b.id);

  const historico: OrderHistoryEntry[] = rawHist
    .map((h: Record<string, unknown>) => ({
      id: Number(h.id),
      statusAnterior: h.status_anterior ? (String(h.status_anterior) as OrderStatus) : null,
      statusNovo: String(h.status_novo) as OrderStatus,
      observacao: h.observacao ? String(h.observacao) : '',
      usuarioNome: h.usuario_nome ? String(h.usuario_nome) : 'Sistema',
      criadoEm: String(h.criado_em ?? ''),
    }))
    .sort((a, b) => b.id - a.id);

  return {
    id: Number(row.id),
    numero: String(row.numero ?? ''),
    clienteId: Number(row.cliente_id),
    usuarioId: row.usuario_id ? String(row.usuario_id) : null,
    dataCadastro: String(row.data_cadastro ?? ''),
    dataPrevisao: row.data_previsao ? String(row.data_previsao) : '',
    subtotal: Number(row.subtotal ?? 0),
    desconto: Number(row.desconto ?? 0),
    valorTotal: Number(row.valor_total ?? 0),
    status: String(row.status) as OrderStatus,
    observacoes: row.observacoes ? String(row.observacoes) : '',
    itens,
    historico,
  };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('perfis')
    .select('id, nome, email, perfil, ativo')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao carregar perfil: ${error.message}`);
  if (!data) return null;

  return {
    id: String(data.id),
    nome: String(data.nome),
    email: String(data.email),
    perfil: data.perfil === 'admin' ? 'admin' : 'atendente',
    ativo: Boolean(data.ativo),
  };
}

export async function fetchClients(): Promise<Client[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw new Error(`Erro ao carregar clientes: ${error.message}`);
  return (data ?? []).map(mapClient);
}

export async function saveClient(input: {
  id?: number | null;
  nome: string;
  telefone: string;
  empresa: string;
  observacoes: string;
  ativo: boolean;
}): Promise<Client> {
  const sb = getSupabaseClient();
  const telLimpo = cleanDigits(input.telefone);
  if (!input.nome.trim() || telLimpo.length < 8) {
    throw new Error('Informe o nome completo e um telefone válido (mínimo 8 dígitos).');
  }

  // Verifica duplicidade por telefone_limpo
  let dupQuery = sb
    .from('clientes')
    .select('id, nome')
    .eq('telefone_limpo', telLimpo);
  if (input.id) {
    dupQuery = dupQuery.neq('id', input.id);
  }
  const { data: dupData, error: dupErr } = await dupQuery.maybeSingle();
  if (dupErr) throw new Error(`Erro ao verificar telefone: ${dupErr.message}`);
  if (dupData) {
    throw new Error(`Já existe um cliente cadastrado com este telefone: ${dupData.nome}.`);
  }

  const payload = {
    nome: input.nome.trim(),
    telefone: formatPhone(input.telefone),
    telefone_limpo: telLimpo,
    empresa: input.empresa.trim() || null,
    observacoes: input.observacoes.trim() || null,
    ativo: input.ativo,
  };

  if (input.id) {
    const { data, error } = await sb
      .from('clientes')
      .update(payload)
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar cliente: ${error.message}`);
    return mapClient(data);
  }

  const { data, error } = await sb
    .from('clientes')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Erro ao cadastrar cliente: ${error.message}`);
  return mapClient(data);
}

export async function toggleOrDeleteClient(clientId: number): Promise<'deleted' | 'toggled'> {
  const sb = getSupabaseClient();
  const { count, error: countErr } = await sb
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clientId);

  if (countErr) throw new Error(`Erro ao verificar pedidos do cliente: ${countErr.message}`);

  if ((count ?? 0) > 0) {
    const { data: cur, error: curErr } = await sb
      .from('clientes')
      .select('ativo')
      .eq('id', clientId)
      .single();
    if (curErr) throw new Error(`Erro ao consultar cliente: ${curErr.message}`);

    const { error: updErr } = await sb
      .from('clientes')
      .update({ ativo: !cur.ativo })
      .eq('id', clientId);
    if (updErr) throw new Error(`Erro ao alterar situação do cliente: ${updErr.message}`);
    return 'toggled';
  }

  const { error: delErr } = await sb.from('clientes').delete().eq('id', clientId);
  if (delErr) throw new Error(`Erro ao excluir cliente: ${delErr.message}`);
  return 'deleted';
}

export async function fetchCategories(): Promise<Category[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('categorias')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) throw new Error(`Erro ao carregar categorias: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    nome: String(row.nome),
    descricao: row.descricao ? String(row.descricao) : null,
    ativo: Boolean(row.ativo),
  }));
}

export async function createCategory(nome: string): Promise<Category> {
  const sb = getSupabaseClient();
  const clean = nome.trim();
  if (!clean) throw new Error('Informe o nome da categoria.');

  const { data, error } = await sb
    .from('categorias')
    .insert({ nome: clean, ativo: true })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Esta categoria já está cadastrada.');
    }
    throw new Error(`Erro ao criar categoria: ${error.message}`);
  }
  return {
    id: Number(data.id),
    nome: String(data.nome),
    descricao: data.descricao ? String(data.descricao) : null,
    ativo: Boolean(data.ativo),
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('produtos')
    .select('*, categorias(nome)')
    .order('nome', { ascending: true });

  if (error) throw new Error(`Erro ao carregar produtos: ${error.message}`);
  return (data ?? []).map(mapProduct);
}

export async function saveProduct(input: {
  id?: number | null;
  nome: string;
  codigo: string;
  categoriaId: number;
  unidadeMedida: string;
  preco: number;
  descricao: string;
  ativo: boolean;
}): Promise<Product> {
  const sb = getSupabaseClient();
  const codigoNorm = input.codigo.trim().toUpperCase();
  if (!input.nome.trim() || !codigoNorm || !input.categoriaId) {
    throw new Error('Preencha nome, código e categoria do produto.');
  }

  let dupQuery = sb.from('produtos').select('id').eq('codigo', codigoNorm);
  if (input.id) dupQuery = dupQuery.neq('id', input.id);
  const { data: dup, error: dupErr } = await dupQuery.maybeSingle();
  if (dupErr) throw new Error(`Erro ao verificar código: ${dupErr.message}`);
  if (dup) throw new Error(`Já existe outro produto cadastrado com o código ${codigoNorm}.`);

  const payload = {
    categoria_id: input.categoriaId,
    nome: input.nome.trim(),
    codigo: codigoNorm,
    descricao: input.descricao.trim() || null,
    preco: Math.max(0, Number(input.preco) || 0),
    unidade_medida: input.unidadeMedida.trim() || 'un',
    ativo: input.ativo,
  };

  if (input.id) {
    const { data, error } = await sb
      .from('produtos')
      .update(payload)
      .eq('id', input.id)
      .select('*, categorias(nome)')
      .single();
    if (error) throw new Error(`Erro ao atualizar produto: ${error.message}`);
    return mapProduct(data);
  }

  const { data, error } = await sb
    .from('produtos')
    .insert(payload)
    .select('*, categorias(nome)')
    .single();
  if (error) throw new Error(`Erro ao cadastrar produto: ${error.message}`);
  return mapProduct(data);
}

export async function toggleOrDeleteProduct(productId: number): Promise<'deleted' | 'toggled'> {
  const sb = getSupabaseClient();
  const { count, error: countErr } = await sb
    .from('pedido_itens')
    .select('id', { count: 'exact', head: true })
    .eq('produto_id', productId);

  if (countErr) throw new Error(`Erro ao verificar itens de pedidos: ${countErr.message}`);

  if ((count ?? 0) > 0) {
    const { data: cur, error: curErr } = await sb
      .from('produtos')
      .select('ativo')
      .eq('id', productId)
      .single();
    if (curErr) throw new Error(`Erro ao consultar produto: ${curErr.message}`);

    const { error: updErr } = await sb
      .from('produtos')
      .update({ ativo: !cur.ativo })
      .eq('id', productId);
    if (updErr) throw new Error(`Erro ao alterar situação do produto: ${updErr.message}`);
    return 'toggled';
  }

  const { error: delErr } = await sb.from('produtos').delete().eq('id', productId);
  if (delErr) throw new Error(`Erro ao excluir produto: ${delErr.message}`);
  return 'deleted';
}

export async function fetchOrders(): Promise<Order[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('pedidos')
    .select('*, pedido_itens(*), pedido_historico(*)')
    .order('data_cadastro', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw new Error(`Erro ao carregar pedidos: ${error.message}`);
  return (data ?? []).map(mapOrder);
}

export async function createOrder(input: {
  clienteId: number;
  usuarioId: string;
  usuarioNome: string;
  dataCadastro?: string;
  dataPrevisao: string;
  desconto: number;
  observacoes: string;
  itens: Array<{
    produtoId: number | null;
    descricaoItem: string;
    unidadeMedida: string;
    quantidade: number;
    valorUnitario: number;
  }>;
}): Promise<Order> {
  const sb = getSupabaseClient();

  if (input.itens.length === 0) {
    throw new Error('Adicione pelo menos um produto ou serviço válido ao pedido.');
  }

  const { subtotal, desconto, valorTotal } = calculateOrderTotals(input.itens, input.desconto);

  const statusInicial: OrderStatus = 'aguardando_confirmacao';

  const { data: pedidoRow, error: pedErr } = await sb
    .from('pedidos')
    .insert({
      numero: '', // trigger gera número sequencial automaticamente
      cliente_id: input.clienteId,
      usuario_id: input.usuarioId,
      data_cadastro: input.dataCadastro ? new Date(input.dataCadastro).toISOString() : new Date().toISOString(),
      data_previsao: input.dataPrevisao || null,
      subtotal,
      desconto,
      valor_total: valorTotal,
      status: statusInicial,
      observacoes: input.observacoes.trim() || null,
    })
    .select()
    .single();

  if (pedErr) throw new Error(`Erro ao criar pedido: ${pedErr.message}`);

  const pedidoId = Number(pedidoRow.id);

  const itensPayload = input.itens.map((it) => ({
    pedido_id: pedidoId,
    produto_id: it.produtoId,
    descricao_item: it.descricaoItem.trim(),
    unidade_medida: it.unidadeMedida.trim() || 'un',
    quantidade: Number(it.quantidade),
    valor_unitario: roundCurrency(Number(it.valorUnitario)),
    subtotal: calculateItemSubtotal(it.quantidade, it.valorUnitario),
  }));

  const { error: itensErr } = await sb.from('pedido_itens').insert(itensPayload);
  if (itensErr) {
    await sb.from('pedidos').delete().eq('id', pedidoId);
    throw new Error(`Erro ao salvar itens do pedido: ${itensErr.message}`);
  }

  const { error: histErr } = await sb.from('pedido_historico').insert({
    pedido_id: pedidoId,
    usuario_id: input.usuarioId,
    usuario_nome: input.usuarioNome,
    status_anterior: null,
    status_novo: statusInicial,
    observacao: 'Pedido registrado no sistema',
  });
  if (histErr) {
    throw new Error(`Pedido salvo, mas houve erro no histórico: ${histErr.message}`);
  }

  const { data: fullOrder, error: reloadErr } = await sb
    .from('pedidos')
    .select('*, pedido_itens(*), pedido_historico(*)')
    .eq('id', pedidoId)
    .single();

  if (reloadErr) throw new Error(`Erro ao recarregar pedido criado: ${reloadErr.message}`);
  return mapOrder(fullOrder);
}

export async function updateOrder(input: {
  id: number;
  clienteId: number;
  dataPrevisao: string;
  desconto: number;
  observacoes: string;
  statusAnterior: OrderStatus;
  statusNovo: OrderStatus;
  usuarioId: string;
  usuarioNome: string;
  itens: Array<{
    produtoId: number | null;
    descricaoItem: string;
    unidadeMedida: string;
    quantidade: number;
    valorUnitario: number;
  }>;
}): Promise<Order> {
  const sb = getSupabaseClient();

  if (input.itens.length === 0) {
    throw new Error('O pedido precisa conter pelo menos um item válido.');
  }

  const { subtotal, desconto, valorTotal } = calculateOrderTotals(input.itens, input.desconto);

  const { error: updErr } = await sb
    .from('pedidos')
    .update({
      cliente_id: input.clienteId,
      data_previsao: input.dataPrevisao || null,
      subtotal,
      desconto,
      valor_total: valorTotal,
      status: input.statusNovo,
      observacoes: input.observacoes.trim() || null,
    })
    .eq('id', input.id);

  if (updErr) throw new Error(`Erro ao atualizar pedido: ${updErr.message}`);

  const { error: delItemsErr } = await sb
    .from('pedido_itens')
    .delete()
    .eq('pedido_id', input.id);
  if (delItemsErr) throw new Error(`Erro ao atualizar itens: ${delItemsErr.message}`);

  const itensPayload = input.itens.map((it) => ({
    pedido_id: input.id,
    produto_id: it.produtoId,
    descricao_item: it.descricaoItem.trim(),
    unidade_medida: it.unidadeMedida.trim() || 'un',
    quantidade: Number(it.quantidade),
    valor_unitario: roundCurrency(Number(it.valorUnitario)),
    subtotal: calculateItemSubtotal(it.quantidade, it.valorUnitario),
  }));

  const { error: insItemsErr } = await sb.from('pedido_itens').insert(itensPayload);
  if (insItemsErr) throw new Error(`Erro ao gravar itens atualizados: ${insItemsErr.message}`);

  if (input.statusNovo !== input.statusAnterior) {
    const { error: histErr } = await sb.from('pedido_historico').insert({
      pedido_id: input.id,
      usuario_id: input.usuarioId,
      usuario_nome: input.usuarioNome,
      status_anterior: input.statusAnterior,
      status_novo: input.statusNovo,
      observacao: 'Status alterado durante a edição do pedido',
    });
    if (histErr) throw new Error(`Erro ao registrar histórico: ${histErr.message}`);
  }

  const { data: fullOrder, error: reloadErr } = await sb
    .from('pedidos')
    .select('*, pedido_itens(*), pedido_historico(*)')
    .eq('id', input.id)
    .single();

  if (reloadErr) throw new Error(`Erro ao recarregar pedido: ${reloadErr.message}`);
  return mapOrder(fullOrder);
}

export async function updateOrderStatus(input: {
  orderId: number;
  statusAnterior: OrderStatus;
  statusNovo: OrderStatus;
  observacao: string;
  usuarioId: string;
  usuarioNome: string;
}): Promise<Order> {
  const sb = getSupabaseClient();

  const { error: updErr } = await sb
    .from('pedidos')
    .update({ status: input.statusNovo })
    .eq('id', input.orderId);
  if (updErr) throw new Error(`Erro ao atualizar status: ${updErr.message}`);

  const { error: histErr } = await sb.from('pedido_historico').insert({
    pedido_id: input.orderId,
    usuario_id: input.usuarioId,
    usuario_nome: input.usuarioNome,
    status_anterior: input.statusAnterior,
    status_novo: input.statusNovo,
    observacao: input.observacao.trim() || 'Atualização de status',
  });
  if (histErr) throw new Error(`Erro ao registrar histórico: ${histErr.message}`);

  const { data: fullOrder, error: reloadErr } = await sb
    .from('pedidos')
    .select('*, pedido_itens(*), pedido_historico(*)')
    .eq('id', input.orderId)
    .single();
  if (reloadErr) throw new Error(`Erro ao recarregar pedido: ${reloadErr.message}`);
  return mapOrder(fullOrder);
}

export async function deleteOrder(orderId: number): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.from('pedidos').delete().eq('id', orderId);
  if (error) throw new Error(`Erro ao excluir pedido: ${error.message}`);
}

export async function fetchConfig(): Promise<SystemConfig> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('configuracoes').select('chave, valor');
  if (error) throw new Error(`Erro ao carregar configurações: ${error.message}`);

  const map = new Map<string, string>();
  (data ?? []).forEach((row) => {
    map.set(String(row.chave), row.valor ? String(row.valor) : '');
  });

  return {
    nomeEmpresa: map.get('nome_empresa') || DEFAULT_CONFIG.nomeEmpresa,
    telefoneEmpresa: map.get('telefone_empresa') ?? DEFAULT_CONFIG.telefoneEmpresa,
    enderecoEmpresa: map.get('endereco_empresa') ?? DEFAULT_CONFIG.enderecoEmpresa,
    cnpjEmpresa: map.get('cnpj_empresa') ?? DEFAULT_CONFIG.cnpjEmpresa,
    templates: {
      registro: map.get('whatsapp_registro') || DEFAULT_CONFIG.templates.registro,
      confirmacao: map.get('whatsapp_confirmacao') || DEFAULT_CONFIG.templates.confirmacao,
      producao: map.get('whatsapp_producao') || DEFAULT_CONFIG.templates.producao,
      pronto: map.get('whatsapp_pronto') || DEFAULT_CONFIG.templates.pronto,
      entregue: map.get('whatsapp_entregue') || DEFAULT_CONFIG.templates.entregue,
    },
  };
}

export async function saveConfig(cfg: SystemConfig): Promise<void> {
  const sb = getSupabaseClient();
  const rows = [
    { chave: 'nome_empresa', valor: cfg.nomeEmpresa.trim() || 'Papelaria X' },
    { chave: 'telefone_empresa', valor: cfg.telefoneEmpresa.trim() },
    { chave: 'endereco_empresa', valor: cfg.enderecoEmpresa.trim() },
    { chave: 'cnpj_empresa', valor: cfg.cnpjEmpresa.trim() },
    { chave: 'whatsapp_registro', valor: cfg.templates.registro },
    { chave: 'whatsapp_confirmacao', valor: cfg.templates.confirmacao },
    { chave: 'whatsapp_producao', valor: cfg.templates.producao },
    { chave: 'whatsapp_pronto', valor: cfg.templates.pronto },
    { chave: 'whatsapp_entregue', valor: cfg.templates.entregue },
  ];

  const { error } = await sb
    .from('configuracoes')
    .upsert(rows, { onConflict: 'chave' });

  if (error) throw new Error(`Erro ao salvar configurações: ${error.message}`);
}
