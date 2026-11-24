<?php
require_once __DIR__ . '/../includes/auth.php';
$usuario = require_auth();

$pdo = getPDO();
$erro = '';

$clientes = $pdo->query(
    'SELECT id, nome, telefone, empresa, observacoes FROM clientes WHERE ativo = 1 ORDER BY nome ASC'
)->fetchAll();

$produtos = $pdo->query(
    "SELECT p.id, p.nome, p.codigo, p.preco, p.unidade_medida, c.nome AS categoria_nome
     FROM produtos p
     INNER JOIN categorias c ON c.id = p.categoria_id
     WHERE p.ativo = 1
     ORDER BY p.nome ASC"
)->fetchAll();

$proximoNumero = gerar_proximo_numero_pedido($pdo);
$dataHojeInput = date('Y-m-d\TH:i');
$previsaoPadrao = date('Y-m-d', strtotime('+1 day'));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    $modoCliente     = $_POST['modo_cliente'] ?? 'existente';
    $clienteId       = (int)($_POST['cliente_id'] ?? 0);
    $novoNome        = trim($_POST['novo_cliente_nome'] ?? '');
    $novoTelefone    = trim($_POST['novo_cliente_telefone'] ?? '');
    $novaEmpresa     = trim($_POST['novo_cliente_empresa'] ?? '');
    $novasObsCliente = trim($_POST['novo_cliente_obs'] ?? '');

    $dataCadastroRaw = trim($_POST['data_cadastro'] ?? '');
    $dataPrevisao    = trim($_POST['data_previsao'] ?? '');
    $desconto        = max(0.0, parse_decimal((string)($_POST['desconto'] ?? '0')));
    $observacoes     = trim($_POST['observacoes'] ?? '');

    $itemProdutoIds  = $_POST['item_produto_id'] ?? [];
    $itemDescricoes  = $_POST['item_descricao'] ?? [];
    $itemUnidades    = $_POST['item_unidade'] ?? [];
    $itemQuantidades = $_POST['item_quantidade'] ?? [];
    $itemValores     = $_POST['item_valor_unitario'] ?? [];

    // Monta e valida itens no servidor
    $itensLimpos = [];
    $subtotalPedido = 0.0;

    if (is_array($itemDescricoes)) {
        $totalLinhas = count($itemDescricoes);
        for ($i = 0; $i < $totalLinhas; $i++) {
            $desc = trim((string)($itemDescricoes[$i] ?? ''));
            $qtd  = parse_decimal((string)($itemQuantidades[$i] ?? '0'));
            $vUnit = parse_decimal((string)($itemValores[$i] ?? '0'));
            $prodId = !empty($itemProdutoIds[$i]) ? (int)$itemProdutoIds[$i] : null;
            $unid = trim((string)($itemUnidades[$i] ?? 'un'));
            if ($unid === '') {
                $unid = 'un';
            }

            if ($desc === '' || $qtd <= 0 || $vUnit < 0) {
                continue;
            }

            $subItem = round($qtd * $vUnit, 2);
            $subtotalPedido += $subItem;

            $itensLimpos[] = [
                'produto_id'     => $prodId,
                'descricao_item' => mb_substr($desc, 0, 200),
                'unidade_medida' => mb_substr($unid, 0, 30),
                'quantidade'     => $qtd,
                'valor_unitario' => $vUnit,
                'subtotal'       => $subItem,
            ];
        }
    }

    if (empty($itensLimpos)) {
        $erro = 'Adicione pelo menos um produto ou serviço válido ao pedido.';
    } elseif ($modoCliente === 'existente' && $clienteId <= 0) {
        $erro = 'Selecione um cliente cadastrado ou escolha "Cadastrar novo cliente".';
    } elseif ($modoCliente === 'novo' && ($novoNome === '' || limpar_telefone($novoTelefone) === '')) {
        $erro = 'Informe o nome completo e o telefone/WhatsApp do novo cliente.';
    } else {
        $subtotalPedido = round($subtotalPedido, 2);
        if ($desconto > $subtotalPedido) {
            $desconto = $subtotalPedido;
        }
        $valorTotal = round(max(0.0, $subtotalPedido - $desconto), 2);

        $dataCadastroSql = date('Y-m-d H:i:s');
        if ($dataCadastroRaw !== '') {
            $ts = strtotime($dataCadastroRaw);
            if ($ts) {
                $dataCadastroSql = date('Y-m-d H:i:s', $ts);
            }
        }
        $dataPrevisaoSql = ($dataPrevisao !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataPrevisao))
            ? $dataPrevisao
            : null;

        try {
            $pdo->beginTransaction();

            // Se novo cliente, evita duplicidade por telefone_limpo
            if ($modoCliente === 'novo') {
                $telLimpo = limpar_telefone($novoTelefone);
                $stmtDup = $pdo->prepare('SELECT id, nome FROM clientes WHERE telefone_limpo = ? LIMIT 1');
                $stmtDup->execute([$telLimpo]);
                $existente = $stmtDup->fetch();

                if ($existente) {
                    $clienteId = (int)$existente['id'];
                } else {
                    $stmtCli = $pdo->prepare(
                        'INSERT INTO clientes (nome, telefone, telefone_limpo, empresa, observacoes, ativo)
                         VALUES (?, ?, ?, ?, ?, 1)'
                    );
                    $stmtCli->execute([
                        $novoNome,
                        formatar_telefone($novoTelefone),
                        $telLimpo,
                        $novaEmpresa !== '' ? $novaEmpresa : null,
                        $novasObsCliente !== '' ? $novasObsCliente : null,
                    ]);
                    $clienteId = (int)$pdo->lastInsertId();
                }
            }

            $numeroGerado = gerar_proximo_numero_pedido($pdo);
            $statusInicial = 'aguardando_confirmacao';

            $stmtPed = $pdo->prepare(
                'INSERT INTO pedidos
                 (numero, cliente_id, usuario_id, data_cadastro, data_previsao, subtotal, desconto, valor_total, status, observacoes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmtPed->execute([
                $numeroGerado,
                $clienteId,
                $usuario['id'],
                $dataCadastroSql,
                $dataPrevisaoSql,
                $subtotalPedido,
                $desconto,
                $valorTotal,
                $statusInicial,
                $observacoes !== '' ? $observacoes : null,
            ]);
            $pedidoId = (int)$pdo->lastInsertId();

            $stmtItem = $pdo->prepare(
                'INSERT INTO pedido_itens
                 (pedido_id, produto_id, descricao_item, unidade_medida, quantidade, valor_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($itensLimpos as $item) {
                $stmtItem->execute([
                    $pedidoId,
                    $item['produto_id'],
                    $item['descricao_item'],
                    $item['unidade_medida'],
                    $item['quantidade'],
                    $item['valor_unitario'],
                    $item['subtotal'],
                ]);
            }

            $stmtHist = $pdo->prepare(
                'INSERT INTO pedido_historico (pedido_id, usuario_id, status_anterior, status_novo, observacao)
                 VALUES (?, ?, NULL, ?, ?)'
            );
            $stmtHist->execute([
                $pedidoId,
                $usuario['id'],
                $statusInicial,
                'Pedido registrado no sistema',
            ]);

            $pdo->commit();
            set_flash('success', "Pedido #{$numeroGerado} cadastrado com sucesso! Você já pode enviar pelo WhatsApp.");
            redirect('pedidos/visualizar.php?id=' . $pedidoId);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            $erro = 'Não foi possível salvar o pedido: ' . $e->getMessage();
        }
    }
}

$pageTitle = 'Novo Pedido';
$activeMenu = 'novo_pedido';
$pageActionHtml = '<a href="' . e(url('pedidos/index.php')) . '" class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1">' . icon('arrow-left', 15) . '<span>Voltar aos Pedidos</span></a>';
require_once __DIR__ . '/../includes/header.php';
?>

<?php if ($erro !== ''): ?>
    <div class="alert alert-danger"><?= e($erro) ?></div>
<?php endif; ?>

<form method="post" action="<?= e(url('pedidos/novo.php')) ?>" id="formPedido">
    <?= csrf_field() ?>

    <div class="row g-4">
        <!-- Coluna Principal: Cliente + Itens -->
        <div class="col-12 col-xl-8">
            <!-- Informações do Cliente -->
            <div class="erp-card mb-4">
                <div class="erp-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h2 class="erp-card-title">1. Informações do cliente</h2>
                    <div class="btn-group btn-group-sm" role="group">
                        <input type="radio" class="btn-check" name="modo_cliente" id="modoExistente" value="existente" checked>
                        <label class="btn btn-outline-primary" for="modoExistente">Cliente cadastrado</label>

                        <input type="radio" class="btn-check" name="modo_cliente" id="modoNovo" value="novo">
                        <label class="btn btn-outline-primary" for="modoNovo">Novo cliente</label>
                    </div>
                </div>
                <div class="erp-card-body">
                    <div id="blocoClienteExistente">
                        <label for="selectCliente" class="form-label fw-medium">Selecione o cliente</label>
                        <select id="selectCliente" name="cliente_id" class="form-select">
                            <option value="">-- Escolha um cliente --</option>
                            <?php foreach ($clientes as $cli): ?>
                                <option value="<?= (int)$cli['id'] ?>"
                                        data-obs="<?= e($cli['observacoes'] ?? '') ?>">
                                    <?= e($cli['nome']) ?> — <?= e(formatar_telefone($cli['telefone'])) ?><?= !empty($cli['empresa']) ? ' (' . e($cli['empresa']) . ')' : '' ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <div id="clienteObsPreview" class="small text-muted mt-2 d-none"></div>
                    </div>

                    <div id="blocoClienteNovo" class="d-none">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label for="novo_cliente_nome" class="form-label fw-medium">Nome completo *</label>
                                <input type="text" id="novo_cliente_nome" name="novo_cliente_nome" class="form-control" placeholder="Ex: Maria Oliveira">
                            </div>
                            <div class="col-md-6">
                                <label for="novo_cliente_telefone" class="form-label fw-medium">Telefone / WhatsApp *</label>
                                <input type="text" id="novo_cliente_telefone" name="novo_cliente_telefone" class="form-control mask-telefone" placeholder="(11) 99999-9999">
                            </div>
                            <div class="col-md-6">
                                <label for="novo_cliente_empresa" class="form-label fw-medium">Nome da empresa (opcional)</label>
                                <input type="text" id="novo_cliente_empresa" name="novo_cliente_empresa" class="form-control" placeholder="Ex: Escritório Central">
                            </div>
                            <div class="col-md-6">
                                <label for="novo_cliente_obs" class="form-label fw-medium">Observações sobre o cliente</label>
                                <input type="text" id="novo_cliente_obs" name="novo_cliente_obs" class="form-control" placeholder="Preferências de entrega ou contato">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Produtos e Serviços Solicitados -->
            <div class="erp-card">
                <div class="erp-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h2 class="erp-card-title">2. Produtos e serviços do pedido</h2>
                    <button type="button" id="btnAdicionarItemManual" class="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                        <?= icon('plus', 15) ?>
                        <span>Item avulso</span>
                    </button>
                </div>
                <div class="erp-card-body">
                    <!-- Seletor rápido do catálogo -->
                    <div class="row g-2 align-items-end mb-3 pb-3 border-bottom">
                        <div class="col-12 col-md-8">
                            <label for="catalogoProdutoSelect" class="form-label small fw-medium">Adicionar rapidamente do catálogo</label>
                            <select id="catalogoProdutoSelect" class="form-select">
                                <option value="">-- Selecione um produto ou serviço cadastrado --</option>
                                <?php foreach ($produtos as $prod): ?>
                                    <option value="<?= (int)$prod['id'] ?>"
                                            data-nome="<?= e($prod['nome']) ?>"
                                            data-preco="<?= e($prod['preco']) ?>"
                                            data-unidade="<?= e($prod['unidade_medida']) ?>">
                                        [<?= e($prod['codigo']) ?>] <?= e($prod['nome']) ?> — <?= e(formatar_moeda($prod['preco'])) ?> / <?= e($prod['unidade_medida']) ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-12 col-md-4">
                            <button type="button" id="btnAddCatalogo" class="btn btn-primary w-100">
                                Adicionar ao pedido
                            </button>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table align-middle mb-0" id="tabelaItensPedido">
                            <thead>
                                <tr>
                                    <th>Produto / Serviço</th>
                                    <th style="width: 95px;">Unid.</th>
                                    <th style="width: 105px;">Qtd.</th>
                                    <th style="width: 130px;">Valor Unit.</th>
                                    <th style="width: 130px;" class="text-end">Subtotal</th>
                                    <th style="width: 48px;"></th>
                                </tr>
                            </thead>
                            <tbody id="itensBody"></tbody>
                        </table>
                    </div>
                    <div id="avisoSemItens" class="text-center text-muted small py-4">
                        Nenhum item adicionado. Selecione um produto acima ou clique em "Item avulso".
                    </div>
                </div>
            </div>
        </div>

        <!-- Coluna Lateral: Dados do Pedido e Totais -->
        <div class="col-12 col-xl-4">
            <div class="erp-card">
                <div class="erp-card-header">
                    <h2 class="erp-card-title">3. Resumo e entrega</h2>
                </div>
                <div class="erp-card-body">
                    <div class="mb-3">
                        <label class="form-label small text-muted mb-1">Número do pedido (automático)</label>
                        <input type="text" class="form-control font-mono-num fw-bold bg-light" value="#<?= e($proximoNumero) ?>" readonly>
                    </div>

                    <div class="mb-3">
                        <label for="data_cadastro" class="form-label fw-medium">Data de cadastro</label>
                        <input type="datetime-local" id="data_cadastro" name="data_cadastro" class="form-control font-mono-num" value="<?= e($dataHojeInput) ?>">
                    </div>

                    <div class="mb-3">
                        <label for="data_previsao" class="form-label fw-medium">Previsão de entrega</label>
                        <input type="date" id="data_previsao" name="data_previsao" class="form-control font-mono-num" value="<?= e($previsaoPadrao) ?>">
                    </div>

                    <div class="mb-3">
                        <label for="observacoes" class="form-label fw-medium">Observações gerais</label>
                        <textarea id="observacoes" name="observacoes" class="form-control" rows="3" placeholder="Detalhes de impressão, acabamento, forma de retirada..."></textarea>
                    </div>

                    <hr>

                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-muted">Subtotal dos itens</span>
                        <span id="resumoSubtotal" class="font-mono-num fw-semibold">R$ 0,00</span>
                    </div>

                    <div class="mb-3">
                        <label for="inputDesconto" class="form-label small fw-medium mb-1">Desconto (R$)</label>
                        <input type="number" step="0.01" min="0" id="inputDesconto" name="desconto" class="form-control font-mono-num text-end" value="0.00">
                    </div>

                    <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded border mb-4">
                        <span class="fw-bold">Valor Total</span>
                        <span id="resumoTotal" class="font-mono-num fs-4 fw-bold text-primary">R$ 0,00</span>
                    </div>

                    <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">
                        Salvar Pedido
                    </button>
                </div>
            </div>
        </div>
    </div>
</form>

<script src="<?= e(url('assets/js/pedidos-form.js')) ?>"></script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
