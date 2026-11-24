<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();
$configs = obter_configuracoes($pdo);

// Filtros GET
$filtroNumero     = trim($_GET['numero'] ?? '');
$filtroCliente    = trim($_GET['cliente'] ?? '');
$filtroTelefone   = trim($_GET['telefone'] ?? '');
$filtroStatus     = trim($_GET['status'] ?? '');
$filtroDataInicio = trim($_GET['data_inicio'] ?? '');
$filtroDataFim    = trim($_GET['data_fim'] ?? '');

$where = [];
$params = [];

if ($filtroNumero !== '') {
    $where[] = 'p.numero LIKE ?';
    $params[] = '%' . $filtroNumero . '%';
}
if ($filtroCliente !== '') {
    $where[] = 'c.nome LIKE ?';
    $params[] = '%' . $filtroCliente . '%';
}
if ($filtroTelefone !== '') {
    $telLimpo = limpar_telefone($filtroTelefone);
    if ($telLimpo !== '') {
        $where[] = 'c.telefone_limpo LIKE ?';
        $params[] = '%' . $telLimpo . '%';
    } else {
        $where[] = 'c.telefone LIKE ?';
        $params[] = '%' . $filtroTelefone . '%';
    }
}
$statusValidos = array_keys(status_pedido_lista());
if ($filtroStatus !== '' && in_array($filtroStatus, $statusValidos, true)) {
    $where[] = 'p.status = ?';
    $params[] = $filtroStatus;
}
if ($filtroDataInicio !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $filtroDataInicio)) {
    $where[] = 'DATE(p.data_cadastro) >= ?';
    $params[] = $filtroDataInicio;
}
if ($filtroDataFim !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $filtroDataFim)) {
    $where[] = 'DATE(p.data_cadastro) <= ?';
    $params[] = $filtroDataFim;
}

$sql = "SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, c.empresa AS cliente_empresa
        FROM pedidos p
        INNER JOIN clientes c ON c.id = p.cliente_id";

if (!empty($where)) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}

$sql .= ' ORDER BY p.data_cadastro DESC, p.id DESC LIMIT 200';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$pedidos = $stmt->fetchAll();

// Carregar itens dos pedidos listados para envio rápido por WhatsApp
$itensPorPedido = [];
if (!empty($pedidos)) {
    $ids = array_column($pedidos, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmtItens = $pdo->prepare("SELECT * FROM pedido_itens WHERE pedido_id IN ($placeholders) ORDER BY id ASC");
    $stmtItens->execute($ids);
    foreach ($stmtItens->fetchAll() as $it) {
        $itensPorPedido[$it['pedido_id']][] = $it;
    }
}

$pageTitle = 'Pedidos';
$activeMenu = 'pedidos';
require_once __DIR__ . '/../includes/header.php';
?>

<!-- Filtros de Pedidos -->
<div class="erp-card mb-4">
    <div class="erp-card-header">
        <h2 class="erp-card-title">Filtrar pedidos</h2>
    </div>
    <div class="erp-card-body">
        <form method="get" action="<?= e(url('pedidos/index.php')) ?>" class="row g-3 align-items-end">
            <div class="col-6 col-md-2">
                <label for="f_numero" class="form-label small fw-medium">Nº do pedido</label>
                <input type="text" id="f_numero" name="numero" class="form-control form-control-sm font-mono-num" placeholder="000125" value="<?= e($filtroNumero) ?>">
            </div>
            <div class="col-6 col-md-3">
                <label for="f_cliente" class="form-label small fw-medium">Nome do cliente</label>
                <input type="text" id="f_cliente" name="cliente" class="form-control form-control-sm" placeholder="Buscar cliente" value="<?= e($filtroCliente) ?>">
            </div>
            <div class="col-6 col-md-2">
                <label for="f_telefone" class="form-label small fw-medium">Telefone</label>
                <input type="text" id="f_telefone" name="telefone" class="form-control form-control-sm" placeholder="(00) 00000-0000" value="<?= e($filtroTelefone) ?>">
            </div>
            <div class="col-6 col-md-2">
                <label for="f_status" class="form-label small fw-medium">Status</label>
                <select id="f_status" name="status" class="form-select form-select-sm">
                    <option value="">Todos</option>
                    <?php foreach (status_pedido_lista() as $chave => $meta): ?>
                        <option value="<?= e($chave) ?>" <?= $filtroStatus === $chave ? 'selected' : '' ?>>
                            <?= e($meta['label']) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="col-6 col-md-1">
                <label for="f_inicio" class="form-label small fw-medium">De</label>
                <input type="date" id="f_inicio" name="data_inicio" class="form-control form-control-sm" value="<?= e($filtroDataInicio) ?>">
            </div>
            <div class="col-6 col-md-2">
                <label for="f_fim" class="form-label small fw-medium">Até</label>
                <div class="d-flex gap-2">
                    <input type="date" id="f_fim" name="data_fim" class="form-control form-control-sm" value="<?= e($filtroDataFim) ?>">
                </div>
            </div>
            <div class="col-12 d-flex flex-wrap gap-2 justify-content-end pt-1">
                <a href="<?= e(url('pedidos/index.php')) ?>" class="btn btn-outline-secondary btn-sm">Limpar</a>
                <button type="submit" class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1">
                    <?= icon('search', 14) ?>
                    <span>Filtrar</span>
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Tabela de Pedidos -->
<div class="erp-card">
    <div class="erp-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 class="erp-card-title mb-0">Lista de pedidos (<?= count($pedidos) ?>)</h2>
        <a href="<?= e(url('pedidos/novo.php')) ?>" class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1">
            <?= icon('plus', 15) ?>
            <span>Novo pedido</span>
        </a>
    </div>
    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 erp-table">
            <thead>
                <tr>
                    <th>Nº Pedido</th>
                    <th>Cliente</th>
                    <th>Telefone</th>
                    <th>Data</th>
                    <th>Previsão entrega</th>
                    <th class="text-end">Valor total</th>
                    <th>Status</th>
                    <th class="text-end">Ações</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($pedidos)): ?>
                    <tr>
                        <td colspan="8" class="text-center py-5 text-muted">
                            Nenhum pedido encontrado com os filtros informados.
                        </td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($pedidos as $ped): ?>
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
                            $mapaModelo = [
                                'aguardando_confirmacao' => 'registro',
                                'confirmado'             => 'confirmacao',
                                'em_producao'            => 'producao',
                                'pronto_retirada'        => 'pronto',
                                'entregue'               => 'entregue',
                            ];
                            $modeloInicial = $mapaModelo[$ped['status']] ?? 'registro';
                        ?>
                        <tr>
                            <td class="font-mono-num fw-semibold">#<?= e($ped['numero']) ?></td>
                            <td>
                                <div class="fw-medium"><?= e($ped['cliente_nome']) ?></div>
                                <?php if (!empty($ped['cliente_empresa'])): ?>
                                    <div class="small text-muted"><?= e($ped['cliente_empresa']) ?></div>
                                <?php endif; ?>
                            </td>
                            <td class="font-mono-num small text-muted"><?= e(formatar_telefone($ped['cliente_telefone'])) ?></td>
                            <td class="font-mono-num small"><?= e(formatar_data_hora($ped['data_cadastro'])) ?></td>
                            <td class="font-mono-num small"><?= e(formatar_data($ped['data_previsao'])) ?></td>
                            <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($ped['valor_total'])) ?></td>
                            <td>
                                <span class="erp-status <?= e($st['badge']) ?>"><?= e($st['label']) ?></span>
                            </td>
                            <td class="text-end text-nowrap">
                                <a href="<?= e(url('pedidos/visualizar.php?id=' . (int)$ped['id'])) ?>" class="btn btn-sm btn-outline-secondary" title="Visualizar">
                                    <?= icon('eye', 15) ?>
                                </a>
                                <a href="<?= e(url('pedidos/editar.php?id=' . (int)$ped['id'])) ?>" class="btn btn-sm btn-outline-primary" title="Editar">
                                    <?= icon('edit', 15) ?>
                                </a>
                                <a href="<?= e(url('pedidos/visualizar.php?id=' . (int)$ped['id'] . '&print=1')) ?>" target="_blank" class="btn btn-sm btn-outline-dark" title="Imprimir">
                                    <?= icon('printer', 15) ?>
                                </a>
                                <button type="button"
                                        class="btn btn-sm btn-outline-success btn-open-wa"
                                        title="Enviar WhatsApp"
                                        data-cliente="<?= e($ped['cliente_nome']) ?>"
                                        data-telefone-exibicao="<?= e(formatar_telefone($ped['cliente_telefone'])) ?>"
                                        data-telefone-wa="<?= e(telefone_whatsapp($ped['cliente_telefone'])) ?>"
                                        data-modelo-inicial="<?= e($modeloInicial) ?>"
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

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
