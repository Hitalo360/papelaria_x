<?php
require_once __DIR__ . '/includes/auth.php';

if (is_logged_in()) {
    redirect('dashboard/index.php');
}

$erro = '';
$dbErro = '';
$precisaCriarAdmin = false;

try {
    $pdo = getPDO();
    $totalUsuarios = (int)$pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();
    $precisaCriarAdmin = ($totalUsuarios === 0);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        verify_csrf();
        $acao = $_POST['acao'] ?? 'login';

        if ($acao === 'criar_primeiro_admin') {
            // Garante atomicamente que só funciona se ainda não houver usuários
            $totalAtual = (int)$pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();
            if ($totalAtual > 0) {
                $erro = 'Já existe um administrador cadastrado. Faça login normalmente.';
                $precisaCriarAdmin = false;
            } else {
                $nome = trim($_POST['nome'] ?? '');
                $email = mb_strtolower(trim($_POST['email'] ?? ''));
                $senha = $_POST['senha'] ?? '';
                $confirmacao = $_POST['confirmar_senha'] ?? '';

                if ($nome === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $erro = 'Informe um nome e um e-mail válidos.';
                } elseif (strlen($senha) < 6) {
                    $erro = 'A senha deve ter pelo menos 6 caracteres.';
                } elseif ($senha !== $confirmacao) {
                    $erro = 'A confirmação de senha não confere.';
                } else {
                    $hash = password_hash($senha, PASSWORD_DEFAULT);
                    $stmt = $pdo->prepare(
                        "INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, 'admin', 1)"
                    );
                    $stmt->execute([$nome, $email, $hash]);
                    $novoId = (int)$pdo->lastInsertId();

                    login_user([
                        'id'     => $novoId,
                        'nome'   => $nome,
                        'email'  => $email,
                        'perfil' => 'admin',
                    ]);
                    set_flash('success', 'Administrador inicial criado com sucesso! Bem-vindo ao sistema da Papelaria X.');
                    redirect('dashboard/index.php');
                }
            }
        } else {
            $email = mb_strtolower(trim($_POST['email'] ?? ''));
            $senha = $_POST['senha'] ?? '';

            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $senha === '') {
                $erro = 'Informe seu e-mail e senha para entrar.';
            } else {
                $stmt = $pdo->prepare(
                    'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ? LIMIT 1'
                );
                $stmt->execute([$email]);
                $usuario = $stmt->fetch();

                if (!$usuario || !password_verify($senha, $usuario['senha_hash'])) {
                    $erro = 'E-mail ou senha inválidos.';
                } elseif ((int)$usuario['ativo'] !== 1) {
                    $erro = 'Este usuário está desativado. Procure o administrador.';
                } else {
                    $upd = $pdo->prepare('UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?');
                    $upd->execute([$usuario['id']]);

                    login_user($usuario);
                    redirect('dashboard/index.php');
                }
            }
        }
    }
} catch (Throwable $e) {
    $dbErro = $e->getMessage();
}

$flashes = get_flashes();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $precisaCriarAdmin ? 'Configuração Inicial' : 'Login' ?> — Papelaria X</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="<?= e(url('assets/css/app.css')) ?>">
</head>
<body class="erp-login-body">
<div class="container py-5">
    <div class="row justify-content-center align-items-center min-vh-100">
        <div class="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
            <div class="erp-login-card p-4 p-md-5 bg-white">
                <div class="d-flex align-items-center gap-3 mb-4">
                    <div class="erp-brand-mark erp-brand-mark-lg">PX</div>
                    <div>
                        <h1 class="h4 fw-bold mb-0">Papelaria X</h1>
                        <p class="text-muted small mb-0">Sistema Administrativo de Pedidos</p>
                    </div>
                </div>

                <?php foreach ($flashes as $flash): ?>
                    <div class="alert alert-<?= e($flash['tipo']) ?> small py-2"><?= e($flash['mensagem']) ?></div>
                <?php endforeach; ?>

                <?php if ($dbErro !== ''): ?>
                    <div class="alert alert-danger small">
                        <strong>Erro de conexão com o MySQL:</strong><br>
                        <?= e($dbErro) ?>
                        <hr class="my-2">
                        <span class="text-muted">Verifique o arquivo <code>config/database.php</code> e confirme se o script <code>database/papelaria_x.sql</code> foi importado no phpMyAdmin.</span>
                    </div>
                <?php endif; ?>

                <?php if ($erro !== ''): ?>
                    <div class="alert alert-danger small py-2"><?= e($erro) ?></div>
                <?php endif; ?>

                <?php if ($precisaCriarAdmin && $dbErro === ''): ?>
                    <div class="alert alert-info small py-2 mb-3">
                        <strong>Primeiro acesso detectado:</strong> cadastre abaixo o usuário administrador principal do sistema.
                    </div>
                    <form method="post" action="<?= e(url('login.php')) ?>" autocomplete="off">
                        <?= csrf_field() ?>
                        <input type="hidden" name="acao" value="criar_primeiro_admin">

                        <div class="mb-3">
                            <label for="nome" class="form-label fw-medium">Nome completo</label>
                            <input type="text" id="nome" name="nome" class="form-control" required autofocus value="<?= e($_POST['nome'] ?? '') ?>">
                        </div>

                        <div class="mb-3">
                            <label for="email" class="form-label fw-medium">E-mail do administrador</label>
                            <input type="email" id="email" name="email" class="form-control" required value="<?= e($_POST['email'] ?? '') ?>">
                        </div>

                        <div class="mb-3">
                            <label for="senha" class="form-label fw-medium">Senha (mín. 6 caracteres)</label>
                            <input type="password" id="senha" name="senha" class="form-control" minlength="6" required>
                        </div>

                        <div class="mb-4">
                            <label for="confirmar_senha" class="form-label fw-medium">Confirmar senha</label>
                            <input type="password" id="confirmar_senha" name="confirmar_senha" class="form-control" minlength="6" required>
                        </div>

                        <button type="submit" class="btn btn-primary w-100 fw-semibold py-2">
                            Criar Administrador e Entrar
                        </button>
                    </form>
                <?php elseif ($dbErro === ''): ?>
                    <form method="post" action="<?= e(url('login.php')) ?>">
                        <?= csrf_field() ?>
                        <input type="hidden" name="acao" value="login">

                        <div class="mb-3">
                            <label for="email" class="form-label fw-medium">E-mail</label>
                            <input type="email" id="email" name="email" class="form-control" required autofocus placeholder="seu@email.com" value="<?= e($_POST['email'] ?? '') ?>">
                        </div>

                        <div class="mb-4">
                            <label for="senha" class="form-label fw-medium">Senha</label>
                            <input type="password" id="senha" name="senha" class="form-control" required placeholder="••••••••">
                        </div>

                        <button type="submit" class="btn btn-primary w-100 fw-semibold py-2">
                            Entrar no Sistema
                        </button>
                    </form>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
</body>
</html>
