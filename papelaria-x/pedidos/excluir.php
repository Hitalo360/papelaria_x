<?php
require_once __DIR__ . '/../includes/auth.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('pedidos/index.php');
}

verify_csrf();

$id = (int)($_POST['id'] ?? 0);
if ($id <= 0) {
    redirect('pedidos/index.php');
}

$pdo = getPDO();
$stmt = $pdo->prepare('DELETE FROM pedidos WHERE id = ?');
$stmt->execute([$id]);

set_flash('success', 'Pedido removido com sucesso.');
redirect('pedidos/index.php');
