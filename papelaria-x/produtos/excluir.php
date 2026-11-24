<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('produtos/index.php');
}

verify_csrf();
$id = (int)($_POST['id'] ?? 0);
if ($id <= 0) {
    redirect('produtos/index.php');
}

$pdo = getPDO();
$stmtCheck = $pdo->prepare('SELECT COUNT(*) FROM pedido_itens WHERE produto_id = ?');
$stmtCheck->execute([$id]);
$usadoEmPedidos = (int)$stmtCheck->fetchColumn();

if ($usadoEmPedidos > 0) {
    $stmt = $pdo->prepare('UPDATE produtos SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?');
    $stmt->execute([$id]);
    set_flash('info', 'Item utilizado em pedidos anteriores; situação alternada entre ativo/inativo.');
} else {
    $stmt = $pdo->prepare('DELETE FROM produtos WHERE id = ?');
    $stmt->execute([$id]);
    set_flash('success', 'Produto removido com sucesso.');
}

redirect('produtos/index.php');
