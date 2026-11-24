<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('clientes/index.php');
}

verify_csrf();

$id = (int)($_POST['id'] ?? 0);
if ($id <= 0) {
    redirect('clientes/index.php');
}

$pdo = getPDO();
$stmtCheck = $pdo->prepare('SELECT COUNT(*) FROM pedidos WHERE cliente_id = ?');
$stmtCheck->execute([$id]);
$qtdPedidos = (int)$stmtCheck->fetchColumn();

if ($qtdPedidos > 0) {
    // Preserva histórico fiscal/comercial alternando ativo/inativo
    $stmt = $pdo->prepare('UPDATE clientes SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?');
    $stmt->execute([$id]);
    set_flash('info', 'Cliente possui pedidos vinculados; situação alterada entre ativo/inativo.');
} else {
    $stmt = $pdo->prepare('DELETE FROM clientes WHERE id = ?');
    $stmt->execute([$id]);
    set_flash('success', 'Cliente excluído com sucesso.');
}

redirect('clientes/index.php');
