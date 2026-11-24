<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();
$configs = obter_configuracoes($pdo);

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) {
    redirect('pedidos/index.php');
}

$stmt = $pdo->prepare(
    "SELECT p.*,
            c.nome AS cliente_nome,
            c.telefone AS cliente_telefone,
            c.telefone_limpo,
            c.empresa AS cliente_empresa,
            c.observacoes AS cliente_obs,
            u.nome AS atendente_nome
     FROM pedidos p
     INNER JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.id = ?
     LIMIT 1"
);
$stmt->execute([$id]);
$pedido = $stmt->fetch();

if (!$pedido) {
    set_flash('danger', 'Pedido não encontrado.');
    redirect('pedidos/index.php');
}

$stmtItens = $pdo->prepare('SELECT * FROM pedido_itens WHERE pedido_id = ? ORDER BY id ASC');
$stmtItens->execute([$id]);
$itens = $stmtItens->fetchAll();

$stmtHist = $pdo->prepare(
    'SELECT h.*, u.nome AS usuario_nome
     FROM pedido_historico h
     LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.pedido_id = ?
     ORDER BY h.criado_em DESC, h.id DESC'
);
$stmtHist->execute([$id]);
$historico = $stmtHist->fetchAll();

$statusInfo = status_pedido_info($pedido['status']);
$waTemplates = [
    'registro'    => montar_mensagem_whatsapp($configs['whatsapp_registro'] ?? '', $pedido, $itens, $configs),
    'confirmacao' => montar_mensagem_whatsapp($configs['whatsapp_confirmacao'] ?? '', $pedido, $itens, $configs),
    'producao'    => montar_mensagem_whatsapp($configs['whatsapp_producao'] ?? '', $pedido, $itens, $configs),
    'pronto'      => montar_mensagem_whatsapp($configs['whatsapp_pronto'] ?? '', $pedido, $itens, $configs),
    'entregue'    => montar_mensagem_whatsapp($configs['whatsapp_entregue'] ?? '', $pedido, $itens, $configs),
];

$mapaModelo = [
    'aguardando_confirmacao' => 'registro',
    'confirmado'             => 'confirmacao',
    'em_producao'            => 'producao',
    'pronto_retirada'        => 'pronto',
    'entregue'               => 'entregue',
];
$modeloInicial = $mapaModelo[$pedido['status']] ?? 'registro';

$pageTitle = 'Pedido #' . $pedido['numero'];
$activeMenu = 'pedidos';
$pageActionHtml = '
<div class="d-flex flex-wrap gap-2">
    <button type="button" class="btn btn-success btn-sm d-inline-flex align-items-center gap-1 btn-open-wa"
        data-cliente="' . e($pedido['cliente_nome']) . '"
        data-telefone-exibicao="' . e(formatar_telefone($pedido['cliente_telefone'])) . '"
        data-telefone-wa="' . e(telefone_whatsapp($pedido['cliente_telefone'])) . '"
        data-modelo-inicial="' . e($modeloInicial) . '"
        data-templates="' . e(json_encode($waTemplates, JSON_UNESCAPED_UNICODE)) . '">
        ' . icon('whatsapp', 15) . '<span>Enviar WhatsApp</span>
    </button>
    <button type="button" onclick="window.print()" class="btn btn-outline-dark btn-sm d-inline-flex align-items-center gap-1">
        ' . icon('printer', 15) . '<span>Imprimir</span>
    </button>
    <a href="' . e(url('pedidos/editar.php?id=' . (int)$pedido['id'])) . '" class="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
        ' . icon('edit', 15) . '<span>Editar</span>
    </a>
    <a href="' . e(url('pedidos/index.php')) . '" class="btn btn-outline-secondary btn-sm">Voltar</a>
</div>';

require_once __DIR__ . '/../includes/header.php';
?>

<div class="row g-4">
    <!-- Detalhes do Pedido (Imprimível) -->
    <div class="col-12 col-lg-8">
        <div class="erp-card mb-4">
            <div class="erp-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <h2 class="erp-card-title mb-1"><?= e($configs['nome_empresa'] ?? 'Papelaria X') ?> — Ordem de Pedido #<?= e($pedido['numero']) ?></h2>
                    <div class="small text-muted">
                        Cadastrado em <?= e(formatar_data_hora($pedido['data_cadastro'])) ?>
                        <?php if (!empty($pedido['atendente_nome'])): ?>
                            · Atendente: <?= e($pedido['atendente_nome']) ?>
                        <?php endif; ?>
                    </div>
                </div>
                <span class="erp-status <?= e($statusInfo['badge']) ?>"><?= e($statusInfo['label']) ?></span>
            </div>

            <div class="erp-card-body">
                <div class="row g-3 pb-3 mb-3 border-bottom">
                    <div class="col-md-6">
                        <div class="small text-muted">Cliente</div>
                        <div class="fw-semibold">
                            <a href="<?= e(url('clientes/visualizar.php?id=' . (int)$pedido['cliente_id'])) ?>" class="text-decoration-none">
                                <?= e($pedido['cliente_nome']) ?>
                            </a>
                        </div>
                        <?php if (!empty($pedido['cliente_empresa'])): ?>
                            <div class="small text-muted"><?= e($pedido['cliente_empresa']) ?></div>
                        <?php endif; ?>
                    </div>
                    <div class="col-md-3">
                        <div class="small text-muted">Telefone / WhatsApp</div>
                        <div class="font-mono-num fw-medium"><?= e(formatar_telefone($pedido['cliente_telefone'])) ?></div>
                    </div>
                    <div class="col-md-3">
                        <div class="small text-muted">Previsão de entrega</div>
                        <div class="font-mono-num fw-medium"><?= e(formatar_data($pedido['data_previsao'])) ?></div>
                    </div>
                    <?php if (!empty($pedido['cliente_obs'])): ?>
                        <div class="col-12">
                            <div class="small text-muted">Observações do cliente: <?= e($pedido['cliente_obs']) ?></div>
                        </div>
                    <?php endif; ?>
                </div>

                <div class="table-responsive mb-3">
                    <table class="table align-middle mb-0 erp-table">
                        <thead>
                            <tr>
                                <th>Produto / Serviço</th>
                                <th class="text-center">Unid.</th>
                                <th class="text-end">Qtd.</th>
                                <th class="text-end">Valor Unit.</th>
                                <th class="text-end">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($itens as $it): ?>
                                <tr>
                                    <td class="fw-medium"><?= e($it['descricao_item']) ?></td>
                                    <td class="text-center small text-muted"><?= e($it['unidade_medida']) ?></td>
                                    <td class="text-end font-mono-num"><?= e(rtrim(rtrim(number_format((float)$it['quantidade'], 2, ',', '.'), '0'), ',')) ?></td>
                                    <td class="text-end font-mono-num"><?= e(formatar_moeda($it['valor_unitario'])) ?></td>
                                    <td class="text-end font-mono-num fw-semibold"><?= e(formatar_moeda($it['subtotal'])) ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <div class="row justify-content-end">
                    <div class="col-12 col-md-5">
                        <div class="d-flex justify-content-between py-1">
                            <span class="text-muted">Subtotal</span>
                            <span class="font-mono-num"><?= e(formatar_moeda($pedido['subtotal'])) ?></span>
                        </div>
                        <div class="d-flex justify-content-between py-1">
                            <span class="text-muted">Desconto</span>
                            <span class="font-mono-num text-danger">- <?= e(formatar_moeda($pedido['desconto'])) ?></span>
                        </div>
                        <div class="d-flex justify-content-between py-2 border-top mt-1 fw-bold fs-5">
                            <span>Total</span>
                            <span class="font-mono-num text-primary"><?= e(formatar_moeda($pedido['valor_total'])) ?></span>
                        </div>
                    </div>
                </div>

                <?php if (!empty($pedido['observacoes'])): ?>
                    <div class="mt-3 pt-3 border-top">
                        <div class="small text-muted mb-1">Observações do pedido</div>
                        <div class="small"><?= nl2br(e($pedido['observacoes'])) ?></div>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Coluna Lateral: Alterar Status + Histórico + Excluir -->
    <div class="col-12 col-lg-4 no-print">
        <div class="erp-card mb-4">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Atualizar status</h2>
            </div>
            <div class="erp-card-body">
                <form method="post" action="<?= e(url('pedidos/alterar_status.php')) ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="pedido_id" value="<?= (int)$pedido['id'] ?>">

                    <div class="mb-3">
                        <label for="novo_status" class="form-label fw-medium">Situação atual</label>
                        <select id="novo_status" name="status" class="form-select">
                            <?php foreach (status_pedido_lista() as $chave => $meta): ?>
                                <option value="<?= e($chave) ?>" <?= $pedido['status'] === $chave ? 'selected' : '' ?>>
                                    <?= e($meta['label']) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label for="obs_status" class="form-label fw-medium">Observação da alteração (opcional)</label>
                        <input type="text" id="obs_status" name="observacao" class="form-control" placeholder="Ex: Arte aprovada pelo cliente">
                    </div>

                    <button type="submit" class="btn btn-primary w-100">Salvar Novo Status</button>
                </form>
            </div>
        </div>

        <div class="erp-card mb-4">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Histórico de alterações</h2>
            </div>
            <div class="erp-card-body">
                <?php if (empty($historico)): ?>
                    <div class="small text-muted">Sem registros de alteração.</div>
                <?php else: ?>
                    <?php foreach ($historico as $h): ?>
                        <?php $novoMeta = status_pedido_info($h['status_novo']); ?>
                        <div class="erp-timeline-item">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="erp-status <?= e($novoMeta['badge']) ?>"><?= e($novoMeta['label']) ?></span>
                                <span class="font-mono-num small text-muted"><?= e(formatar_data_hora($h['criado_em'])) ?></span>
                            </div>
                            <?php if (!empty($h['observacao'])): ?>
                                <div class="small text-dark"><?= e($h['observacao']) ?></div>
                            <?php endif; ?>
                            <div class="small text-muted">
                                Por: <?= e($h['usuario_nome'] ?? 'Sistema') ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <?php if ((current_user()['perfil'] ?? '') === 'admin'): ?>
            <div class="erp-card">
                <div class="erp-card-body d-flex justify-content-between align-items-center">
                    <span class="small text-muted">Remover pedido permanentemente</span>
                    <form method="post" action="<?= e(url('pedidos/excluir.php')) ?>" onsubmit="return confirm('Tem certeza que deseja excluir este pedido permanentemente?');">
                        <?= csrf_field() ?>
                        <input type="hidden" name="id" value="<?= (int)$pedido['id'] ?>">
                        <button type="submit" class="btn btn-outline-danger btn-sm">Excluir</button>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>
</div>

<?php if (isset($_GET['print']) && $_GET['print'] === '1'): ?>
<script>
window.addEventListener('load', function () { window.print(); });
</script>
<?php endif; ?>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
