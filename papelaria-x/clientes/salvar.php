<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('clientes/index.php');
}

verify_csrf();

$pdo         = getPDO();
$id          = (int)($_POST['id'] ?? 0);
$nome        = trim($_POST['nome'] ?? '');
$telefone    = trim($_POST['telefone'] ?? '');
$telLimpo    = limpar_telefone($telefone);
$empresa     = trim($_POST['empresa'] ?? '');
$observacoes = trim($_POST['observacoes'] ?? '');
$ativo       = isset($_POST['ativo']) ? 1 : 0;

if ($nome === '' || strlen($telLimpo) < 8) {
    set_flash('danger', 'Informe o nome completo e um telefone válido (mínimo 8 dígitos).');
    redirect($id > 0 ? 'clientes/index.php?editar=' . $id : 'clientes/index.php');
}

// Verifica duplicidade por telefone_limpo
$stmtDup = $pdo->prepare('SELECT id, nome FROM clientes WHERE telefone_limpo = ? AND id <> ? LIMIT 1');
$stmtDup->execute([$telLimpo, $id]);
$duplicado = $stmtDup->fetch();

if ($duplicado) {
    set_flash('warning', 'Já existe um cliente cadastrado com este telefone: ' . $duplicado['nome'] . '.');
    redirect($id > 0 ? 'clientes/index.php?editar=' . $id : 'clientes/index.php');
}

$telFormatado = formatar_telefone($telefone);

if ($id > 0) {
    $stmt = $pdo->prepare(
        'UPDATE clientes
         SET nome = ?, telefone = ?, telefone_limpo = ?, empresa = ?, observacoes = ?, ativo = ?
         WHERE id = ?'
    );
    $stmt->execute([
        $nome,
        $telFormatado,
        $telLimpo,
        $empresa !== '' ? $empresa : null,
        $observacoes !== '' ? $observacoes : null,
        $ativo,
        $id,
    ]);
    set_flash('success', 'Cliente atualizado com sucesso.');
} else {
    $stmt = $pdo->prepare(
        'INSERT INTO clientes (nome, telefone, telefone_limpo, empresa, observacoes, ativo)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $nome,
        $telFormatado,
        $telLimpo,
        $empresa !== '' ? $empresa : null,
        $observacoes !== '' ? $observacoes : null,
        $ativo,
    ]);
    set_flash('success', 'Cliente cadastrado com sucesso.');
}

redirect('clientes/index.php');
