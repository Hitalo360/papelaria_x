<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('produtos/index.php');
}

verify_csrf();
$pdo = getPDO();
$tipo = $_POST['tipo'] ?? 'produto';

if ($tipo === 'categoria') {
    $nomeCat = trim($_POST['nome_categoria'] ?? '');
    if ($nomeCat === '') {
        set_flash('danger', 'Informe o nome da categoria.');
        redirect('produtos/index.php');
    }
    try {
        $stmt = $pdo->prepare('INSERT INTO categorias (nome, ativo) VALUES (?, 1)');
        $stmt->execute([$nomeCat]);
        set_flash('success', 'Categoria adicionada com sucesso.');
    } catch (Throwable $e) {
        set_flash('warning', 'Categoria já cadastrada ou inválida.');
    }
    redirect('produtos/index.php');
}

$id          = (int)($_POST['id'] ?? 0);
$nome        = trim($_POST['nome'] ?? '');
$codigo      = mb_strtoupper(trim($_POST['codigo'] ?? ''));
$categoriaId = (int)($_POST['categoria_id'] ?? 0);
$unidade     = trim($_POST['unidade_medida'] ?? 'un') ?: 'un';
$preco       = max(0.0, parse_decimal((string)($_POST['preco'] ?? '0')));
$descricao   = trim($_POST['descricao'] ?? '');
$ativo       = isset($_POST['ativo']) ? 1 : 0;

if ($nome === '' || $codigo === '' || $categoriaId <= 0) {
    set_flash('danger', 'Preencha nome, código e categoria do produto.');
    redirect($id > 0 ? 'produtos/index.php?editar=' . $id : 'produtos/index.php');
}

// Verifica duplicidade de código
$stmtDup = $pdo->prepare('SELECT id FROM produtos WHERE codigo = ? AND id <> ? LIMIT 1');
$stmtDup->execute([$codigo, $id]);
if ($stmtDup->fetch()) {
    set_flash('warning', 'Já existe outro produto cadastrado com o código ' . $codigo . '.');
    redirect($id > 0 ? 'produtos/index.php?editar=' . $id : 'produtos/index.php');
}

if ($id > 0) {
    $stmt = $pdo->prepare(
        'UPDATE produtos
         SET categoria_id = ?, nome = ?, codigo = ?, descricao = ?, preco = ?, unidade_medida = ?, ativo = ?
         WHERE id = ?'
    );
    $stmt->execute([
        $categoriaId,
        $nome,
        $codigo,
        $descricao !== '' ? $descricao : null,
        $preco,
        $unidade,
        $ativo,
        $id,
    ]);
    set_flash('success', 'Produto atualizado com sucesso.');
} else {
    $stmt = $pdo->prepare(
        'INSERT INTO produtos (categoria_id, nome, codigo, descricao, preco, unidade_medida, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $categoriaId,
        $nome,
        $codigo,
        $descricao !== '' ? $descricao : null,
        $preco,
        $unidade,
        $ativo,
    ]);
    set_flash('success', 'Produto cadastrado com sucesso.');
}

redirect('produtos/index.php');
