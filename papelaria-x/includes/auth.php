<?php
/**
 * Controle de Autenticação e Sessão - Papelaria X
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/functions.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

/**
 * Retorna os dados do usuário autenticado ou null.
 */
function current_user(): ?array
{
    return $_SESSION['usuario'] ?? null;
}

/**
 * Verifica se há usuário logado.
 */
function is_logged_in(): bool
{
    return !empty($_SESSION['usuario']['id']);
}

/**
 * Exige autenticação válida no painel administrativo.
 */
function require_auth(): array
{
    if (!is_logged_in()) {
        set_flash('warning', 'Faça login para acessar o sistema.');
        redirect('login.php');
    }

    // Revalida no banco se o usuário continua ativo
    try {
        $pdo = getPDO();
        $stmt = $pdo->prepare('SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ? LIMIT 1');
        $stmt->execute([$_SESSION['usuario']['id']]);
        $user = $stmt->fetch();

        if (!$user || (int)$user['ativo'] !== 1) {
            logout_user();
            redirect('login.php');
        }

        $_SESSION['usuario'] = [
            'id'     => (int)$user['id'],
            'nome'   => $user['nome'],
            'email'  => $user['email'],
            'perfil' => $user['perfil'],
        ];
    } catch (Throwable $e) {
        // Em caso de falha de conexão, redireciona com segurança
        logout_user();
        redirect('login.php');
    }

    return $_SESSION['usuario'];
}

/**
 * Exige perfil de administrador.
 */
function require_admin(): array
{
    $user = require_auth();
    if (($user['perfil'] ?? '') !== 'admin') {
        set_flash('danger', 'Acesso restrito a administradores.');
        redirect('dashboard/index.php');
    }
    return $user;
}

/**
 * Autentica usuário na sessão regenerando o ID contra session fixation.
 */
function login_user(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['usuario'] = [
        'id'     => (int)$user['id'],
        'nome'   => $user['nome'],
        'email'  => $user['email'],
        'perfil' => $user['perfil'],
    ];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

/**
 * Encerra a sessão de forma segura.
 */
function logout_user(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
    session_destroy();
}
