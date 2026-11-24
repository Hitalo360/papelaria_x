import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  BarChart3,
  Check,
  Download,
  Edit3,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Minus,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  PlusCircle,
  Printer,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  Category,
  Client,
  Order,
  OrderStatus,
  Product,
  SystemConfig,
  UserProfile,
  WhatsAppTemplateKey,
} from './types';
import {
  cleanDigits,
  DEFAULT_CONFIG,
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  STATUS_META,
  waPhone,
} from './utils/formatters';
import {
  addOrIncrementProductItem,
  calculateItemSubtotal,
  calculateOrderTotals,
  isFractionalUnit,
  normalizeQuantity,
  roundCurrency,
  stepQuantity,
} from './utils/orderCalculations';
import {
  computeReportData,
  DatePresetKey,
  resolvePresetRange,
} from './utils/dateRange';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  createCategory,
  createOrder,
  deleteOrder,
  fetchCategories,
  fetchClients,
  fetchConfig,
  fetchOrders,
  fetchProducts,
  fetchUserProfile,
  saveClient,
  saveConfig,
  saveProduct,
  toggleOrDeleteClient,
  toggleOrDeleteProduct,
  updateOrder,
  updateOrderStatus,
} from './services/papelariaService';
import { WhatsAppModal } from './components/WhatsAppModal';
import { DateRangePicker } from './components/DateRangePicker';
import { DashboardView } from './components/DashboardView';
import {
  computeDashboardAnalytics,
  DashboardPeriodKey,
} from './utils/dashboardMetrics';

type SectionId =
  | 'dashboard'
  | 'pedidos'
  | 'novo_pedido'
  | 'visualizar_pedido'
  | 'editar_pedido'
  | 'clientes'
  | 'visualizar_cliente'
  | 'produtos'
  | 'relatorios'
  | 'configuracoes';

interface DraftOrderItem {
  tempId: number;
  produtoId: number | null;
  descricaoItem: string;
  unidadeMedida: string;
  quantidade: number;
  valorUnitario: number;
}

export default function App() {
  // Autenticação Supabase
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginConfirmPassword, setLoginConfirmPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');

  // Navegação e UI
  const [section, setSection] = useState<SectionId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriodKey>('este_mes');
  const [flashMessage, setFlashMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Dados reais do Supabase PostgreSQL
  const [loadingData, setLoadingData] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [dataError, setDataError] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [waOrderId, setWaOrderId] = useState<number | null>(null);

  // Filtros - Pedidos
  const [filterNumero, setFilterNumero] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterTelefone, setFilterTelefone] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');

  // Novo / Editar Pedido
  const [clientMode, setClientMode] = useState<'existente' | 'novo'>('existente');
  const [orderClientId, setOrderClientId] = useState<number>(0);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientObs, setNewClientObs] = useState('');
  const [orderPrevisao, setOrderPrevisao] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [orderDesconto, setOrderDesconto] = useState('0');
  const [orderObs, setOrderObs] = useState('');
  const [orderEditStatus, setOrderEditStatus] = useState<OrderStatus>('aguardando_confirmacao');
  const [catalogSelectedId, setCatalogSelectedId] = useState<string>('');
  const [draftItems, setDraftItems] = useState<DraftOrderItem[]>([]);

  // Atualizar Status em Visualizar Pedido
  const [statusToUpdate, setStatusToUpdate] = useState<OrderStatus>('aguardando_confirmacao');
  const [statusObs, setStatusObs] = useState('');

  // Clientes CRUD
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [cliFormNome, setCliFormNome] = useState('');
  const [cliFormTel, setCliFormTel] = useState('');
  const [cliFormEmpresa, setCliFormEmpresa] = useState('');
  const [cliFormObs, setCliFormObs] = useState('');
  const [cliFormAtivo, setCliFormAtivo] = useState(true);

  // Produtos CRUD
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [prodFormNome, setProdFormNome] = useState('');
  const [prodFormCodigo, setProdFormCodigo] = useState('');
  const [prodFormCategoriaId, setProdFormCategoriaId] = useState<number>(0);
  const [prodFormUnidade, setProdFormUnidade] = useState('un');
  const [prodFormPreco, setProdFormPreco] = useState('0.00');
  const [prodFormDesc, setProdFormDesc] = useState('');
  const [prodFormAtivo, setProdFormAtivo] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Relatórios
  const [reportPreset, setReportPreset] = useState<DatePresetKey>('este_mes');
  const [reportStart, setReportStart] = useState(() => resolvePresetRange('este_mes').startDate);
  const [reportEnd, setReportEnd] = useState(() => resolvePresetRange('este_mes').endDate);

  const showFlash = (type: 'success' | 'error' | 'info', text: string) => {
    setFlashMessage({ type, text });
  };

  // Carrega todos os dados reais do Supabase
  const loadAllData = useCallback(async (activeSession: Session | null) => {
    if (!activeSession || !supabase) return;
    setLoadingData(true);
    setDataError('');
    try {
      const [prof, cls, cats, prods, ords, cfg] = await Promise.all([
        fetchUserProfile(activeSession.user.id),
        fetchClients(),
        fetchCategories(),
        fetchProducts(),
        fetchOrders(),
        fetchConfig(),
      ]);

      if (prof && !prof.ativo) {
        await supabase.auth.signOut();
        setLoginError('Seu usuário está desativado. Procure o administrador.');
        return;
      }

      setUserProfile(prof);
      setClients(cls);
      setCategories(cats);
      setProducts(prods);
      setOrders(ords);
      setConfig(cfg);

      if (cats.length > 0) {
        setProdFormCategoriaId((prev) => (prev > 0 ? prev : cats[0].id));
      }
      if (cls.length > 0) {
        const firstActive = cls.find((c) => c.ativo) ?? cls[0];
        setOrderClientId((prev) => (prev > 0 ? prev : firstActive.id));
      }
      if (ords.length > 0) {
        setSelectedOrderId((prev) => (prev && ords.some((o) => o.id === prev) ? prev : ords[0].id));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com o servidor.';
      setDataError(msg);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Monitoramento de sessão Supabase Auth
  useEffect(() => {
    if (!supabase) {
      setAuthChecking(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setLoginError(error.message);
      }
      setSession(data.session ?? null);
      setAuthChecking(false);
      if (data.session) {
        loadAllData(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession) {
        loadAllData(nextSession);
      } else {
        setUserProfile(null);
        setClients([]);
        setCategories([]);
        setProducts([]);
        setOrders([]);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAllData]);

  const clientById = useMemo(() => {
    const map = new Map<number, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const navigate = (target: SectionId) => {
    setSection(target);
    setMobileMenuOpen(false);
    setFlashMessage(null);
  };

  // Indicadores e análises reais do Dashboard
  const dashboardAnalytics = useMemo(
    () =>
      computeDashboardAnalytics(
        orders,
        clients,
        products,
        clientById,
        dashboardPeriod
      ),
    [orders, clients, products, clientById, dashboardPeriod]
  );

  // Pedidos filtrados
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const cli = clientById.get(o.clienteId);
      if (filterNumero && !o.numero.includes(filterNumero.trim())) return false;
      if (filterCliente && !(cli?.nome.toLowerCase().includes(filterCliente.trim().toLowerCase()))) {
        return false;
      }
      if (filterTelefone) {
        const cleanQ = cleanDigits(filterTelefone);
        if (cleanQ && !(cli?.telefoneLimpo.includes(cleanQ))) return false;
      }
      if (filterStatus && o.status !== filterStatus) return false;
      const dateStr = o.dataCadastro.slice(0, 10);
      if (filterDataInicio && dateStr < filterDataInicio) return false;
      if (filterDataFim && dateStr > filterDataFim) return false;
      return true;
    });
  }, [orders, clientById, filterNumero, filterCliente, filterTelefone, filterStatus, filterDataInicio, filterDataFim]);

  // Cálculo em tempo real do rascunho de pedido (sem erros de arredondamento)
  const {
    subtotal: draftSubtotal,
    desconto: parsedDiscount,
    valorTotal: draftTotal,
  } = useMemo(
    () => calculateOrderTotals(draftItems, orderDesconto),
    [draftItems, orderDesconto]
  );

  const nextOrderNumberPreview = useMemo(() => {
    const maxNum = orders.reduce((max, o) => Math.max(max, parseInt(o.numero, 10) || 0), 0);
    return String(maxNum + 1).padStart(6, '0');
  }, [orders]);

  // Clientes filtrados
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (clientStatusFilter === 'ativos' && !c.ativo) return false;
      if (clientStatusFilter === 'inativos' && c.ativo) return false;
      if (clientSearch.trim()) {
        const q = clientSearch.trim().toLowerCase();
        const qDigits = cleanDigits(q);
        const matchName = c.nome.toLowerCase().includes(q);
        const matchCompany = (c.empresa || '').toLowerCase().includes(q);
        const matchPhone = qDigits !== '' && c.telefoneLimpo.includes(qDigits);
        if (!matchName && !matchCompany && !matchPhone) return false;
      }
      return true;
    });
  }, [clients, clientStatusFilter, clientSearch]);

  // Produtos filtrados
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productStatusFilter === 'ativos' && !p.ativo) return false;
      if (productStatusFilter === 'inativos' && p.ativo) return false;
      if (productCategoryFilter && p.categoria !== productCategoryFilter) return false;
      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase();
        if (
          !p.nome.toLowerCase().includes(q) &&
          !p.codigo.toLowerCase().includes(q) &&
          !p.descricao.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [products, productStatusFilter, productCategoryFilter, productSearch]);

  // Agregação real de Relatórios
  const reportData = useMemo(
    () => computeReportData(orders, clientById, reportStart, reportEnd),
    [orders, clientById, reportStart, reportEnd]
  );

  // Handlers de Autenticação
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setLoginError('Serviço de autenticação indisponível no momento.');
      return;
    }

    setLoginError('');
    setLoginSuccess('');
    setAuthSubmitting(true);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail.trim(),
          password: loginPassword,
        });
        if (error) {
          throw new Error(
            error.message === 'Invalid login credentials'
              ? 'E-mail ou senha inválidos.'
              : error.message
          );
        }
        setSection('dashboard');
      } else {
        if (!loginName.trim()) {
          throw new Error('Informe seu nome completo.');
        }
        if (loginPassword.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }
        if (loginPassword !== loginConfirmPassword) {
          throw new Error('A confirmação de senha não confere.');
        }

        const { data, error } = await supabase.auth.signUp({
          email: loginEmail.trim(),
          password: loginPassword,
          options: {
            data: { nome: loginName.trim() },
          },
        });
        if (error) throw new Error(error.message);

        if (data.session) {
          setSection('dashboard');
        } else {
          setLoginSuccess(
            'Conta criada! Verifique seu e-mail para confirmar o cadastro ou faça login se a confirmação estiver desativada.'
          );
          setAuthMode('login');
        }
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Falha na autenticação.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setLoginPassword('');
    setLoginError('');
  };

  // Handlers de Pedidos
  const prepareNewOrderForm = () => {
    setDraftItems([]);
    setOrderDesconto('0');
    setOrderObs('');
    setNewClientName('');
    setNewClientPhone('');
    setNewClientCompany('');
    setNewClientObs('');
    setClientMode(clients.some((c) => c.ativo) ? 'existente' : 'novo');
    const firstActive = clients.find((c) => c.ativo);
    if (firstActive) setOrderClientId(firstActive.id);
    navigate('novo_pedido');
  };

  const handleAddCatalogItem = () => {
    const id = parseInt(catalogSelectedId, 10);
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    setDraftItems((prev) => addOrIncrementProductItem(prev, prod));
    setCatalogSelectedId('');
  };

  const handleAddManualItem = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        tempId: Date.now() + Math.random(),
        produtoId: null,
        descricaoItem: '',
        unidadeMedida: 'un',
        quantidade: 1,
        valorUnitario: 0,
      },
    ]);
  };

  const handleSaveNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const validItems = draftItems.filter((it) => it.descricaoItem.trim() !== '' && it.quantidade > 0);
    if (validItems.length === 0) {
      showFlash('error', 'Adicione pelo menos um produto ou serviço válido ao pedido.');
      return;
    }

    setSavingAction(true);
    try {
      let finalClientId = orderClientId;

      if (clientMode === 'novo') {
        const cleaned = cleanDigits(newClientPhone);
        if (!newClientName.trim() || cleaned.length < 8) {
          throw new Error('Informe o nome completo e um telefone válido para o novo cliente.');
        }
        const existing = clients.find((c) => c.telefoneLimpo === cleaned);
        if (existing) {
          finalClientId = existing.id;
        } else {
          const savedCli = await saveClient({
            nome: newClientName,
            telefone: newClientPhone,
            empresa: newClientCompany,
            observacoes: newClientObs,
            ativo: true,
          });
          setClients((prev) => [...prev, savedCli].sort((a, b) => a.nome.localeCompare(b.nome)));
          finalClientId = savedCli.id;
        }
      } else if (!finalClientId) {
        throw new Error('Selecione um cliente cadastrado ou cadastre um novo cliente.');
      }

      const created = await createOrder({
        clienteId: finalClientId,
        usuarioId: session.user.id,
        usuarioNome: userProfile?.nome || session.user.email || 'Atendente',
        dataPrevisao: orderPrevisao,
        desconto: parsedDiscount,
        observacoes: orderObs,
        itens: validItems.map((it) => ({
          produtoId: it.produtoId,
          descricaoItem: it.descricaoItem,
          unidadeMedida: it.unidadeMedida,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
        })),
      });

      setOrders((prev) => [created, ...prev]);
      setDraftItems([]);
      setOrderDesconto('0');
      setOrderObs('');
      setSelectedOrderId(created.id);
      setStatusToUpdate(created.status);
      setSection('visualizar_pedido');
      showFlash(
        'success',
        `Pedido #${created.numero} salvo no banco! Você já pode enviar pelo WhatsApp.`
      );
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao salvar pedido.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenEditOrder = (order: Order) => {
    setSelectedOrderId(order.id);
    setOrderClientId(order.clienteId);
    setOrderPrevisao(order.dataPrevisao || '');
    setOrderDesconto(order.desconto.toFixed(2));
    setOrderObs(order.observacoes || '');
    setOrderEditStatus(order.status);
    setDraftItems(
      order.itens.map((it, idx) => ({
        tempId: it.id || idx + 1,
        produtoId: it.produtoId,
        descricaoItem: it.descricaoItem,
        unidadeMedida: it.unidadeMedida,
        quantidade: it.quantidade,
        valorUnitario: it.valorUnitario,
      }))
    );
    navigate('editar_pedido');
  };

  const handleSaveEditedOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !activeOrder) return;

    const validItems = draftItems.filter((it) => it.descricaoItem.trim() !== '' && it.quantidade > 0);
    if (validItems.length === 0) {
      showFlash('error', 'O pedido precisa conter pelo menos um item válido.');
      return;
    }

    setSavingAction(true);
    try {
      const updated = await updateOrder({
        id: activeOrder.id,
        clienteId: orderClientId,
        dataPrevisao: orderPrevisao,
        desconto: parsedDiscount,
        observacoes: orderObs,
        statusAnterior: activeOrder.status,
        statusNovo: orderEditStatus,
        usuarioId: session.user.id,
        usuarioNome: userProfile?.nome || session.user.email || 'Atendente',
        itens: validItems.map((it) => ({
          produtoId: it.produtoId,
          descricaoItem: it.descricaoItem,
          unidadeMedida: it.unidadeMedida,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
        })),
      });

      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedOrderId(updated.id);
      setStatusToUpdate(updated.status);
      setSection('visualizar_pedido');
      showFlash('success', `Pedido #${updated.numero} atualizado com sucesso.`);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao atualizar pedido.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenOrder = (id: number) => {
    const found = orders.find((o) => o.id === id);
    if (!found) return;
    setSelectedOrderId(id);
    setStatusToUpdate(found.status);
    setStatusObs('');
    navigate('visualizar_pedido');
  };

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !activeOrder) return;
    if (activeOrder.status === statusToUpdate && !statusObs.trim()) {
      showFlash('info', 'O status selecionado já é o status atual deste pedido.');
      return;
    }

    setSavingAction(true);
    try {
      const updated = await updateOrderStatus({
        orderId: activeOrder.id,
        statusAnterior: activeOrder.status,
        statusNovo: statusToUpdate,
        observacao: statusObs,
        usuarioId: session.user.id,
        usuarioNome: userProfile?.nome || session.user.email || 'Atendente',
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setStatusObs('');
      showFlash('success', 'Status do pedido atualizado no banco de dados.');
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    setSavingAction(true);
    try {
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      navigate('pedidos');
      showFlash('success', 'Pedido excluído com sucesso.');
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao excluir pedido.');
    } finally {
      setSavingAction(false);
    }
  };

  // Handlers de Clientes
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAction(true);
    try {
      const saved = await saveClient({
        id: editingClientId,
        nome: cliFormNome,
        telefone: cliFormTel,
        empresa: cliFormEmpresa,
        observacoes: cliFormObs,
        ativo: cliFormAtivo,
      });

      setClients((prev) => {
        const exists = prev.some((c) => c.id === saved.id);
        const next = exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
        return next.sort((a, b) => a.nome.localeCompare(b.nome));
      });

      showFlash(
        'success',
        editingClientId ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.'
      );
      setEditingClientId(null);
      setCliFormNome('');
      setCliFormTel('');
      setCliFormEmpresa('');
      setCliFormObs('');
      setCliFormAtivo(true);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao salvar cliente.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleEditClient = (cli: Client) => {
    setEditingClientId(cli.id);
    setCliFormNome(cli.nome);
    setCliFormTel(cli.telefone);
    setCliFormEmpresa(cli.empresa || '');
    setCliFormObs(cli.observacoes || '');
    setCliFormAtivo(cli.ativo);
  };

  const handleToggleOrDeleteClient = async (cliId: number) => {
    setSavingAction(true);
    try {
      const outcome = await toggleOrDeleteClient(cliId);
      if (outcome === 'deleted') {
        setClients((prev) => prev.filter((c) => c.id !== cliId));
        showFlash('success', 'Cliente excluído com sucesso.');
      } else {
        setClients((prev) => prev.map((c) => (c.id === cliId ? { ...c, ativo: !c.ativo } : c)));
        showFlash('info', 'Cliente possui pedidos vinculados; situação alterada entre ativo/inativo.');
      }
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao remover/alterar cliente.');
    } finally {
      setSavingAction(false);
    }
  };

  // Handlers de Produtos e Categorias
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAction(true);
    try {
      const saved = await saveProduct({
        id: editingProductId,
        nome: prodFormNome,
        codigo: prodFormCodigo,
        categoriaId: prodFormCategoriaId || (categories[0]?.id ?? 0),
        unidadeMedida: prodFormUnidade,
        preco: parseFloat(prodFormPreco) || 0,
        descricao: prodFormDesc,
        ativo: prodFormAtivo,
      });

      setProducts((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        const next = exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
        return next.sort((a, b) => a.nome.localeCompare(b.nome));
      });

      showFlash(
        'success',
        editingProductId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.'
      );
      setEditingProductId(null);
      setProdFormNome('');
      setProdFormCodigo('');
      setProdFormUnidade('un');
      setProdFormPreco('0.00');
      setProdFormDesc('');
      setProdFormAtivo(true);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleToggleOrDeleteProduct = async (prodId: number) => {
    setSavingAction(true);
    try {
      const outcome = await toggleOrDeleteProduct(prodId);
      if (outcome === 'deleted') {
        setProducts((prev) => prev.filter((p) => p.id !== prodId));
        showFlash('success', 'Produto excluído com sucesso.');
      } else {
        setProducts((prev) => prev.map((p) => (p.id === prodId ? { ...p, ativo: !p.ativo } : p)));
        showFlash('info', 'Item usado em pedidos; situação alternada entre ativo/inativo.');
      }
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao alterar produto.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingAction(true);
    try {
      const created = await createCategory(newCategoryName);
      setCategories((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
      setProdFormCategoriaId((prev) => prev || created.id);
      setNewCategoryName('');
      showFlash('success', `Categoria "${created.nome}" adicionada.`);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao criar categoria.');
    } finally {
      setSavingAction(false);
    }
  };

  // Exportação CSV
  const handleExportCSV = (tipo: 'pedidos' | 'produtos' | 'clientes') => {
    const rows: string[][] = [];
    if (tipo === 'pedidos') {
      rows.push([
        'Número',
        'Data Cadastro',
        'Previsão Entrega',
        'Cliente',
        'Telefone',
        'Subtotal',
        'Desconto',
        'Valor Total',
        'Status',
      ]);
      reportData.orders.forEach((o) => {
        const c = clientById.get(o.clienteId);
        rows.push([
          o.numero,
          formatDateTimeBR(o.dataCadastro),
          formatDateBR(o.dataPrevisao),
          c?.nome || '',
          c?.telefone || '',
          o.subtotal.toFixed(2).replace('.', ','),
          o.desconto.toFixed(2).replace('.', ','),
          o.valorTotal.toFixed(2).replace('.', ','),
          STATUS_META[o.status].label,
        ]);
      });
    } else if (tipo === 'produtos') {
      rows.push(['Produto / Serviço', 'Quantidade Total', 'Qtd. Pedidos', 'Valor Total (R$)']);
      reportData.topProdutos.forEach((p) => {
        rows.push([p.nome, String(p.qtd), String(p.pedidos), p.valor.toFixed(2).replace('.', ',')]);
      });
    } else {
      rows.push(['Cliente', 'Telefone', 'Qtd. Pedidos', 'Total Compras (R$)']);
      reportData.topClientes.forEach((c) => {
        rows.push([c.nome, c.tel, String(c.pedidos), c.total.toFixed(2).replace('.', ',')]);
      });
    }

    const csvContent =
      '\uFEFF' +
      rows
        .map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const urlObj = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = urlObj;
    const periodSuffix =
      reportStart || reportEnd
        ? `${reportStart || 'inicio'}_a_${reportEnd || 'hoje'}`
        : 'todo_periodo';
    link.download = `papelaria_x_${tipo}_${periodSuffix}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(urlObj);
  };

  // Salvar Configurações no Supabase
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAction(true);
    try {
      await saveConfig(config);
      showFlash('success', 'Configurações e modelos de WhatsApp salvos no banco de dados.');
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    } finally {
      setSavingAction(false);
    }
  };

  // Tela de carregamento inicial da sessão
  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span>Verificando sessão...</span>
        </div>
      </div>
    );
  }

  // Tela de Login / Primeiro Cadastro (Supabase Auth)
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-base font-bold text-white">
              PX
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Papelaria X</h1>
              <p className="text-xs text-slate-500">Sistema Administrativo de Pedidos</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setLoginError('');
              }}
              className={`rounded py-1.5 ${
                authMode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setLoginError('');
                setLoginSuccess('');
              }}
              className={`rounded py-1.5 ${
                authMode === 'signup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Criar conta
            </button>
          </div>

          {loginError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {loginError}
            </div>
          )}

          {loginSuccess && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {loginSuccess}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            {authMode === 'signup' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={loginConfirmPassword}
                  onChange={(e) => setLoginConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting || !isSupabaseConfigured}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {authSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {authMode === 'login' ? 'Entrar no Sistema' : 'Criar Conta e Entrar'}
              </span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navGroups: Array<{
    group: string;
    items: Array<{ id: SectionId; label: string; icon: React.ReactNode }>;
  }> = [
    {
      group: 'Operação',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4 shrink-0" /> },
        { id: 'pedidos', label: 'Pedidos', icon: <FileText className="h-4 w-4 shrink-0" /> },
        { id: 'novo_pedido', label: 'Novo pedido', icon: <PlusCircle className="h-4 w-4 shrink-0" /> },
      ],
    },
    {
      group: 'Cadastros e Análise',
      items: [
        { id: 'clientes', label: 'Clientes', icon: <Users className="h-4 w-4 shrink-0" /> },
        { id: 'produtos', label: 'Produtos', icon: <Package className="h-4 w-4 shrink-0" /> },
        { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 className="h-4 w-4 shrink-0" /> },
      ],
    },
    {
      group: 'Sistema',
      items: [
        { id: 'configuracoes', label: 'Configurações', icon: <Settings className="h-4 w-4 shrink-0" /> },
      ],
    },
  ];

  const navItems = navGroups.flatMap((g) => g.items);

  const activeOrder = orders.find((o) => o.id === selectedOrderId) ?? orders[0] ?? null;
  const activeOrderClient = activeOrder ? clientById.get(activeOrder.clienteId) ?? null : null;

  const pageTitles: Record<SectionId, string> = {
    dashboard: 'Dashboard',
    pedidos: 'Pedidos',
    novo_pedido: 'Novo Pedido',
    visualizar_pedido: `Pedido #${activeOrder?.numero ?? ''}`,
    editar_pedido: `Editar Pedido #${activeOrder?.numero ?? ''}`,
    clientes: 'Clientes',
    visualizar_cliente: `Cliente: ${clients.find((c) => c.id === selectedClientId)?.nome ?? ''}`,
    produtos: 'Produtos e Serviços',
    relatorios: 'Relatórios',
    configuracoes: 'Configurações',
  };

  const waOrder = waOrderId !== null ? orders.find((o) => o.id === waOrderId) ?? null : null;
  const waClient = waOrder ? clientById.get(waOrder.clienteId) ?? null : null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Desktop Recolhível */}
      <aside
        className={`no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-slate-900 text-slate-200 transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? 'w-[74px]' : 'w-64'
        }`}
      >
        <div
          className={`flex items-center border-b border-white/10 py-4 ${
            sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            title={config.nomeEmpresa}
            className="flex items-center gap-3 text-left text-white overflow-hidden"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              PX
            </span>
            {!sidebarCollapsed && (
              <span className="font-display truncate text-base font-bold tracking-tight whitespace-nowrap">
                {config.nomeEmpresa}
              </span>
            )}
          </button>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="Recolher menu"
              aria-label="Recolher menu"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="flex justify-center border-b border-white/10 py-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expandir menu"
              aria-label="Expandir menu"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-[11px] font-semibold text-slate-400">
                  {group.group}
                </div>
              )}
              {group.items.map((item) => {
                const isActive =
                  section === item.id ||
                  (item.id === 'pedidos' &&
                    (section === 'visualizar_pedido' || section === 'editar_pedido')) ||
                  (item.id === 'clientes' && section === 'visualizar_cliente');
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() =>
                      item.id === 'novo_pedido' ? prepareNewOrderForm() : navigate(item.id)
                    }
                    className={`flex w-full items-center rounded-md py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                    } ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          {!sidebarCollapsed && (
            <div className="mb-2 rounded-md bg-white/5 px-3 py-2">
              <div className="truncate text-sm font-semibold text-white">
                {userProfile?.nome || session.user.email}
              </div>
              <div className="text-xs text-slate-400">
                {userProfile?.perfil === 'admin' ? 'Administrador' : 'Atendente'}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Sair' : undefined}
            className={`flex w-full items-center rounded-md py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200 ${
              sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 flex w-64 flex-col bg-slate-900 text-slate-200">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2.5 text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
                  PX
                </span>
                <span className="font-display font-bold">{config.nomeEmpresa}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.id === 'novo_pedido' ? prepareNewOrderForm() : navigate(item.id))}
                  className={`flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium ${
                    section === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/15"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-lg font-bold text-slate-900 truncate">
              {pageTitles[section]}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={prepareNewOrderForm}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Pedido</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {dataError && (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div>
                <strong>Erro ao carregar os dados:</strong> {dataError}
              </div>
              <button
                type="button"
                onClick={() => loadAllData(session)}
                className="rounded border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {flashMessage && (
            <div
              className={`no-print mb-4 flex items-center justify-between rounded-md border px-4 py-2.5 text-sm ${
                flashMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : flashMessage.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              <span>{flashMessage.text}</span>
              <button
                type="button"
                onClick={() => setFlashMessage(null)}
                className="ml-3 text-current opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loadingData && orders.length === 0 && clients.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-sm text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
              <span>Carregando dados...</span>
            </div>
          ) : (
            <>
              {/* ==================== DASHBOARD ==================== */}
              {section === 'dashboard' && (
                <DashboardView
                  analytics={dashboardAnalytics}
                  periodKey={dashboardPeriod}
                  onPeriodChange={setDashboardPeriod}
                  clientById={clientById}
                  onNewOrder={prepareNewOrderForm}
                  onOpenOrders={(statusFilter) => {
                    setFilterStatus(statusFilter ?? '');
                    navigate('pedidos');
                  }}
                  onOpenOrder={handleOpenOrder}
                  onOpenClients={() => {
                    setEditingClientId(null);
                    navigate('clientes');
                  }}
                  onOpenClient={(cliId) => {
                    setSelectedClientId(cliId);
                    navigate('visualizar_cliente');
                  }}
                  onOpenProducts={() => {
                    setEditingProductId(null);
                    navigate('produtos');
                  }}
                  onOpenReports={() => navigate('relatorios')}
                />
              )}

              {/* ==================== PEDIDOS ==================== */}
              {section === 'pedidos' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Nº do pedido
                        </label>
                        <input
                          type="text"
                          value={filterNumero}
                          onChange={(e) => setFilterNumero(e.target.value)}
                          placeholder="000001"
                          className="font-mono-num w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Cliente
                        </label>
                        <input
                          type="text"
                          value={filterCliente}
                          onChange={(e) => setFilterCliente(e.target.value)}
                          placeholder="Nome..."
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Telefone
                        </label>
                        <input
                          type="text"
                          value={filterTelefone}
                          onChange={(e) => setFilterTelefone(e.target.value)}
                          placeholder="(11) 99999"
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Status
                        </label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                        >
                          <option value="">Todos</option>
                          {(Object.keys(STATUS_META) as OrderStatus[]).map((k) => (
                            <option key={k} value={k}>
                              {STATUS_META[k].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Data inicial
                        </label>
                        <input
                          type="date"
                          value={filterDataInicio}
                          onChange={(e) => setFilterDataInicio(e.target.value)}
                          className="font-mono-num w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Data final
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={filterDataFim}
                            onChange={(e) => setFilterDataFim(e.target.value)}
                            className="font-mono-num w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setFilterNumero('');
                              setFilterCliente('');
                              setFilterTelefone('');
                              setFilterStatus('');
                              setFilterDataInicio('');
                              setFilterDataFim('');
                            }}
                            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                      <h2 className="text-sm font-bold text-slate-900">
                        Pedidos encontrados ({filteredOrders.length})
                      </h2>
                      <button
                        type="button"
                        onClick={prepareNewOrderForm}
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Novo pedido</span>
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <tr>
                            <th className="px-4 py-3">Nº Pedido</th>
                            <th className="px-4 py-3">Cliente</th>
                            <th className="px-4 py-3">Telefone</th>
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Previsão</th>
                            <th className="px-4 py-3 text-right">Valor total</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                                Nenhum pedido encontrado com os filtros aplicados.
                              </td>
                            </tr>
                          ) : (
                            filteredOrders.map((o) => {
                              const cli = clientById.get(o.clienteId);
                              return (
                                <tr key={o.id} className="hover:bg-slate-50/70">
                                  <td className="font-mono-num px-4 py-3 font-semibold text-slate-900">
                                    #{o.numero}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900">
                                      {cli?.nome || '-'}
                                    </div>
                                    {cli?.empresa && (
                                      <div className="text-xs text-slate-500">{cli.empresa}</div>
                                    )}
                                  </td>
                                  <td className="font-mono-num px-4 py-3 text-xs text-slate-600">
                                    {cli?.telefone || '-'}
                                  </td>
                                  <td className="font-mono-num px-4 py-3 text-xs text-slate-600">
                                    {formatDateBR(o.dataCadastro)}
                                  </td>
                                  <td className="font-mono-num px-4 py-3 text-xs text-slate-600">
                                    {formatDateBR(o.dataPrevisao)}
                                  </td>
                                  <td className="font-mono-num px-4 py-3 text-right font-semibold text-slate-900">
                                    {formatBRL(o.valorTotal)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_META[o.status].badgeClass}`}
                                    >
                                      {STATUS_META[o.status].label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenOrder(o.id)}
                                      className="mr-1 inline-flex items-center rounded border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100"
                                      title="Visualizar / Alterar status"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditOrder(o)}
                                      className="mr-1 inline-flex items-center rounded border border-blue-300 p-1.5 text-blue-700 hover:bg-blue-50"
                                      title="Editar pedido"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleOpenOrder(o.id);
                                        setTimeout(() => window.print(), 150);
                                      }}
                                      className="mr-1 inline-flex items-center rounded border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100"
                                      title="Imprimir"
                                    >
                                      <Printer className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setWaOrderId(o.id)}
                                      className="inline-flex items-center rounded border border-emerald-300 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                                      title="Enviar WhatsApp"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== NOVO PEDIDO / EDITAR PEDIDO ==================== */}
              {(section === 'novo_pedido' || section === 'editar_pedido') && (
                <form
                  onSubmit={
                    section === 'novo_pedido' ? handleSaveNewOrder : handleSaveEditedOrder
                  }
                  className="grid grid-cols-1 gap-6 xl:grid-cols-3"
                >
                  <div className="space-y-6 xl:col-span-2">
                    {/* Cliente */}
                    <div className="rounded-lg border border-slate-200 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
                        <h2 className="text-sm font-bold text-slate-900">
                          1. Informações do cliente
                        </h2>
                        {section === 'novo_pedido' && (
                          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => setClientMode('existente')}
                              className={`rounded px-3 py-1 ${
                                clientMode === 'existente'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              Cliente cadastrado
                            </button>
                            <button
                              type="button"
                              onClick={() => setClientMode('novo')}
                              className={`rounded px-3 py-1 ${
                                clientMode === 'novo'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              Novo cliente
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        {section === 'editar_pedido' || clientMode === 'existente' ? (
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                              Selecione o cliente
                            </label>
                            <select
                              value={orderClientId}
                              onChange={(e) => setOrderClientId(Number(e.target.value))}
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value={0}>-- Escolha um cliente --</option>
                              {clients
                                .filter((c) => c.ativo || c.id === orderClientId)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nome} — {c.telefone}
                                    {c.empresa ? ` (${c.empresa})` : ''}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-700">
                                Nome completo *
                              </label>
                              <input
                                type="text"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                                placeholder="Ex: João Pedro Santos"
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-700">
                                Telefone / WhatsApp *
                              </label>
                              <input
                                type="text"
                                value={newClientPhone}
                                onChange={(e) => setNewClientPhone(e.target.value)}
                                placeholder="(11) 99999-9999"
                                className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-700">
                                Empresa (opcional)
                              </label>
                              <input
                                type="text"
                                value={newClientCompany}
                                onChange={(e) => setNewClientCompany(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-700">
                                Observações sobre o cliente
                              </label>
                              <input
                                type="text"
                                value={newClientObs}
                                onChange={(e) => setNewClientObs(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Itens do Pedido */}
                    <div className="rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                        <h2 className="text-sm font-bold text-slate-900">
                          2. Produtos e serviços solicitados
                        </h2>
                        <button
                          type="button"
                          onClick={handleAddManualItem}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Item avulso</span>
                        </button>
                      </div>
                      <div className="p-5">
                        <div className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row">
                          <select
                            value={catalogSelectedId}
                            onChange={(e) => setCatalogSelectedId(e.target.value)}
                            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="">
                              -- Selecione um produto ou serviço do catálogo --
                            </option>
                            {products
                              .filter((p) => p.ativo)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.codigo}] {p.nome} — {formatBRL(p.preco)} / {p.unidadeMedida}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAddCatalogItem}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                          >
                            Adicionar ao pedido
                          </button>
                        </div>

                        {draftItems.length === 0 ? (
                          <div className="py-8 text-center text-sm text-slate-500">
                            Nenhum item adicionado. Selecione um produto do catálogo acima ou clique em "Item avulso".
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                                <tr>
                                  <th className="pb-2">Produto / Serviço</th>
                                  <th className="w-20 pb-2">Unid.</th>
                                  <th className="w-32 pb-2 text-center">Qtd.</th>
                                  <th className="w-28 pb-2 text-right">Valor Unit.</th>
                                  <th className="w-28 pb-2 text-right">Subtotal</th>
                                  <th className="w-10 pb-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {draftItems.map((it) => {
                                  const fractional = isFractionalUnit(it.unidadeMedida);
                                  const itemSubtotal = calculateItemSubtotal(
                                    it.quantidade,
                                    it.valorUnitario
                                  );

                                  return (
                                    <tr key={it.tempId}>
                                      <td className="py-2 pr-2">
                                        <input
                                          type="text"
                                          required
                                          value={it.descricaoItem}
                                          onChange={(e) =>
                                            setDraftItems((prev) =>
                                              prev.map((row) =>
                                                row.tempId === it.tempId
                                                  ? { ...row, descricaoItem: e.target.value }
                                                  : row
                                              )
                                            )
                                          }
                                          placeholder="Descrição do item"
                                          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                                        />
                                      </td>
                                      <td className="py-2 pr-2">
                                        <input
                                          type="text"
                                          value={it.unidadeMedida}
                                          onChange={(e) => {
                                            const nextUnit = e.target.value;
                                            setDraftItems((prev) =>
                                              prev.map((row) =>
                                                row.tempId === it.tempId
                                                  ? {
                                                      ...row,
                                                      unidadeMedida: nextUnit,
                                                      quantidade:
                                                        row.quantidade > 0
                                                          ? normalizeQuantity(
                                                              row.quantidade,
                                                              nextUnit
                                                            )
                                                          : 1,
                                                    }
                                                  : row
                                              )
                                            );
                                          }}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                        />
                                      </td>
                                      <td className="py-2 pr-2">
                                        <div className="inline-flex w-full items-center justify-center rounded border border-slate-300 bg-white">
                                          <button
                                            type="button"
                                            aria-label="Diminuir 1 unidade"
                                            onClick={() =>
                                              setDraftItems((prev) =>
                                                prev.map((row) =>
                                                  row.tempId === it.tempId
                                                    ? {
                                                        ...row,
                                                        quantidade: stepQuantity(
                                                          row.quantidade,
                                                          -1,
                                                          row.unidadeMedida
                                                        ),
                                                      }
                                                    : row
                                                )
                                              )
                                            }
                                            className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                          >
                                            <Minus className="h-3.5 w-3.5" />
                                          </button>
                                          <input
                                            type="number"
                                            step={fractional ? '0.01' : '1'}
                                            min={fractional ? '0.01' : '1'}
                                            value={it.quantidade === 0 ? '' : it.quantidade}
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              setDraftItems((prev) =>
                                                prev.map((row) => {
                                                  if (row.tempId !== it.tempId) return row;
                                                  if (raw === '') {
                                                    return { ...row, quantidade: 0 };
                                                  }
                                                  if (isFractionalUnit(row.unidadeMedida)) {
                                                    const parsed = parseFloat(
                                                      raw.replace(',', '.')
                                                    );
                                                    return {
                                                      ...row,
                                                      quantidade: Number.isNaN(parsed)
                                                        ? 0
                                                        : Math.max(0, roundCurrency(parsed)),
                                                    };
                                                  }
                                                  const parsedInt = parseInt(
                                                    raw.replace(/[^\d]/g, ''),
                                                    10
                                                  );
                                                  return {
                                                    ...row,
                                                    quantidade: Number.isNaN(parsedInt)
                                                      ? 0
                                                      : parsedInt,
                                                  };
                                                })
                                              );
                                            }}
                                            onBlur={() =>
                                              setDraftItems((prev) =>
                                                prev.map((row) => {
                                                  if (row.tempId !== it.tempId) return row;
                                                  const minVal = isFractionalUnit(row.unidadeMedida)
                                                    ? 0.01
                                                    : 1;
                                                  return {
                                                    ...row,
                                                    quantidade:
                                                      row.quantidade > 0
                                                        ? normalizeQuantity(
                                                            row.quantidade,
                                                            row.unidadeMedida
                                                          )
                                                        : minVal,
                                                  };
                                                })
                                              )
                                            }
                                            className="font-mono-num w-16 border-x border-slate-200 px-1.5 py-1.5 text-center text-sm focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            aria-label="Adicionar 1 unidade"
                                            onClick={() =>
                                              setDraftItems((prev) =>
                                                prev.map((row) =>
                                                  row.tempId === it.tempId
                                                    ? {
                                                        ...row,
                                                        quantidade: stepQuantity(
                                                          row.quantidade,
                                                          1,
                                                          row.unidadeMedida
                                                        ),
                                                      }
                                                    : row
                                                )
                                              )
                                            }
                                            className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                          >
                                            <Plus className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                      <td className="py-2 pr-2">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={it.valorUnitario}
                                          onChange={(e) =>
                                            setDraftItems((prev) =>
                                              prev.map((row) =>
                                                row.tempId === it.tempId
                                                  ? {
                                                      ...row,
                                                      valorUnitario: roundCurrency(
                                                        Math.max(0, parseFloat(e.target.value) || 0)
                                                      ),
                                                    }
                                                  : row
                                              )
                                            )
                                          }
                                          className="font-mono-num w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm"
                                        />
                                      </td>
                                      <td className="font-mono-num py-2 text-right font-semibold text-slate-900">
                                        {formatBRL(itemSubtotal)}
                                      </td>
                                      <td className="py-2 text-right">
                                        <button
                                          type="button"
                                          aria-label="Remover item do pedido"
                                          onClick={() =>
                                            setDraftItems((prev) =>
                                              prev.filter((row) => row.tempId !== it.tempId)
                                            )
                                          }
                                          className="rounded p-1 text-red-600 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resumo lateral */}
                  <div className="h-fit rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 py-3.5">
                      <h2 className="text-sm font-bold text-slate-900">3. Resumo e entrega</h2>
                    </div>
                    <div className="space-y-4 p-5">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          Número do pedido (automático)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`#${
                            section === 'editar_pedido' && activeOrder
                              ? activeOrder.numero
                              : nextOrderNumberPreview
                          }`}
                          className="font-mono-num w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
                        />
                      </div>

                      {section === 'editar_pedido' && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Status
                          </label>
                          <select
                            value={orderEditStatus}
                            onChange={(e) => setOrderEditStatus(e.target.value as OrderStatus)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            {(Object.keys(STATUS_META) as OrderStatus[]).map((k) => (
                              <option key={k} value={k}>
                                {STATUS_META[k].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Previsão de entrega
                        </label>
                        <input
                          type="date"
                          value={orderPrevisao}
                          onChange={(e) => setOrderPrevisao(e.target.value)}
                          className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Observações gerais
                        </label>
                        <textarea
                          rows={3}
                          value={orderObs}
                          onChange={(e) => setOrderObs(e.target.value)}
                          placeholder="Detalhes de acabamento, retirada..."
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-3 border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Subtotal</span>
                          <span className="font-mono-num font-semibold text-slate-900">
                            {formatBRL(draftSubtotal)}
                          </span>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Desconto (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={orderDesconto}
                            onChange={(e) => setOrderDesconto(e.target.value)}
                            className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-1.5 text-right text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="font-bold text-slate-900">Valor Total</span>
                          <span className="font-mono-num text-xl font-bold text-blue-700">
                            {formatBRL(draftTotal)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingAction}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingAction && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>
                          {section === 'editar_pedido' ? 'Salvar Alterações' : 'Salvar Pedido'}
                        </span>
                      </button>

                      {section === 'editar_pedido' && activeOrder && (
                        <button
                          type="button"
                          onClick={() => handleOpenOrder(activeOrder.id)}
                          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Cancelar edição
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}

              {/* ==================== VISUALIZAR PEDIDO ==================== */}
              {section === 'visualizar_pedido' && activeOrder && (
                <div className="space-y-4">
                  <div className="no-print flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('pedidos')}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Voltar aos Pedidos
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditOrder(activeOrder)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Editar Pedido</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Imprimir Pedido</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaOrderId(activeOrder.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Enviar WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white lg:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-4">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">
                            {config.nomeEmpresa} — Pedido #{activeOrder.numero}
                          </h2>
                          <p className="text-xs text-slate-500">
                            Registrado em {formatDateTimeBR(activeOrder.dataCadastro)} · Previsão de
                            entrega: {formatDateBR(activeOrder.dataPrevisao)}
                          </p>
                        </div>
                        <span
                          className={`inline-block rounded border px-2.5 py-1 text-xs font-semibold ${STATUS_META[activeOrder.status].badgeClass}`}
                        >
                          {STATUS_META[activeOrder.status].label}
                        </span>
                      </div>

                      <div className="p-6">
                        <div className="mb-5 grid grid-cols-1 gap-4 border-b border-slate-200 pb-4 sm:grid-cols-3">
                          <div>
                            <div className="text-xs text-slate-500">Cliente</div>
                            <div className="font-semibold text-slate-900">
                              {activeOrderClient?.nome || '-'}
                            </div>
                            {activeOrderClient?.empresa && (
                              <div className="text-xs text-slate-500">
                                {activeOrderClient.empresa}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Telefone / WhatsApp</div>
                            <div className="font-mono-num text-sm font-medium text-slate-800">
                              {activeOrderClient?.telefone || '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Previsão de entrega</div>
                            <div className="font-mono-num text-sm font-medium text-slate-800">
                              {formatDateBR(activeOrder.dataPrevisao)}
                            </div>
                          </div>
                        </div>

                        <table className="mb-5 w-full text-left text-sm">
                          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <tr>
                              <th className="px-3 py-2.5">Produto / Serviço</th>
                              <th className="px-3 py-2.5 text-center">Unid.</th>
                              <th className="px-3 py-2.5 text-right">Qtd.</th>
                              <th className="px-3 py-2.5 text-right">Valor Unit.</th>
                              <th className="px-3 py-2.5 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeOrder.itens.map((it) => (
                              <tr key={it.id}>
                                <td className="px-3 py-2.5 font-medium text-slate-900">
                                  {it.descricaoItem}
                                </td>
                                <td className="px-3 py-2.5 text-center text-xs text-slate-500">
                                  {it.unidadeMedida}
                                </td>
                                <td className="font-mono-num px-3 py-2.5 text-right">
                                  {it.quantidade}
                                </td>
                                <td className="font-mono-num px-3 py-2.5 text-right">
                                  {formatBRL(it.valorUnitario)}
                                </td>
                                <td className="font-mono-num px-3 py-2.5 text-right font-semibold text-slate-900">
                                  {formatBRL(it.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Subtotal</span>
                            <span className="font-mono-num">{formatBRL(activeOrder.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Desconto</span>
                            <span className="font-mono-num text-red-600">
                              - {formatBRL(activeOrder.desconto)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
                            <span>Total</span>
                            <span className="font-mono-num text-blue-700">
                              {formatBRL(activeOrder.valorTotal)}
                            </span>
                          </div>
                        </div>

                        {activeOrder.observacoes && (
                          <div className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-600">
                            <strong className="block text-slate-800">Observações:</strong>
                            {activeOrder.observacoes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status & Histórico & Excluir */}
                    <div className="no-print space-y-4">
                      <form
                        onSubmit={handleUpdateOrderStatus}
                        className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
                      >
                        <h3 className="text-sm font-bold text-slate-900">Atualizar status</h3>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Situação atual
                          </label>
                          <select
                            value={statusToUpdate}
                            onChange={(e) => setStatusToUpdate(e.target.value as OrderStatus)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            {(Object.keys(STATUS_META) as OrderStatus[]).map((k) => (
                              <option key={k} value={k}>
                                {STATUS_META[k].label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Observação (opcional)
                          </label>
                          <input
                            type="text"
                            value={statusObs}
                            onChange={(e) => setStatusObs(e.target.value)}
                            placeholder="Ex: Impressão finalizada"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={savingAction}
                          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          Salvar Novo Status
                        </button>
                      </form>

                      <div className="rounded-lg border border-slate-200 bg-white p-5">
                        <h3 className="mb-3 text-sm font-bold text-slate-900">
                          Histórico de alterações
                        </h3>
                        <div className="divide-y divide-slate-100">
                          {activeOrder.historico.map((h) => (
                            <div key={h.id} className="py-2.5 first:pt-0 last:pb-0">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span
                                  className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[h.statusNovo].badgeClass}`}
                                >
                                  {STATUS_META[h.statusNovo].label}
                                </span>
                                <span className="font-mono-num text-[11px] text-slate-500">
                                  {formatDateTimeBR(h.criadoEm)}
                                </span>
                              </div>
                              {h.observacao && (
                                <p className="text-xs text-slate-700">{h.observacao}</p>
                              )}
                              <p className="text-[11px] text-slate-500">Por: {h.usuarioNome}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                        <span className="text-xs text-slate-500">
                          Remover pedido permanentemente
                        </span>
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() => handleDeleteOrder(activeOrder.id)}
                          className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== CLIENTES ==================== */}
              {section === 'clientes' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <form
                    onSubmit={handleSaveClient}
                    className="h-fit rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                      <h2 className="text-sm font-bold text-slate-900">
                        {editingClientId ? 'Editar cliente' : 'Novo cliente'}
                      </h2>
                      {editingClientId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClientId(null);
                            setCliFormNome('');
                            setCliFormTel('');
                            setCliFormEmpresa('');
                            setCliFormObs('');
                            setCliFormAtivo(true);
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                    <div className="space-y-3 p-5">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Nome completo *
                        </label>
                        <input
                          type="text"
                          required
                          value={cliFormNome}
                          onChange={(e) => setCliFormNome(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          required
                          value={cliFormTel}
                          onChange={(e) => setCliFormTel(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Evita duplicidade automaticamente pelo número.
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Empresa
                        </label>
                        <input
                          type="text"
                          value={cliFormEmpresa}
                          onChange={(e) => setCliFormEmpresa(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Observações
                        </label>
                        <textarea
                          rows={2}
                          value={cliFormObs}
                          onChange={(e) => setCliFormObs(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={cliFormAtivo}
                          onChange={(e) => setCliFormAtivo(e.target.checked)}
                        />
                        <span>Cliente ativo</span>
                      </label>
                      <button
                        type="submit"
                        disabled={savingAction}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {editingClientId ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
                      </button>
                    </div>
                  </form>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          placeholder="Pesquisar por nome, empresa ou telefone..."
                          className="w-full rounded-md border border-slate-300 py-1.5 pl-9 pr-3 text-sm"
                        />
                      </div>
                      <select
                        value={clientStatusFilter}
                        onChange={(e) =>
                          setClientStatusFilter(e.target.value as 'ativos' | 'inativos' | 'todos')
                        }
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                      >
                        <option value="ativos">Ativos</option>
                        <option value="inativos">Inativos</option>
                        <option value="todos">Todos</option>
                      </select>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-5 py-3.5">
                        <h2 className="text-sm font-bold text-slate-900">
                          Clientes cadastrados ({filteredClients.length})
                        </h2>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <tr>
                              <th className="px-4 py-3">Cliente</th>
                              <th className="px-4 py-3">Telefone</th>
                              <th className="px-4 py-3 text-center">Pedidos</th>
                              <th className="px-4 py-3 text-right">Total compras</th>
                              <th className="px-4 py-3">Situação</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredClients.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                  Nenhum cliente encontrado.
                                </td>
                              </tr>
                            ) : (
                              filteredClients.map((cli) => {
                                const cliOrders = orders.filter((o) => o.clienteId === cli.id);
                                const totalSpent = cliOrders
                                  .filter((o) => o.status !== 'cancelado')
                                  .reduce((s, o) => s + o.valorTotal, 0);
                                return (
                                  <tr key={cli.id} className="hover:bg-slate-50/70">
                                    <td className="px-4 py-3">
                                      <div className="font-medium text-slate-900">{cli.nome}</div>
                                      {cli.empresa && (
                                        <div className="text-xs text-slate-500">{cli.empresa}</div>
                                      )}
                                    </td>
                                    <td className="font-mono-num px-4 py-3 text-xs">
                                      <a
                                        href={`https://wa.me/${waPhone(cli.telefone)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-700 hover:underline"
                                      >
                                        {cli.telefone}
                                      </a>
                                    </td>
                                    <td className="font-mono-num px-4 py-3 text-center">
                                      {cliOrders.length}
                                    </td>
                                    <td className="font-mono-num px-4 py-3 text-right font-semibold">
                                      {formatBRL(totalSpent)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${
                                          cli.ativo
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                            : 'border-red-200 bg-red-50 text-red-800'
                                        }`}
                                      >
                                        {cli.ativo ? 'Ativo' : 'Inativo'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedClientId(cli.id);
                                          navigate('visualizar_cliente');
                                        }}
                                        className="mr-1 inline-flex items-center rounded border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100"
                                        title="Histórico de pedidos"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditClient(cli)}
                                        className="mr-1 inline-flex items-center rounded border border-blue-300 p-1.5 text-blue-700 hover:bg-blue-50"
                                        title="Editar"
                                      >
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleOrDeleteClient(cli.id)}
                                        className="inline-flex items-center rounded border border-red-300 p-1.5 text-red-700 hover:bg-red-50"
                                        title="Desativar / Excluir"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== VISUALIZAR CLIENTE ==================== */}
              {section === 'visualizar_cliente' &&
                (() => {
                  const cli = selectedClientId ? clientById.get(selectedClientId) : null;
                  if (!cli) return null;
                  const cliOrders = orders.filter((o) => o.clienteId === cli.id);
                  const totalSpent = cliOrders
                    .filter((o) => o.status !== 'cancelado')
                    .reduce((s, o) => s + o.valorTotal, 0);
                  return (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => navigate('clientes')}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Voltar aos Clientes
                      </button>
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="h-fit space-y-3 rounded-lg border border-slate-200 bg-white p-5">
                          <h2 className="text-sm font-bold text-slate-900">Dados cadastrais</h2>
                          <div>
                            <div className="text-xs text-slate-500">Nome</div>
                            <div className="font-semibold text-slate-900">{cli.nome}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Telefone / WhatsApp</div>
                            <div className="font-mono-num text-sm text-emerald-700">
                              {cli.telefone}
                            </div>
                          </div>
                          {cli.empresa && (
                            <div>
                              <div className="text-xs text-slate-500">Empresa</div>
                              <div className="text-sm">{cli.empresa}</div>
                            </div>
                          )}
                          {cli.observacoes && (
                            <div>
                              <div className="text-xs text-slate-500">Observações</div>
                              <div className="text-xs text-slate-700">{cli.observacoes}</div>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
                            <span className="text-slate-600">Total em compras</span>
                            <span className="font-mono-num font-bold text-blue-700">
                              {formatBRL(totalSpent)}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white lg:col-span-2">
                          <div className="border-b border-slate-200 px-5 py-3.5">
                            <h2 className="text-sm font-bold text-slate-900">
                              Histórico de pedidos ({cliOrders.length})
                            </h2>
                          </div>
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                              <tr>
                                <th className="px-4 py-3">Nº Pedido</th>
                                <th className="px-4 py-3">Data</th>
                                <th className="px-4 py-3 text-right">Valor</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {cliOrders.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-4 py-8 text-center text-slate-500"
                                  >
                                    Este cliente ainda não possui pedidos.
                                  </td>
                                </tr>
                              ) : (
                                cliOrders.map((o) => (
                                  <tr key={o.id}>
                                    <td className="font-mono-num px-4 py-3 font-semibold">
                                      #{o.numero}
                                    </td>
                                    <td className="font-mono-num px-4 py-3 text-xs">
                                      {formatDateBR(o.dataCadastro)}
                                    </td>
                                    <td className="font-mono-num px-4 py-3 text-right font-semibold">
                                      {formatBRL(o.valorTotal)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_META[o.status].badgeClass}`}
                                      >
                                        {STATUS_META[o.status].label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenOrder(o.id)}
                                        className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                      >
                                        Visualizar
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* ==================== PRODUTOS ==================== */}
              {section === 'produtos' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-4">
                    <form
                      onSubmit={handleSaveProduct}
                      className="rounded-lg border border-slate-200 bg-white"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                        <h2 className="text-sm font-bold text-slate-900">
                          {editingProductId ? 'Editar produto' : 'Novo produto / serviço'}
                        </h2>
                        {editingProductId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProductId(null);
                              setProdFormNome('');
                              setProdFormCodigo('');
                              setProdFormPreco('0.00');
                              setProdFormDesc('');
                            }}
                            className="text-xs font-medium text-slate-600"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                      <div className="space-y-3 p-5">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">
                            Nome *
                          </label>
                          <input
                            type="text"
                            required
                            value={prodFormNome}
                            onChange={(e) => setProdFormNome(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              Código *
                            </label>
                            <input
                              type="text"
                              required
                              value={prodFormCodigo}
                              onChange={(e) => setProdFormCodigo(e.target.value)}
                              placeholder="IMP-A4"
                              className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              Unidade *
                            </label>
                            <input
                              type="text"
                              required
                              value={prodFormUnidade}
                              onChange={(e) => setProdFormUnidade(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              Categoria
                            </label>
                            <select
                              value={prodFormCategoriaId}
                              onChange={(e) => setProdFormCategoriaId(Number(e.target.value))}
                              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
                            >
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              Preço (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={prodFormPreco}
                              onChange={(e) => setProdFormPreco(e.target.value)}
                              className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-right text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">
                            Descrição
                          </label>
                          <textarea
                            rows={2}
                            value={prodFormDesc}
                            onChange={(e) => setProdFormDesc(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={prodFormAtivo}
                            onChange={(e) => setProdFormAtivo(e.target.checked)}
                          />
                          <span>Item ativo para pedidos</span>
                        </label>
                        <button
                          type="submit"
                          disabled={savingAction}
                          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {editingProductId ? 'Atualizar Produto' : 'Cadastrar Produto'}
                        </button>
                      </div>
                    </form>

                    <form
                      onSubmit={handleAddCategory}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <label className="mb-2 block text-xs font-bold text-slate-900">
                        Nova categoria
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nome da categoria"
                          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={savingAction}
                          className="rounded-md border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Adicionar
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Pesquisar produto ou código..."
                        className="min-w-[180px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                      <select
                        value={productCategoryFilter}
                        onChange={(e) => setProductCategoryFilter(e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                      >
                        <option value="">Todas categorias</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.nome}>
                            {cat.nome}
                          </option>
                        ))}
                      </select>
                      <select
                        value={productStatusFilter}
                        onChange={(e) =>
                          setProductStatusFilter(e.target.value as 'ativos' | 'inativos' | 'todos')
                        }
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                      >
                        <option value="ativos">Ativos</option>
                        <option value="inativos">Inativos</option>
                        <option value="todos">Todos</option>
                      </select>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-5 py-3.5">
                        <h2 className="text-sm font-bold text-slate-900">
                          Catálogo de produtos e serviços ({filteredProducts.length})
                        </h2>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <tr>
                              <th className="px-4 py-3">Código</th>
                              <th className="px-4 py-3">Produto / Serviço</th>
                              <th className="px-4 py-3">Categoria</th>
                              <th className="px-4 py-3">Unid.</th>
                              <th className="px-4 py-3 text-right">Preço</th>
                              <th className="px-4 py-3">Situação</th>
                              <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredProducts.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                  Nenhum produto encontrado.
                                </td>
                              </tr>
                            ) : (
                              filteredProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/70">
                                  <td className="font-mono-num px-4 py-3 text-xs text-slate-500">
                                    {p.codigo}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900">{p.nome}</div>
                                    <div className="text-xs text-slate-500">{p.descricao}</div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-700">{p.categoria}</td>
                                  <td className="px-4 py-3 text-xs text-slate-500">
                                    {p.unidadeMedida}
                                  </td>
                                  <td className="font-mono-num px-4 py-3 text-right font-semibold">
                                    {formatBRL(p.preco)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${
                                        p.ativo
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                          : 'border-red-200 bg-red-50 text-red-800'
                                      }`}
                                    >
                                      {p.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingProductId(p.id);
                                        setProdFormNome(p.nome);
                                        setProdFormCodigo(p.codigo);
                                        setProdFormCategoriaId(p.categoriaId);
                                        setProdFormUnidade(p.unidadeMedida);
                                        setProdFormPreco(p.preco.toFixed(2));
                                        setProdFormDesc(p.descricao);
                                        setProdFormAtivo(p.ativo);
                                      }}
                                      className="mr-1 inline-flex items-center rounded border border-blue-300 p-1.5 text-blue-700 hover:bg-blue-50"
                                      title="Editar"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleOrDeleteProduct(p.id)}
                                      className="inline-flex items-center rounded border border-red-300 p-1.5 text-red-700 hover:bg-red-50"
                                      title="Excluir / Desativar"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== RELATÓRIOS ==================== */}
              {section === 'relatorios' && (
                <div className="space-y-6">
                  <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:items-start">
                    <DateRangePicker
                      startDate={reportStart}
                      endDate={reportEnd}
                      preset={reportPreset}
                      onChange={(next) => {
                        setReportStart(next.startDate);
                        setReportEnd(next.endDate);
                        setReportPreset(next.preset);
                      }}
                    />

                    <div className="flex flex-wrap gap-2 lg:shrink-0">
                      <button
                        type="button"
                        onClick={() => handleExportCSV('pedidos')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>CSV Pedidos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCSV('produtos')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>CSV Produtos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCSV('clientes')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>CSV Clientes</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-500">Pedidos no período</div>
                      <div className="font-mono-num mt-1 text-2xl font-bold">
                        {reportData.totalPedidos}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-500">Faturamento</div>
                      <div className="font-mono-num mt-1 text-2xl font-bold text-blue-700">
                        {formatBRL(reportData.faturamento)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-500">Pedidos entregues</div>
                      <div className="font-mono-num mt-1 text-2xl font-bold text-emerald-700">
                        {reportData.entregues}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-500">
                        Pedidos cancelados
                      </div>
                      <div className="font-mono-num mt-1 text-2xl font-bold text-red-700">
                        {reportData.cancelados}
                      </div>
                    </div>
                  </div>

                  {/* Pedidos por status */}
                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 py-3.5">
                      <h2 className="text-sm font-bold text-slate-900">Pedidos por status</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(Object.keys(STATUS_META) as OrderStatus[]).map((statusKey) => {
                        const meta = STATUS_META[statusKey];
                        const stats = reportData.byStatus[statusKey];
                        const pct =
                          reportData.totalPedidos > 0
                            ? Math.round((stats.count / reportData.totalPedidos) * 100)
                            : 0;
                        return (
                          <div
                            key={statusKey}
                            className="flex flex-col justify-between rounded-md border border-slate-200 bg-slate-50/50 p-3.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                              <span className="font-mono-num text-xs font-medium text-slate-500">
                                {pct}%
                              </span>
                            </div>
                            <div className="mt-3 flex items-baseline justify-between">
                              <span className="font-mono-num text-lg font-bold text-slate-900">
                                {stats.count}{' '}
                                <span className="text-xs font-normal text-slate-500">
                                  {stats.count === 1 ? 'pedido' : 'pedidos'}
                                </span>
                              </span>
                              <span className="font-mono-num text-xs font-semibold text-slate-700">
                                {formatBRL(stats.total)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-5 py-3.5">
                        <h2 className="text-sm font-bold text-slate-900">
                          Produtos mais solicitados
                        </h2>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <tr>
                            <th className="px-4 py-3">Produto / Serviço</th>
                            <th className="px-4 py-3 text-right">Qtd.</th>
                            <th className="px-4 py-3 text-right">Pedidos</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportData.topProdutos.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                Sem movimentação neste período.
                              </td>
                            </tr>
                          ) : (
                            reportData.topProdutos.map((p) => (
                              <tr key={p.nome}>
                                <td className="px-4 py-2.5 font-medium">{p.nome}</td>
                                <td className="font-mono-num px-4 py-2.5 text-right">{p.qtd}</td>
                                <td className="font-mono-num px-4 py-2.5 text-right">
                                  {p.pedidos}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-right font-semibold">
                                  {formatBRL(p.valor)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-5 py-3.5">
                        <h2 className="text-sm font-bold text-slate-900">
                          Clientes que mais compram
                        </h2>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <tr>
                            <th className="px-4 py-3">Cliente</th>
                            <th className="px-4 py-3">Telefone</th>
                            <th className="px-4 py-3 text-right">Pedidos</th>
                            <th className="px-4 py-3 text-right">Total gasto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportData.topClientes.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                Sem compras registradas neste período.
                              </td>
                            </tr>
                          ) : (
                            reportData.topClientes.map((c) => (
                              <tr key={c.id}>
                                <td className="px-4 py-2.5 font-medium">{c.nome}</td>
                                <td className="font-mono-num px-4 py-2.5 text-xs text-slate-600">
                                  {c.tel}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-right">
                                  {c.pedidos}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-right font-semibold">
                                  {formatBRL(c.total)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== CONFIGURAÇÕES ==================== */}
              {section === 'configuracoes' && (
                <form onSubmit={handleSaveConfig} className="mx-auto max-w-4xl space-y-6">
                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 py-3.5">
                      <h2 className="text-sm font-bold text-slate-900">Dados da Papelaria</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Nome da empresa
                        </label>
                        <input
                          type="text"
                          value={config.nomeEmpresa}
                          onChange={(e) => setConfig({ ...config, nomeEmpresa: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Telefone / WhatsApp da loja
                        </label>
                        <input
                          type="text"
                          value={config.telefoneEmpresa}
                          onChange={(e) =>
                            setConfig({ ...config, telefoneEmpresa: e.target.value })
                          }
                          className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Endereço
                        </label>
                        <input
                          type="text"
                          value={config.enderecoEmpresa}
                          onChange={(e) =>
                            setConfig({ ...config, enderecoEmpresa: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          CNPJ
                        </label>
                        <input
                          type="text"
                          value={config.cnpjEmpresa}
                          onChange={(e) => setConfig({ ...config, cnpjEmpresa: e.target.value })}
                          className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 py-3.5">
                      <h2 className="text-sm font-bold text-slate-900">
                        Modelos de mensagens WhatsApp
                      </h2>
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Variáveis: <code className="font-mono-num">{'{cliente}'}</code> ·{' '}
                        <code className="font-mono-num">{'{numero}'}</code> ·{' '}
                        <code className="font-mono-num">{'{itens}'}</code> ·{' '}
                        <code className="font-mono-num">{'{total}'}</code> ·{' '}
                        <code className="font-mono-num">{'{previsao}'}</code> ·{' '}
                        <code className="font-mono-num">{'{empresa}'}</code>
                      </div>

                      {(
                        [
                          ['registro', '1. Registro do pedido'],
                          ['confirmacao', '2. Confirmação do pedido'],
                          ['producao', '3. Pedido em produção'],
                          ['pronto', '4. Pedido pronto para retirada'],
                          ['entregue', '5. Pedido entregue'],
                        ] as Array<[WhatsAppTemplateKey, string]>
                      ).map(([key, label]) => (
                        <div key={key}>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            {label}
                          </label>
                          <textarea
                            rows={4}
                            value={config.templates[key]}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                templates: { ...config.templates, [key]: e.target.value },
                              })
                            }
                            className="font-mono-num w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-800"
                          />
                        </div>
                      ))}

                      <button
                        type="submit"
                        disabled={savingAction}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        <span>Salvar Configurações</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          )}
        </main>
      </div>

      <WhatsAppModal
        order={waOrder}
        client={waClient}
        config={config}
        onClose={() => setWaOrderId(null)}
      />
    </div>
  );
}
