<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();
$busca = trim($_GET['busca'] ?? '');
$situacao = trim($_GET['situacao'] ?? 'ativos');

$where = [];
$params = [];

if ($situacao === 'ativos') {
    $where[] = 'c.ativo = 1';
} elseif ($situacao === 'inativos') {
    $where[] = 'c.ativo = 0';
}

if ($busca !== '') {
    $buscaTel = limpar_telefone($busca);
    if ($buscaTel !== '') {
        $where[] = '(c.nome LIKE ? OR c.telefone_limpo LIKE ? OR c.empresa LIKE ?)';
        $params[] = '%' . $busca . '%';
        $params[] = '%' . $buscaTel . '%';
        $params[] = '%' . $busca . '%';
    } else {
        $where[] = '(c.nome LIKE ? OR c.empresa LIKE ?)';
        $params[] = '%' . $busca . '%';
        $params[] = '%' . $busca . '%';
    }
}

$sql = "SELECT c.*,
               COUNT(p.id) AS total_pedidos,
               COALESCE(SUM(CASE WHEN p.status <> 'cancelado' THEN p.valor_total ELSE 0 END), 0) AS total_compras
        FROM clientes c
        LEFT JOIN pedidos p ON p.cliente_id = c.id";

if (!empty($where)) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}

$sql .= ' GROUP BY c.id ORDER BY c.nome ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$clientes = $stmt->fetchAll();

// Caso esteja editando algum cliente via ?editar=ID
$clienteEdicao = null;
$editarId = (int)($_GET['editar'] ?? 0);
if ($editarId > 0) {
    $stEdit = $pdo->prepare('SELECT * FROM clientes WHERE id = ? LIMIT 1');
    $stEdit->execute([$editarId]);
    $clienteEdicao = $stEdit->fetch() ?: null;
}

$pageTitle = 'Clientes';
$activeMenu = 'clientes';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="row g-4">
    <!-- Formulário de Cadastro / Edição -->
    <div class="col-12 col-lg-4">
        <div class="erp-card">
            <div class="erp-card-header d-flex justify-content-between align-items-center">
                <h2 class="erp-card-title"><?= $clienteEdicao ? 'Editar cliente' : 'Novo cliente' ?></h2>
                <?php if ($clienteEdicao): ?>
                    <a href="<?= e(url('clientes/index.php')) ?>" class="btn btn-sm btn-outline-secondary">Cancelar</a>
                <?php endif; ?>
            </div>
            <div class="erp-card-body">
                <form method="post" action="<?= e(url('clientes/salvar.php')) ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="id" value="<?= $clienteEdicao ? (int)$clienteEdicao['id'] : 0 ?>">

                    <div class="mb-3">
                        <label for="cli_nome" class="form-label fw-medium">Nome completo *</label>
                        <input type="text" id="cli_nome" name="nome" class="form-control" required value="<?= e($clienteEdicao['nome'] ?? '') ?>">
                    </div>

                    <div class="mb-3">
                        <label for="cli_telefone" class="form-label fw-medium">Telefone / WhatsApp *</label>
                        <input type="text" id="cli_telefone" name="telefone" class="form-control mask-telefone font-mono-num" required placeholder="(11) 99999-9999" value="<?= e($clienteEdicao ? formatar_telefone($clienteEdicao['telefone']) : '') ?>">
                        <div class="form-text">O sistema impede duplicidade por telefone.</div>
                    </div>

                    <div class="mb-3">
                        <label for="cli_empresa" class="form-label fw-medium">Empresa (opcional)</label>
                        <input type="text" id="cli_empresa" name="empresa" class="form-control" value="<?= e($clienteEdicao['empresa'] ?? '') ?>">
                    </div>

                    <div class="mb-3">
                        <label for="cli_obs" class="form-label fw-medium">Observações</label>
                        <textarea id="cli_obs" name="observacoes" class="form-control" rows="3"><?= e($clienteEdicao['observacoes'] ?? '') ?></textarea>
                    </div>

                    <div class="form-check mb-3">
                        <input class="form-check-input" type="checkbox" id="cli_ativo" name="ativo" value="1" <?= (!$clienteEdicao || (int)$clienteEdicao['ativo'] === 1) ? 'checked' : '' ?>>
                        <label class="form-check-label" for="cli_ativo">Cliente ativo</label>
                    </div>

                    <button type="submit" class="btn btn-primary w-100 fw-semibold">
                        <?= $clienteEdicao ? 'Atualizar Cliente' : 'Cadastrar Cliente' ?>
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- Consulta e Listagem -->
    <div class="col-12 col-lg-8">
        <div class="erp-card mb-3">
            <div class="erp-card-body">
                <form method="get" action="<?= e(url('clientes/index.php')) ?>" class="row g-2 align-items-end">
                    <div class="col-12 col-md-6">
                        <label for="busca" class="form-label small fw-medium">Pesquisar por nome, empresa ou telefone</label>
                        <input type="text" id="busca" name="busca" class="form-control form-control-sm" placeholder="Digite para consultar..." value="<?= e($busca) ?>">
                    </div>
                    <div class="col-6 col-md-3">
                        <label for="situacao" class="form-label small fw-medium">Situação</label>
                        <select id="situacao" name="situacao" class="form-select form-select-sm">
                            <option value="ativos" <?= $situacao === 'ativos' ? 'selected' : '' ?>>Ativos</option>
                            <option value="inativos" <?= $situacao === 'inativos' ? 'selected' : '' ?>>Inativos</option>
                            <option value="todos" <?= $situacao === 'todos' ? 'selected' : '' ?>>Todos</option>
                        </select>
                    </div>
                    <div class="col-6 col-md-3 d-flex gap-2">
                        <button type="submit" class="btn btn-primary btn-sm flex-grow-1">Buscar</button>
                        <a href="<?= e(url('clientes/index.php')) ?>" class="btn btn-outline-secondary btn-sm">Limpar</a>
                    </div>
                </form>
            </div>
        </div>

        <div class="erp-card">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Clientes cadastrados (<?= count($clientes) ?>)</h2>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0 erp-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Telefone</th>
                            <th class="text-center">Pedidos</th>
                            <th class="text-end">Total compras</th>
                            <th>Situação</th>
                            <th class="text-end">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($clientes)): ?>
                            <tr>
                                <td colspan="6" class="text-center py-5 text-muted">Nenhum cliente encontrado.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($clientes as $cli): ?>
                                <tr>
                                    <td>
                                        <div class="fw-medium"><?= e($cli['nome']) ?></div>
                                        <?php if (!empty($cli['empresa'])): ?>
                                            <div class="small text-muted"><?= e($cli['empresa']) ?></div>
                                        <?php endif; ?>
                                    </td>
                                    <td class="font-mono-num small">
                                        <a href="https://wa.me/<?= e(telefone_whatsapp($cli['telefone'])) ?>" target="_blank" rel="noopener noreferrer" class="text-decoration-none text-success">
                                            <?= e(formatar_telefone($cli['telefone'])) ?>
                                        </a>
                                    </td>
                                    <td class="text-center font-mono-num"><?= (int)$cli['total_pedidos'] ?></td>
                                    <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($cli['total_compras'])) ?></td>
                                    <td>
                                        <?php if ((int)$cli['ativo'] === 1): ?>
                                            <span class="erp-status status-entregue">Ativo</span>
                                        <?php else: ?>
                                            <span class="erp-status status-cancelado">Inativo</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="text-end text-nowrap">
                                        <a href="<?= e(url('clientes/visualizar.php?id=' . (int)$cli['id'])) ?>" class="btn btn-sm btn-outline-secondary" title="Histórico de pedidos">
                                            <?= icon('eye', 15) ?>
                                        </a>
                                        <a href="<?= e(url('clientes/index.php?editar=' . (int)$cli['id'])) ?>" class="btn btn-sm btn-outline-primary" title="Editar">
                                            <?= icon('edit', 15) ?>
                                        </a>
                                        <form method="post" action="<?= e(url('clientes/excluir.php')) ?>" class="d-inline" onsubmit="return confirm('Confirma alterar/remover este cliente?');">
                                            <?= csrf_field() ?>
                                            <input type="hidden" name="id" value="<?= (int)$cli['id'] ?>">
                                            <button type="submit" class="btn btn-sm btn-outline-danger" title="<?= (int)$cli['total_pedidos'] > 0 ? 'Desativar/Ativar' : 'Excluir' ?>">
                                                <?= icon('trash', 15) ?>
                                            </button>
                                        </form>
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
