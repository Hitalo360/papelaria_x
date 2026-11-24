<?php
require_once __DIR__ . '/../includes/auth.php';
$usuario = require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('pedidos/index.php');
}

verify_csrf();

$pdo = getPDO();
$pedidoId   = (int)($_POST['pedido_id'] ?? 0);
$novoStatus = trim($_POST['status'] ?? '');
$observacao = trim($_POST['observacao'] ?? '');

$statusValidos = array_keys(status_pedido_lista());
if ($pedidoId <= 0 || !in_array($novoStatus, $statusValidos, true)) {
    set_flash('danger', 'Dados inválidos para alteração de status.');
    redirect('pedidos/index.php');
}

$stmt = $pdo->prepare('SELECT id, status FROM pedidos WHERE id = ? LIMIT 1');
$stmt->execute([$pedidoId]);
$pedido = $stmt->fetch();

if (!$pedido) {
    set_flash('danger', 'Pedido não encontrado.');
    redirect('pedidos/index.php');
}

if ($pedido['status'] === $novoStatus && $observacao === '') {
    set_flash('info', 'O status selecionado já é o status atual deste pedido.');
    redirect('pedidos/visualizar.php?id=' . $pedidoId);
}

try {
    $pdo->beginTransaction();

    $upd = $pdo->prepare('UPDATE pedidos SET status = ? WHERE id = ?');
    $upd->execute([$novoStatus, $pedidoId]);

    $hist = $pdo->prepare(
        'INSERT INTO pedido_historico (pedido_id, usuario_id, status_anterior, status_novo, observacao)
         VALUES (?, ?, ?, ?, ?)'
    );
    $hist->execute([
        $pedidoId,
        $usuario['id'],
        $pedido['status'],
        $novoStatus,
        $observacao !== '' ? $observacao : null,
    ]);

    $pdo->commit();
    set_flash('success', 'Status do pedido atualizado com sucesso.');
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    set_flash('danger', 'Erro ao atualizar status: ' . $e->getMessage());
}

redirect('pedidos/visualizar.php?id=' . $pedidoId);
