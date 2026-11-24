<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();

$dataInicio = trim($_GET['data_inicio'] ?? date('Y-m-01'));
$dataFim    = trim($_GET['data_fim'] ?? date('Y-m-d'));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataInicio)) {
    $dataInicio = date('Y-m-01');
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataFim)) {
    $dataFim = date('Y-m-d');
}

// Resumo geral do período
$stmtResumo = $pdo->prepare(
    "SELECT
        COUNT(*) AS total_pedidos,
        COALESCE(SUM(CASE WHEN status <> 'cancelado' THEN valor_total ELSE 0 END), 0) AS faturamento,
        SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) AS total_entregues,
        SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS total_cancelados
     FROM pedidos
     WHERE DATE(data_cadastro) BETWEEN ? AND ?"
);
$stmtResumo->execute([$dataInicio, $dataFim]);
$resumo = $stmtResumo->fetch();

// Produtos mais solicitados
$stmtProdutos = $pdo->prepare(
    "SELECT pi.descricao_item,
            SUM(pi.quantidade) AS total_qtd,
            COUNT(DISTINCT pi.pedido_id) AS total_pedidos,
            COALESCE(SUM(pi.subtotal), 0) AS total_valor
     FROM pedido_itens pi
     INNER JOIN pedidos p ON p.id = pi.pedido_id
     WHERE DATE(p.data_cadastro) BETWEEN ? AND ?
       AND p.status <> 'cancelado'
     GROUP BY pi.descricao_item
     ORDER BY total_qtd DESC, total_valor DESC
     LIMIT 15"
);
$stmtProdutos->execute([$dataInicio, $dataFim]);
$topProdutos = $stmtProdutos->fetchAll();

// Clientes que mais compram
$stmtClientes = $pdo->prepare(
    "SELECT c.id, c.nome, c.telefone,
            COUNT(p.id) AS total_pedidos,
            COALESCE(SUM(p.valor_total), 0) AS total_gasto
     FROM pedidos p
     INNER JOIN clientes c ON c.id = p.cliente_id
     WHERE DATE(p.data_cadastro) BETWEEN ? AND ?
       AND p.status <> 'cancelado'
     GROUP BY c.id, c.nome, c.telefone
     ORDER BY total_gasto DESC, total_pedidos DESC
     LIMIT 15"
);
$stmtClientes->execute([$dataInicio, $dataFim]);
$topClientes = $stmtClientes->fetchAll();

$queryExport = http_build_query([
    'data_inicio' => $dataInicio,
    'data_fim'    => $dataFim,
]);

$pageTitle = 'Relatórios';
$activeMenu = 'relatorios';
$pageActionHtml = '
<a href="' . e(url('relatorios/exportar_csv.php?tipo=pedidos&' . $queryExport)) . '" class="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1">
    ' . icon('download', 15) . '<span>Exportar Pedidos (CSV)</span>
</a>';
require_once __DIR__ . '/../includes/header.php';
?>

<!-- Filtro de Período -->
<div class="erp-card mb-4">
    <div class="erp-card-body">
        <form method="get" action="<?= e(url('relatorios/index.php')) ?>" class="row g-3 align-items-end">
            <div class="col-6 col-md-3">
                <label for="data_inicio" class="form-label small fw-medium">Data inicial</label>
                <input type="date" id="data_inicio" name="data_inicio" class="form-control form-control-sm font-mono-num" value="<?= e($dataInicio) ?>">
            </div>
            <div class="col-6 col-md-3">
                <label for="data_fim" class="form-label small fw-medium">Data final</label>
                <input type="date" id="data_fim" name="data_fim" class="form-control form-control-sm font-mono-num" value="<?= e($dataFim) ?>">
            </div>
            <div class="col-12 col-md-6 d-flex flex-wrap gap-2">
                <button type="submit" class="btn btn-primary btn-sm">Gerar Relatório</button>
                <a href="<?= e(url('relatorios/exportar_csv.php?tipo=pedidos&' . $queryExport)) ?>" class="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1">
                    <?= icon('download', 14) ?><span>CSV Pedidos</span>
                </a>
                <a href="<?= e(url('relatorios/exportar_csv.php?tipo=produtos&' . $queryExport)) ?>" class="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1">
                    <?= icon('download', 14) ?><span>CSV Produtos</span>
                </a>
                <a href="<?= e(url('relatorios/exportar_csv.php?tipo=clientes&' . $queryExport)) ?>" class="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1">
                    <?= icon('download', 14) ?><span>CSV Clientes</span>
                </a>
            </div>
        </form>
    </div>
</div>

<!-- KPIs do Período -->
<div class="row g-3 mb-4">
    <div class="col-6 col-md-3">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Pedidos no período</div>
            <div class="erp-kpi-value font-mono-num"><?= (int)($resumo['total_pedidos'] ?? 0) ?></div>
            <div class="erp-kpi-sub"><?= e(formatar_data($dataInicio)) ?> a <?= e(formatar_data($dataFim)) ?></div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Faturamento</div>
            <div class="erp-kpi-value font-mono-num text-primary"><?= e(formatar_moeda($resumo['faturamento'] ?? 0)) ?></div>
            <div class="erp-kpi-sub">Exclui cancelados</div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Pedidos entregues</div>
            <div class="erp-kpi-value font-mono-num text-success"><?= (int)($resumo['total_entregues'] ?? 0) ?></div>
            <div class="erp-kpi-sub">Concluídos no período</div>
        </div>
    </div>
    <div class="col-6 col-md-3">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Pedidos cancelados</div>
            <div class="erp-kpi-value font-mono-num text-danger"><?= (int)($resumo['total_cancelados'] ?? 0) ?></div>
            <div class="erp-kpi-sub">Cancelados no período</div>
        </div>
    </div>
</div>

<div class="row g-4">
    <!-- Produtos Mais Solicitados -->
    <div class="col-12 col-lg-6">
        <div class="erp-card h-100">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Produtos e serviços mais solicitados</h2>
            </div>
            <div class="table-responsive">
                <table class="table align-middle mb-0 erp-table">
                    <thead>
                        <tr>
                            <th>Produto / Serviço</th>
                            <th class="text-end">Qtd. total</th>
                            <th class="text-end">Pedidos</th>
                            <th class="text-end">Valor gerado</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($topProdutos)): ?>
                            <tr><td colspan="4" class="text-center py-4 text-muted">Sem movimentação neste período.</td></tr>
                        <?php else: ?>
                            <?php foreach ($topProdutos as $tp): ?>
                                <tr>
                                    <td class="fw-medium"><?= e($tp['descricao_item']) ?></td>
                                    <td class="text-end font-mono-num"><?= e(rtrim(rtrim(number_format((float)$tp['total_qtd'], 2, ',', '.'), '0'), ',')) ?></td>
                                    <td class="text-end font-mono-num"><?= (int)$tp['total_pedidos'] ?></td>
                                    <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($tp['total_valor'])) ?></td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Clientes que Mais Compram -->
    <div class="col-12 col-lg-6">
        <div class="erp-card h-100">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Clientes que mais compram</h2>
            </div>
            <div class="table-responsive">
                <table class="table align-middle mb-0 erp-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Telefone</th>
                            <th class="text-end">Pedidos</th>
                            <th class="text-end">Total gasto</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($topClientes)): ?>
                            <tr><td colspan="4" class="text-center py-4 text-muted">Sem compras registradas neste período.</td></tr>
                        <?php else: ?>
                            <?php foreach ($topClientes as $tc): ?>
                                <tr>
                                    <td class="fw-medium">
                                        <a href="<?= e(url('clientes/visualizar.php?id=' . (int)$tc['id'])) ?>" class="text-decoration-none">
                                            <?= e($tc['nome']) ?>
                                        </a>
                                    </td>
                                    <td class="font-mono-num small text-muted"><?= e(formatar_telefone($tc['telefone'])) ?></td>
                                    <td class="text-end font-mono-num"><?= (int)$tc['total_pedidos'] ?></td>
                                    <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($tc['total_gasto'])) ?></td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
