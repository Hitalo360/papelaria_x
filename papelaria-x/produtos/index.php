<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();
$busca = trim($_GET['busca'] ?? '');
$categoriaFiltro = (int)($_GET['categoria_id'] ?? 0);
$situacao = trim($_GET['situacao'] ?? 'ativos');

$categorias = $pdo->query('SELECT * FROM categorias WHERE ativo = 1 ORDER BY nome ASC')->fetchAll();

$where = [];
$params = [];

if ($situacao === 'ativos') {
    $where[] = 'p.ativo = 1';
} elseif ($situacao === 'inativos') {
    $where[] = 'p.ativo = 0';
}

if ($categoriaFiltro > 0) {
    $where[] = 'p.categoria_id = ?';
    $params[] = $categoriaFiltro;
}

if ($busca !== '') {
    $where[] = '(p.nome LIKE ? OR p.codigo LIKE ? OR p.descricao LIKE ?)';
    $params[] = '%' . $busca . '%';
    $params[] = '%' . $busca . '%';
    $params[] = '%' . $busca . '%';
}

$sql = 'SELECT p.*, c.nome AS categoria_nome
        FROM produtos p
        INNER JOIN categorias c ON c.id = p.categoria_id';
if (!empty($where)) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY p.nome ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$produtos = $stmt->fetchAll();

$produtoEdicao = null;
$editarId = (int)($_GET['editar'] ?? 0);
if ($editarId > 0) {
    $stEdit = $pdo->prepare('SELECT * FROM produtos WHERE id = ? LIMIT 1');
    $stEdit->execute([$editarId]);
    $produtoEdicao = $stEdit->fetch() ?: null;
}

$pageTitle = 'Produtos e Serviços';
$activeMenu = 'produtos';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="row g-4">
    <!-- Formulário de Produto / Serviço + Nova Categoria -->
    <div class="col-12 col-lg-4">
        <div class="erp-card mb-4">
            <div class="erp-card-header d-flex justify-content-between align-items-center">
                <h2 class="erp-card-title"><?= $produtoEdicao ? 'Editar item' : 'Novo produto / serviço' ?></h2>
                <?php if ($produtoEdicao): ?>
                    <a href="<?= e(url('produtos/index.php')) ?>" class="btn btn-sm btn-outline-secondary">Cancelar</a>
                <?php endif; ?>
            </div>
            <div class="erp-card-body">
                <form method="post" action="<?= e(url('produtos/salvar.php')) ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="tipo" value="produto">
                    <input type="hidden" name="id" value="<?= $produtoEdicao ? (int)$produtoEdicao['id'] : 0 ?>">

                    <div class="mb-3">
                        <label for="prod_nome" class="form-label fw-medium">Nome *</label>
                        <input type="text" id="prod_nome" name="nome" class="form-control" required value="<?= e($produtoEdicao['nome'] ?? '') ?>">
                    </div>

                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label for="prod_codigo" class="form-label fw-medium">Código *</label>
                            <input type="text" id="prod_codigo" name="codigo" class="form-control font-mono-num" required placeholder="IMP-COR-A4" value="<?= e($produtoEdicao['codigo'] ?? '') ?>">
                        </div>
                        <div class="col-6">
                            <label for="prod_unidade" class="form-label fw-medium">Unidade *</label>
                            <input type="text" id="prod_unidade" name="unidade_medida" class="form-control" required placeholder="folha, un, cento" value="<?= e($produtoEdicao['unidade_medida'] ?? 'un') ?>">
                        </div>
                    </div>

                    <div class="row g-2 mb-3">
                        <div class="col-7">
                            <label for="prod_categoria" class="form-label fw-medium">Categoria *</label>
                            <select id="prod_categoria" name="categoria_id" class="form-select" required>
                                <?php foreach ($categorias as $cat): ?>
                                    <option value="<?= (int)$cat['id'] ?>" <?= ($produtoEdicao && (int)$produtoEdicao['categoria_id'] === (int)$cat['id']) ? 'selected' : '' ?>>
                                        <?= e($cat['nome']) ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-5">
                            <label for="prod_preco" class="form-label fw-medium">Preço (R$) *</label>
                            <input type="number" step="0.01" min="0" id="prod_preco" name="preco" class="form-control font-mono-num text-end" required value="<?= e($produtoEdicao ? number_format((float)$produtoEdicao['preco'], 2, '.', '') : '0.00') ?>">
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="prod_desc" class="form-label fw-medium">Descrição</label>
                        <textarea id="prod_desc" name="descricao" class="form-control" rows="2"><?= e($produtoEdicao['descricao'] ?? '') ?></textarea>
                    </div>

                    <div class="form-check mb-3">
                        <input class="form-check-input" type="checkbox" id="prod_ativo" name="ativo" value="1" <?= (!$produtoEdicao || (int)$produtoEdicao['ativo'] === 1) ? 'checked' : '' ?>>
                        <label class="form-check-label" for="prod_ativo">Item ativo para pedidos</label>
                    </div>

                    <button type="submit" class="btn btn-primary w-100 fw-semibold">
                        <?= $produtoEdicao ? 'Atualizar Produto' : 'Cadastrar Produto' ?>
                    </button>
                </form>
            </div>
        </div>

        <div class="erp-card">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Nova categoria</h2>
            </div>
            <div class="erp-card-body">
                <form method="post" action="<?= e(url('produtos/salvar.php')) ?>" class="d-flex gap-2">
                    <?= csrf_field() ?>
                    <input type="hidden" name="tipo" value="categoria">
                    <input type="text" name="nome_categoria" class="form-control form-control-sm" required placeholder="Nome da categoria">
                    <button type="submit" class="btn btn-outline-primary btn-sm text-nowrap">Adicionar</button>
                </form>
            </div>
        </div>
    </div>

    <!-- Catálogo -->
    <div class="col-12 col-lg-8">
        <div class="erp-card mb-3">
            <div class="erp-card-body">
                <form method="get" action="<?= e(url('produtos/index.php')) ?>" class="row g-2 align-items-end">
                    <div class="col-12 col-md-5">
                        <label for="busca" class="form-label small fw-medium">Pesquisar produto ou código</label>
                        <input type="text" id="busca" name="busca" class="form-control form-control-sm" placeholder="Ex: Impressão, Encadernação..." value="<?= e($busca) ?>">
                    </div>
                    <div class="col-6 col-md-3">
                        <label for="categoria_id" class="form-label small fw-medium">Categoria</label>
                        <select id="categoria_id" name="categoria_id" class="form-select form-select-sm">
                            <option value="0">Todas</option>
                            <?php foreach ($categorias as $cat): ?>
                                <option value="<?= (int)$cat['id'] ?>" <?= $categoriaFiltro === (int)$cat['id'] ? 'selected' : '' ?>>
                                    <?= e($cat['nome']) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-6 col-md-2">
                        <label for="situacao" class="form-label small fw-medium">Situação</label>
                        <select id="situacao" name="situacao" class="form-select form-select-sm">
                            <option value="ativos" <?= $situacao === 'ativos' ? 'selected' : '' ?>>Ativos</option>
                            <option value="inativos" <?= $situacao === 'inativos' ? 'selected' : '' ?>>Inativos</option>
                            <option value="todos" <?= $situacao === 'todos' ? 'selected' : '' ?>>Todos</option>
                        </select>
                    </div>
                    <div class="col-12 col-md-2 d-flex gap-1">
                        <button type="submit" class="btn btn-primary btn-sm flex-grow-1">Filtrar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="erp-card">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Catálogo de produtos e serviços (<?= count($produtos) ?>)</h2>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0 erp-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Produto / Serviço</th>
                            <th>Categoria</th>
                            <th>Unid.</th>
                            <th class="text-end">Preço</th>
                            <th>Situação</th>
                            <th class="text-end">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($produtos)): ?>
                            <tr>
                                <td colspan="7" class="text-center py-5 text-muted">Nenhum produto encontrado.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($produtos as $prod): ?>
                                <tr>
                                    <td class="font-mono-num small text-muted"><?= e($prod['codigo']) ?></td>
                                    <td>
                                        <div class="fw-medium"><?= e($prod['nome']) ?></div>
                                        <?php if (!empty($prod['descricao'])): ?>
                                            <div class="small text-muted text-truncate" style="max-width: 260px;"><?= e($prod['descricao']) ?></div>
                                        <?php endif; ?>
                                    </td>
                                    <td class="small"><?= e($prod['categoria_nome']) ?></td>
                                    <td class="small text-muted"><?= e($prod['unidade_medida']) ?></td>
                                    <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($prod['preco'])) ?></td>
                                    <td>
                                        <?php if ((int)$prod['ativo'] === 1): ?>
                                            <span class="erp-status status-entregue">Ativo</span>
                                        <?php else: ?>
                                            <span class="erp-status status-cancelado">Inativo</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="text-end text-nowrap">
                                        <a href="<?= e(url('produtos/index.php?editar=' . (int)$prod['id'])) ?>" class="btn btn-sm btn-outline-primary" title="Editar">
                                            <?= icon('edit', 15) ?>
                                        </a>
                                        <form method="post" action="<?= e(url('produtos/excluir.php')) ?>" class="d-inline" onsubmit="return confirm('Confirma alterar/remover este item?');">
                                            <?= csrf_field() ?>
                                            <input type="hidden" name="id" value="<?= (int)$prod['id'] ?>">
                                            <button type="submit" class="btn btn-sm btn-outline-danger" title="Excluir / Desativar">
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
