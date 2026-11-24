<?php
require_once __DIR__ . '/../includes/auth.php';
$usuarioLogado = require_admin();

$pdo = getPDO();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $acao = $_POST['acao'] ?? 'salvar_configs';

    if ($acao === 'salvar_configs') {
        $chaves = [
            'nome_empresa',
            'telefone_empresa',
            'endereco_empresa',
            'cnpj_empresa',
            'whatsapp_registro',
            'whatsapp_confirmacao',
            'whatsapp_producao',
            'whatsapp_pronto',
            'whatsapp_entregue',
        ];
        $stmt = $pdo->prepare(
            'INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE valor = VALUES(valor)'
        );
        foreach ($chaves as $chave) {
            $valor = trim((string)($_POST[$chave] ?? ''));
            $stmt->execute([$chave, $valor]);
        }
        set_flash('success', 'Configurações e modelos de WhatsApp salvos com sucesso.');
        redirect('configuracoes/index.php');
    } elseif ($acao === 'criar_usuario') {
        $nome   = trim($_POST['novo_nome'] ?? '');
        $email  = mb_strtolower(trim($_POST['novo_email'] ?? ''));
        $senha  = $_POST['nova_senha'] ?? '';
        $perfil = ($_POST['novo_perfil'] ?? 'atendente') === 'admin' ? 'admin' : 'atendente';

        if ($nome === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($senha) < 6) {
            set_flash('danger', 'Informe nome, e-mail válido e senha com pelo menos 6 caracteres.');
            redirect('configuracoes/index.php');
        }

        $dup = $pdo->prepare('SELECT id FROM usuarios WHERE email = ? LIMIT 1');
        $dup->execute([$email]);
        if ($dup->fetch()) {
            set_flash('warning', 'Já existe um usuário com este e-mail.');
            redirect('configuracoes/index.php');
        }

        $hash = password_hash($senha, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 1)');
        $stmt->execute([$nome, $email, $hash, $perfil]);
        set_flash('success', 'Usuário cadastrado com sucesso.');
        redirect('configuracoes/index.php');
    } elseif ($acao === 'alternar_usuario') {
        $uid = (int)($_POST['usuario_id'] ?? 0);
        if ($uid === (int)$usuarioLogado['id']) {
            set_flash('warning', 'Você não pode desativar o seu próprio usuário logado.');
        } elseif ($uid > 0) {
            $pdo->prepare('UPDATE usuarios SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?')->execute([$uid]);
            set_flash('success', 'Situação do usuário atualizada.');
        }
        redirect('configuracoes/index.php');
    }
}

$configs = obter_configuracoes($pdo);
$usuarios = $pdo->query('SELECT id, nome, email, perfil, ativo, ultimo_login FROM usuarios ORDER BY nome ASC')->fetchAll();

$pageTitle = 'Configurações';
$activeMenu = 'configuracoes';
require_once __DIR__ . '/../includes/header.php';
?>

<div class="row g-4">
    <!-- Empresa e Modelos de WhatsApp -->
    <div class="col-12 col-xl-7">
        <form method="post" action="<?= e(url('configuracoes/index.php')) ?>">
            <?= csrf_field() ?>
            <input type="hidden" name="acao" value="salvar_configs">

            <div class="erp-card mb-4">
                <div class="erp-card-header">
                    <h2 class="erp-card-title">Dados da Papelaria</h2>
                </div>
                <div class="erp-card-body">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label fw-medium">Nome da empresa</label>
                            <input type="text" name="nome_empresa" class="form-control" value="<?= e($configs['nome_empresa'] ?? 'Papelaria X') ?>" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-medium">Telefone / WhatsApp da loja</label>
                            <input type="text" name="telefone_empresa" class="form-control mask-telefone" value="<?= e($configs['telefone_empresa'] ?? '') ?>">
                        </div>
                        <div class="col-md-8">
                            <label class="form-label fw-medium">Endereço</label>
                            <input type="text" name="endereco_empresa" class="form-control" value="<?= e($configs['endereco_empresa'] ?? '') ?>">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label fw-medium">CNPJ</label>
                            <input type="text" name="cnpj_empresa" class="form-control font-mono-num" value="<?= e($configs['cnpj_empresa'] ?? '') ?>">
                        </div>
                    </div>
                </div>
            </div>

            <div class="erp-card">
                <div class="erp-card-header">
                    <h2 class="erp-card-title">Modelos de mensagens WhatsApp</h2>
                </div>
                <div class="erp-card-body">
                    <div class="alert alert-light border small mb-3">
                        Variáveis disponíveis: <code>{cliente}</code>, <code>{numero}</code>, <code>{itens}</code>, <code>{total}</code>, <code>{previsao}</code>, <code>{empresa}</code>
                    </div>

                    <div class="mb-3">
                        <label class="form-label fw-medium">1. Registro do pedido</label>
                        <textarea name="whatsapp_registro" class="form-control font-mono-num small" rows="5"><?= e($configs['whatsapp_registro'] ?? '') ?></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-medium">2. Confirmação do pedido</label>
                        <textarea name="whatsapp_confirmacao" class="form-control font-mono-num small" rows="4"><?= e($configs['whatsapp_confirmacao'] ?? '') ?></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-medium">3. Pedido em produção</label>
                        <textarea name="whatsapp_producao" class="form-control font-mono-num small" rows="3"><?= e($configs['whatsapp_producao'] ?? '') ?></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-medium">4. Pedido pronto para retirada</label>
                        <textarea name="whatsapp_pronto" class="form-control font-mono-num small" rows="3"><?= e($configs['whatsapp_pronto'] ?? '') ?></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="form-label fw-medium">5. Pedido entregue</label>
                        <textarea name="whatsapp_entregue" class="form-control font-mono-num small" rows="3"><?= e($configs['whatsapp_entregue'] ?? '') ?></textarea>
                    </div>

                    <button type="submit" class="btn btn-primary fw-semibold">Salvar Configurações</button>
                </div>
            </div>
        </form>
    </div>

    <!-- Usuários do Painel -->
    <div class="col-12 col-xl-5">
        <div class="erp-card mb-4">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Cadastrar usuário da equipe</h2>
            </div>
            <div class="erp-card-body">
                <form method="post" action="<?= e(url('configuracoes/index.php')) ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="acao" value="criar_usuario">

                    <div class="mb-2">
                        <label class="form-label small fw-medium">Nome</label>
                        <input type="text" name="novo_nome" class="form-control form-control-sm" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small fw-medium">E-mail</label>
                        <input type="email" name="novo_email" class="form-control form-control-sm" required>
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label small fw-medium">Senha (mín. 6)</label>
                            <input type="password" name="nova_senha" class="form-control form-control-sm" minlength="6" required>
                        </div>
                        <div class="col-6">
                            <label class="form-label small fw-medium">Perfil</label>
                            <select name="novo_perfil" class="form-select form-select-sm">
                                <option value="atendente">Atendente</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-outline-primary btn-sm w-100 fw-semibold">Criar Usuário</button>
                </form>
            </div>
        </div>

        <div class="erp-card">
            <div class="erp-card-header">
                <h2 class="erp-card-title">Usuários cadastrados</h2>
            </div>
            <div class="table-responsive">
                <table class="table align-middle mb-0 erp-table">
                    <thead>
                        <tr>
                            <th>Nome / E-mail</th>
                            <th>Perfil</th>
                            <th>Situação</th>
                            <th class="text-end">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($usuarios as $u): ?>
                            <tr>
                                <td>
                                    <div class="fw-medium"><?= e($u['nome']) ?></div>
                                    <div class="small text-muted"><?= e($u['email']) ?></div>
                                </td>
                                <td class="small"><?= $u['perfil'] === 'admin' ? 'Admin' : 'Atendente' ?></td>
                                <td>
                                    <?php if ((int)$u['ativo'] === 1): ?>
                                        <span class="erp-status status-entregue">Ativo</span>
                                    <?php else: ?>
                                        <span class="erp-status status-cancelado">Inativo</span>
                                    <?php endif; ?>
                                </td>
                                <td class="text-end">
                                    <?php if ((int)$u['id'] !== (int)$usuarioLogado['id']): ?>
                                        <form method="post" action="<?= e(url('configuracoes/index.php')) ?>" class="d-inline">
                                            <?= csrf_field() ?>
                                            <input type="hidden" name="acao" value="alternar_usuario">
                                            <input type="hidden" name="usuario_id" value="<?= (int)$u['id'] ?>">
                                            <button type="submit" class="btn btn-sm btn-outline-secondary">
                                                <?= (int)$u['ativo'] === 1 ? 'Desativar' : 'Ativar' ?>
                                            </button>
                                        </form>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
