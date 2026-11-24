<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();
$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) {
    redirect('clientes/index.php');
}

$stmt = $pdo->prepare('SELECT * FROM clientes WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$cliente = $stmt->fetch();

if (!$cliente) {
    set_flash('danger', 'Cliente não encontrado.');
    redirect('clientes/index.php');
}

$stmtPed = $pdo->prepare(
    'SELECT * FROM pedidos WHERE cliente_id = ? ORDER BY data_cadastro DESC, id DESC'
);
$stmtPed->execute([$id]);
$pedidos = $stmtPed->fetchAll();

$totalCompras = 0.0;
$qtdValidos = 0;
foreach ($pedidos as $p) {
    if ($p['status'] !== 'cancelado') {
        $totalCompras += (float)$p['valor_total'];
        $qtdValidos++;
    }
}

$pageTitle = 'Cliente: ' . $cliente['nome'];
$activeMenu = 'clientes';
$pageActionHtml = '<a href="' . e(url('clientes/index.php')) . '" class="btn btn-outline-secondary btn-sm">Voltar aos Clientes</a>';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="row g-4">
    <div class="col-12 col-lg-4">
        <div class="erp-card">
            <div class="erp-card-header d-flex justify-content-between align-items-center">
                <h2 class="erp-card-title">Dados cadastrais</h2>
                <a href="<?= e(url('clientes/index.php?editar=' . (int)$cliente['id'])) ?>" class="btn btn-sm btn-outline-primary">Editar</a>
            </div>
            <div class="erp-card-body">
                <div class="mb-3">
                    <div class="small text-muted">Nome completo</div>
                    <div class="fw-semibold"><?= e($cliente['nome']) ?></div>
                </div>
                <div class="mb-3">
                    <div class="small text-muted">Telefone / WhatsApp</div>
                    <div class="font-mono-num">
                        <a href="https://wa.me/<?= e(telefone_whatsapp($cliente['telefone'])) ?>" target="_blank" rel="noopener noreferrer" class="text-success text-decoration-none fw-medium">
                            <?= e(formatar_telefone($cliente['telefone'])) ?>
                        </a>
                    </div>
                </div>
                <?php if (!empty($cliente['empresa'])): ?>
                    <div class="mb-3">
                        <div class="small text-muted">Empresa</div>
                        <div><?= e($cliente['empresa']) ?></div>
                    </div>
                <?php endif; ?>
                <?php if (!empty($cliente['observacoes'])): ?>
                    <div class="mb-3">
                        <div class="small text-muted">Observações</div>
                        <div class="small"><?= nl2br(e($cliente['observacoes'])) ?></div>
                    </div>
                <?php endif; ?>
                <hr>
                <div class="d-flex justify-content-between mb-1">
                    <span class="text-muted">Pedidos ativos</span>
                    <span class="font-mono-num fw-semibold"><?= $qtdValidos ?></span>
                </div>
                <div class="d-flex justify-content-between">
                    <span class="text-muted">Total em compras</span>
                    <span class="font-mono-num fw-bold text-primary"><?= e(formatar_moeda($totalCompras)) ?></span>
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 col-lg-8">
        <div class="erp-card">
            <div class="erp-card-header d-flex justify-content-between align-items-center">
                <h2 class="erp-card-title">Histórico de pedidos (<?= count($pedidos) ?>)</h2>
                <a href="<?= e(url('pedidos/novo.php')) ?>" class="btn btn-primary btn-sm">Novo Pedido</a>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0 erp-table">
                    <thead>
                        <tr>
                            <th>Nº Pedido</th>
                            <th>Data</th>
                            <th>Previsão</th>
                            <th class="text-end">Valor total</th>
                            <th>Status</th>
                            <th class="text-end">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($pedidos)): ?>
                            <tr>
                                <td colspan="6" class="text-center py-5 text-muted">Este cliente ainda não possui pedidos.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($pedidos as $ped): ?>
                                <?php $st = status_pedido_info($ped['status']); ?>
                                <tr>
                                    <td class="font-mono-num fw-semibold">#<?= e($ped['numero']) ?></td>
                                    <td class="font-mono-num small"><?= e(formatar_data_hora($ped['data_cadastro'])) ?></td>
                                    <td class="font-mono-num small"><?= e(formatar_data($ped['data_previsao'])) ?></td>
                                    <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($ped['valor_total'])) ?></td>
                                    <td><span class="erp-status <?= e($st['badge']) ?>"><?= e($st['label']) ?></span></td>
                                    <td class="text-end">
                                        <a href="<?= e(url('pedidos/visualizar.php?id=' . (int)$ped['id'])) ?>" class="btn btn-sm btn-outline-secondary">Visualizar</a>
                                    </td>
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
