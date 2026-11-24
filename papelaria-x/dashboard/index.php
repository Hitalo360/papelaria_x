<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();
$configs = obter_configuracoes($pdo);

// Indicadores principais carregados diretamente do MySQL
$hoje = date('Y-m-d');

$stmtHoje = $pdo->prepare('SELECT COUNT(*) FROM pedidos WHERE DATE(data_cadastro) = ?');
$stmtHoje->execute([$hoje]);
$totalPedidosHoje = (int)$stmtHoje->fetchColumn();

$contagemPorStatus = [
    'aguardando_confirmacao' => 0,
    'confirmado'             => 0,
    'em_producao'            => 0,
    'pronto_retirada'        => 0,
    'entregue'               => 0,
    'cancelado'              => 0,
];
$rowsStatus = $pdo->query('SELECT status, COUNT(*) AS total FROM pedidos GROUP BY status')->fetchAll();
foreach ($rowsStatus as $r) {
    if (isset($contagemPorStatus[$r['status']])) {
        $contagemPorStatus[$r['status']] = (int)$r['total'];
    }
}

$pedidosAguardando = $contagemPorStatus['aguardando_confirmacao'] + $contagemPorStatus['confirmado'];
$pedidosProducao   = $contagemPorStatus['em_producao'];
$pedidosProntos    = $contagemPorStatus['pronto_retirada'];
$pedidosEntregues  = $contagemPorStatus['entregue'];

$valorTotalPedidos = (float)$pdo->query(
    "SELECT COALESCE(SUM(valor_total), 0) FROM pedidos WHERE status <> 'cancelado'"
)->fetchColumn();

// Dados dos últimos 14 dias para gráficos de pedidos e faturamento por período
$dias = [];
for ($i = 13; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-{$i} days"));
    $dias[$d] = [
        'label'       => date('d/m', strtotime($d)),
        'quantidade'  => 0,
        'faturamento' => 0.0,
    ];
}

$dataLimite = date('Y-m-d', strtotime('-13 days'));
$stmtPeriodo = $pdo->prepare(
    "SELECT DATE(data_cadastro) AS dia,
            COUNT(*) AS qtd,
            COALESCE(SUM(CASE WHEN status <> 'cancelado' THEN valor_total ELSE 0 END), 0) AS total_valor
     FROM pedidos
     WHERE DATE(data_cadastro) >= ?
     GROUP BY DATE(data_cadastro)
     ORDER BY dia ASC"
);
$stmtPeriodo->execute([$dataLimite]);
foreach ($stmtPeriodo->fetchAll() as $row) {
    if (isset($dias[$row['dia']])) {
        $dias[$row['dia']]['quantidade']  = (int)$row['qtd'];
        $dias[$row['dia']]['faturamento'] = (float)$row['total_valor'];
    }
}

$labelsPeriodo      = array_column($dias, 'label');
$dadosQtdPeriodo    = array_column($dias, 'quantidade');
$dadosFatPeriodo    = array_column($dias, 'faturamento');

$statusInfo = status_pedido_lista();
$labelsStatus = [];
$dadosStatus  = [];
$coresStatus  = [];
foreach ($statusInfo as $chave => $meta) {
    $labelsStatus[] = $meta['label'];
    $dadosStatus[]  = $contagemPorStatus[$chave];
    $coresStatus[]  = $meta['cor'];
}

// Últimos 8 pedidos cadastrados + itens para modal WhatsApp
$ultimosPedidos = $pdo->query(
    "SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, c.telefone_limpo
     FROM pedidos p
     INNER JOIN clientes c ON c.id = p.cliente_id
     ORDER BY p.data_cadastro DESC, p.id DESC
     LIMIT 8"
)->fetchAll();

$itensPorPedido = [];
if (!empty($ultimosPedidos)) {
    $ids = array_column($ultimosPedidos, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmtItens = $pdo->prepare("SELECT * FROM pedido_itens WHERE pedido_id IN ($placeholders) ORDER BY id ASC");
    $stmtItens->execute($ids);
    foreach ($stmtItens->fetchAll() as $it) {
        $itensPorPedido[$it['pedido_id']][] = $it;
    }
}

$pageTitle = 'Dashboard';
$activeMenu = 'dashboard';
require_once __DIR__ . '/../includes/header.php';
?>

<!-- Indicadores Principais (KPIs) -->
<div class="row g-3 mb-4">
    <div class="col-6 col-md-4 col-xl-2">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Pedidos hoje</div>
            <div class="erp-kpi-value font-mono-num"><?= $totalPedidosHoje ?></div>
            <div class="erp-kpi-sub">Registrados em <?= date('d/m') ?></div>
        </div>
    </div>
    <div class="col-6 col-md-4 col-xl-2">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Aguardando</div>
            <div class="erp-kpi-value font-mono-num text-warning-emphasis"><?= $pedidosAguardando ?></div>
            <div class="erp-kpi-sub">Confirmação / fila</div>
        </div>
    </div>
    <div class="col-6 col-md-4 col-xl-2">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Em produção</div>
            <div class="erp-kpi-value font-mono-num text-primary"><?= $pedidosProducao ?></div>
            <div class="erp-kpi-sub">Em execução</div>
        </div>
    </div>
    <div class="col-6 col-md-4 col-xl-2">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Prontos</div>
            <div class="erp-kpi-value font-mono-num text-info-emphasis"><?= $pedidosProntos ?></div>
            <div class="erp-kpi-sub">Para retirada</div>
        </div>
    </div>
    <div class="col-6 col-md-4 col-xl-2">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Entregues</div>
            <div class="erp-kpi-value font-mono-num text-success"><?= $pedidosEntregues ?></div>
            <div class="erp-kpi-sub">Concluídos</div>
        </div>
    </div>
    <div class="col-6 col-md-4 col-xl-2">
        <div class="erp-kpi-card">
            <div class="erp-kpi-label">Valor total</div>
            <div class="erp-kpi-value font-mono-num fs-5"><?= e(formatar_moeda($valorTotalPedidos)) ?></div>
            <div class="erp-kpi-sub">Pedidos ativos</div>
        </div>
    </div>
</div>

<!-- Gráficos de Desempenho -->
<div class="row g-3 mb-4">
    <div class="col-12 col-lg-4">
        <div class="erp-card h-100">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Pedidos por período (14 dias)</h2>
            </div>
            <div class="erp-card-body">
                <div style="height: 240px;">
                    <canvas id="chartPedidosPeriodo"></canvas>
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 col-lg-4">
        <div class="erp-card h-100">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Faturamento por período (14 dias)</h2>
            </div>
            <div class="erp-card-body">
                <div style="height: 240px;">
                    <canvas id="chartFaturamentoPeriodo"></canvas>
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 col-lg-4">
        <div class="erp-card h-100">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Situação dos pedidos</h2>
            </div>
            <div class="erp-card-body">
                <div style="height: 240px;">
                    <canvas id="chartSituacaoPedidos"></canvas>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Últimos Pedidos Cadastrados -->
<div class="erp-card">
    <div class="erp-card-header d-flex justify-content-between align-items-center">
        <h2 class="erp-card-title mb-0">Últimos pedidos cadastrados</h2>
        <a href="<?= e(url('pedidos/index.php')) ?>" class="btn btn-outline-secondary btn-sm">Ver todos</a>
    </div>
    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 erp-table">
            <thead>
                <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Telefone</th>
                    <th>Cadastro</th>
                    <th>Previsão</th>
                    <th class="text-end">Total</th>
                    <th>Status</th>
                    <th class="text-end">Ações</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($ultimosPedidos)): ?>
                    <tr>
                        <td colspan="8" class="text-center py-5 text-muted">
                            Nenhum pedido registrado ainda.
                            <div class="mt-2">
                                <a href="<?= e(url('pedidos/novo.php')) ?>" class="btn btn-primary btn-sm">Cadastrar Primeiro Pedido</a>
                            </div>
                        </td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($ultimosPedidos as $ped): ?>
                        <?php
                            $st = status_pedido_info($ped['status']);
                            $itensPed = $itensPorPedido[$ped['id']] ?? [];
                            $waTemplates = [
                                'registro'    => montar_mensagem_whatsapp($configs['whatsapp_registro'] ?? '', $ped, $itensPed, $configs),
                                'confirmacao' => montar_mensagem_whatsapp($configs['whatsapp_confirmacao'] ?? '', $ped, $itensPed, $configs),
                                'producao'    => montar_mensagem_whatsapp($configs['whatsapp_producao'] ?? '', $ped, $itensPed, $configs),
                                'pronto'      => montar_mensagem_whatsapp($configs['whatsapp_pronto'] ?? '', $ped, $itensPed, $configs),
                                'entregue'    => montar_mensagem_whatsapp($configs['whatsapp_entregue'] ?? '', $ped, $itensPed, $configs),
                            ];
                        ?>
                        <tr>
                            <td class="font-mono-num fw-semibold">#<?= e($ped['numero']) ?></td>
                            <td><?= e($ped['cliente_nome']) ?></td>
                            <td class="font-mono-num text-muted small"><?= e(formatar_telefone($ped['cliente_telefone'])) ?></td>
                            <td class="font-mono-num small"><?= e(formatar_data_hora($ped['data_cadastro'])) ?></td>
                            <td class="font-mono-num small"><?= e(formatar_data($ped['data_previsao'])) ?></td>
                            <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($ped['valor_total'])) ?></td>
                            <td>
                                <span class="erp-status <?= e($st['badge']) ?>">
                                    <?= e($st['label']) ?>
                                </span>
                            </td>
                            <td class="text-end text-nowrap">
                                <a href="<?= e(url('pedidos/visualizar.php?id=' . (int)$ped['id'])) ?>" class="btn btn-sm btn-outline-secondary" title="Visualizar pedido">
                                    <?= icon('eye', 15) ?>
                                </a>
                                <button type="button"
                                        class="btn btn-sm btn-outline-success btn-open-wa"
                                        title="Enviar pelo WhatsApp"
                                        data-cliente="<?= e($ped['cliente_nome']) ?>"
                                        data-telefone-exibicao="<?= e(formatar_telefone($ped['cliente_telefone'])) ?>"
                                        data-telefone-wa="<?= e(telefone_whatsapp($ped['cliente_telefone'])) ?>"
                                        data-templates="<?= e(json_encode($waTemplates, JSON_UNESCAPED_UNICODE)) ?>">
                                    <?= icon('whatsapp', 15) ?>
                                </button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
    if (typeof Chart === 'undefined') return;

    const labelsPeriodo = <?= json_encode($labelsPeriodo, JSON_UNESCAPED_UNICODE) ?>;
    const qtdPeriodo    = <?= json_encode($dadosQtdPeriodo) ?>;
    const fatPeriodo    = <?= json_encode($dadosFatPeriodo) ?>;
    const labelsStatus  = <?= json_encode($labelsStatus, JSON_UNESCAPED_UNICODE) ?>;
    const dadosStatus   = <?= json_encode($dadosStatus) ?>;
    const coresStatus   = <?= json_encode($coresStatus) ?>;

    new Chart(document.getElementById('chartPedidosPeriodo'), {
        type: 'bar',
        data: {
            labels: labelsPeriodo,
            datasets: [{
                label: 'Pedidos',
                data: qtdPeriodo,
                backgroundColor: '#2563EB',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });

    new Chart(document.getElementById('chartFaturamentoPeriodo'), {
        type: 'line',
        data: {
            labels: labelsPeriodo,
            datasets: [{
                label: 'Faturamento (R$)',
                data: fatPeriodo,
                borderColor: '#0D9488',
                backgroundColor: 'rgba(13, 148, 136, 0.12)',
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    new Chart(document.getElementById('chartSituacaoPedidos'), {
        type: 'doughnut',
        data: {
            labels: labelsStatus,
            datasets: [{
                data: dadosStatus,
                backgroundColor: coresStatus,
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            }
        }
    });
});
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
