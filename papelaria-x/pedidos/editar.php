<?php
require_once __DIR__ . '/../includes/auth.php';
$usuario = require_auth();

$pdo = getPDO();
$id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
if ($id <= 0) {
    redirect('pedidos/index.php');
}

$stmt = $pdo->prepare('SELECT * FROM pedidos WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$pedido = $stmt->fetch();

if (!$pedido) {
    set_flash('danger', 'Pedido não encontrado.');
    redirect('pedidos/index.php');
}

$clientes = $pdo->query('SELECT id, nome, telefone, empresa FROM clientes WHERE ativo = 1 ORDER BY nome ASC')->fetchAll();
$produtos = $pdo->query(
    "SELECT p.id, p.nome, p.codigo, p.preco, p.unidade_medida
     FROM produtos p
     WHERE p.ativo = 1
     ORDER BY p.nome ASC"
)->fetchAll();

$stmtItens = $pdo->prepare('SELECT * FROM pedido_itens WHERE pedido_id = ? ORDER BY id ASC');
$stmtItens->execute([$id]);
$itensAtuais = $stmtItens->fetchAll();

$erro = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();

    $clienteId    = (int)($_POST['cliente_id'] ?? 0);
    $dataPrevisao = trim($_POST['data_previsao'] ?? '');
    $desconto     = max(0.0, parse_decimal((string)($_POST['desconto'] ?? '0')));
    $observacoes  = trim($_POST['observacoes'] ?? '');
    $novoStatus   = trim($_POST['status'] ?? $pedido['status']);

    $statusValidos = array_keys(status_pedido_lista());
    if (!in_array($novoStatus, $statusValidos, true)) {
        $novoStatus = $pedido['status'];
    }

    $itemProdutoIds  = $_POST['item_produto_id'] ?? [];
    $itemDescricoes  = $_POST['item_descricao'] ?? [];
    $itemUnidades    = $_POST['item_unidade'] ?? [];
    $itemQuantidades = $_POST['item_quantidade'] ?? [];
    $itemValores     = $_POST['item_valor_unitario'] ?? [];

    $itensLimpos = [];
    $subtotalPedido = 0.0;

    if (is_array($itemDescricoes)) {
        $totalLinhas = count($itemDescricoes);
        for ($i = 0; $i < $totalLinhas; $i++) {
            $desc  = trim((string)($itemDescricoes[$i] ?? ''));
            $qtd   = parse_decimal((string)($itemQuantidades[$i] ?? '0'));
            $vUnit = parse_decimal((string)($itemValores[$i] ?? '0'));
            $prodId = !empty($itemProdutoIds[$i]) ? (int)$itemProdutoIds[$i] : null;
            $unid = trim((string)($itemUnidades[$i] ?? 'un')) ?: 'un';

            if ($desc === '' || $qtd <= 0 || $vUnit < 0) {
                continue;
            }
            $sub = round($qtd * $vUnit, 2);
            $subtotalPedido += $sub;

            $itensLimpos[] = [
                'produto_id'     => $prodId,
                'descricao_item' => mb_substr($desc, 0, 200),
                'unidade_medida' => mb_substr($unid, 0, 30),
                'quantidade'     => $qtd,
                'valor_unitario' => $vUnit,
                'subtotal'       => $sub,
            ];
        }
    }

    if ($clienteId <= 0) {
        $erro = 'Selecione o cliente do pedido.';
    } elseif (empty($itensLimpos)) {
        $erro = 'O pedido precisa conter pelo menos um item válido.';
    } else {
        $subtotalPedido = round($subtotalPedido, 2);
        if ($desconto > $subtotalPedido) {
            $desconto = $subtotalPedido;
        }
        $valorTotal = round(max(0.0, $subtotalPedido - $desconto), 2);
        $dataPrevisaoSql = ($dataPrevisao !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataPrevisao))
            ? $dataPrevisao
            : null;

        try {
            $pdo->beginTransaction();

            $upd = $pdo->prepare(
                'UPDATE pedidos
                 SET cliente_id = ?, data_previsao = ?, subtotal = ?, desconto = ?, valor_total = ?, status = ?, observacoes = ?
                 WHERE id = ?'
            );
            $upd->execute([
                $clienteId,
                $dataPrevisaoSql,
                $subtotalPedido,
                $desconto,
                $valorTotal,
                $novoStatus,
                $observacoes !== '' ? $observacoes : null,
                $id,
            ]);

            $pdo->prepare('DELETE FROM pedido_itens WHERE pedido_id = ?')->execute([$id]);

            $stmtIns = $pdo->prepare(
                'INSERT INTO pedido_itens
                 (pedido_id, produto_id, descricao_item, unidade_medida, quantidade, valor_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($itensLimpos as $it) {
                $stmtIns->execute([
                    $id,
                    $it['produto_id'],
                    $it['descricao_item'],
                    $it['unidade_medida'],
                    $it['quantidade'],
                    $it['valor_unitario'],
                    $it['subtotal'],
                ]);
            }

            if ($novoStatus !== $pedido['status']) {
                $stmtHist = $pdo->prepare(
                    'INSERT INTO pedido_historico (pedido_id, usuario_id, status_anterior, status_novo, observacao)
                     VALUES (?, ?, ?, ?, ?)'
                );
                $stmtHist->execute([
                    $id,
                    $usuario['id'],
                    $pedido['status'],
                    $novoStatus,
                    'Status alterado durante a edição do pedido',
                ]);
            }

            $pdo->commit();
            set_flash('success', 'Pedido atualizado com sucesso!');
            redirect('pedidos/visualizar.php?id=' . $id);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            $erro = 'Erro ao atualizar o pedido: ' . $e->getMessage();
        }
    }
}

$pageTitle = 'Editar Pedido #' . $pedido['numero'];
$activeMenu = 'pedidos';
$pageActionHtml = '<a href="' . e(url('pedidos/visualizar.php?id=' . $id)) . '" class="btn btn-outline-secondary btn-sm">Cancelar</a>';
require_once __DIR__ . '/../includes/header.php';
?>

<?php if ($erro !== ''): ?>
    <div class="alert alert-danger"><?= e($erro) ?></div>
<?php endif; ?>

<form method="post" action="<?= e(url('pedidos/editar.php?id=' . $id)) ?>" id="formPedido">
    <?= csrf_field() ?>
    <input type="hidden" name="id" value="<?= $id ?>">

    <div class="row g-4">
        <div class="col-12 col-xl-8">
            <div class="erp-card mb-4">
                <div class="erp-card-header">
                    <h2 class="erp-card-title">Cliente do pedido</h2>
                </div>
                <div class="erp-card-body">
                    <select name="cliente_id" class="form-select" required>
                        <?php foreach ($clientes as $cli): ?>
                            <option value="<?= (int)$cli['id'] ?>" <?= (int)$pedido['cliente_id'] === (int)$cli['id'] ? 'selected' : '' ?>>
                                <?= e($cli['nome']) ?> — <?= e(formatar_telefone($cli['telefone'])) ?><?= !empty($cli['empresa']) ? ' (' . e($cli['empresa']) . ')' : '' ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>

            <div class="erp-card">
                <div class="erp-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h2 class="erp-card-title">Itens do pedido</h2>
                    <button type="button" id="btnAdicionarItemManual" class="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                        <?= icon('plus', 15) ?>
                        <span>Item avulso</span>
                    </button>
                </div>
                <div class="erp-card-body">
                    <div class="row g-2 align-items-end mb-3 pb-3 border-bottom">
                        <div class="col-12 col-md-8">
                            <label for="catalogoProdutoSelect" class="form-label small fw-medium">Adicionar do catálogo</label>
                            <select id="catalogoProdutoSelect" class="form-select">
                                <option value="">-- Selecione um produto ou serviço --</option>
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
                            <button type="button" id="btnAddCatalogo" class="btn btn-primary w-100">Adicionar ao pedido</button>
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
                    <div id="avisoSemItens" class="text-center text-muted small py-4 d-none">
                        Nenhum item adicionado.
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12 col-xl-4">
            <div class="erp-card">
                <div class="erp-card-header">
                    <h2 class="erp-card-title">Dados e valores</h2>
                </div>
                <div class="erp-card-body">
                    <div class="mb-3">
                        <label for="status" class="form-label fw-medium">Status</label>
                        <select id="status" name="status" class="form-select">
                            <?php foreach (status_pedido_lista() as $chave => $meta): ?>
                                <option value="<?= e($chave) ?>" <?= $pedido['status'] === $chave ? 'selected' : '' ?>>
                                    <?= e($meta['label']) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label for="data_previsao" class="form-label fw-medium">Previsão de entrega</label>
                        <input type="date" id="data_previsao" name="data_previsao" class="form-control font-mono-num" value="<?= e($pedido['data_previsao'] ?? '') ?>">
                    </div>

                    <div class="mb-3">
                        <label for="observacoes" class="form-label fw-medium">Observações gerais</label>
                        <textarea id="observacoes" name="observacoes" class="form-control" rows="3"><?= e($pedido['observacoes'] ?? '') ?></textarea>
                    </div>

                    <hr>

                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-muted">Subtotal dos itens</span>
                        <span id="resumoSubtotal" class="font-mono-num fw-semibold">R$ 0,00</span>
                    </div>

                    <div class="mb-3">
                        <label for="inputDesconto" class="form-label small fw-medium mb-1">Desconto (R$)</label>
                        <input type="number" step="0.01" min="0" id="inputDesconto" name="desconto" class="form-control font-mono-num text-end" value="<?= e(number_format((float)$pedido['desconto'], 2, '.', '')) ?>">
                    </div>

                    <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded border mb-4">
                        <span class="fw-bold">Valor Total</span>
                        <span id="resumoTotal" class="font-mono-num fs-4 fw-bold text-primary">R$ 0,00</span>
                    </div>

                    <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">Salvar Alterações</button>
                </div>
            </div>
        </div>
    </div>
</form>

<script>
window.ITENS_INICIAIS_PEDIDO = <?= json_encode($itensAtuais, JSON_UNESCAPED_UNICODE) ?>;
</script>
<script src="<?= e(url('assets/js/pedidos-form.js')) ?>"></script>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
