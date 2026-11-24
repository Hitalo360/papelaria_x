<?php
/**
 * Cabeçalho Padrão do Painel Administrativo - Papelaria X
 * Variáveis esperadas: $pageTitle (string), $activeMenu (string), $pageActionHtml (string opcional)
 */
require_once __DIR__ . '/icons.php';

$pageTitle = $pageTitle ?? 'Painel Administrativo';
$activeMenu = $activeMenu ?? 'dashboard';
$usuarioLogado = current_user();
$flashes = get_flashes();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($pageTitle) ?> — Papelaria X</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="<?= e(url('assets/css/app.css')) ?>">
</head>
<body class="erp-body">
<div class="erp-shell">
    <?php require __DIR__ . '/sidebar.php'; ?>

    <div class="erp-main-wrap">
        <header class="erp-topbar no-print">
            <div class="d-flex align-items-center gap-3">
                <button class="btn btn-outline-secondary btn-sm d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-label="Abrir menu">
                    <?= icon('menu', 18) ?>
                </button>
                <div>
                    <h1 class="erp-page-title mb-0"><?= e($pageTitle) ?></h1>
                </div>
            </div>

            <div class="d-flex align-items-center gap-2">
                <?php if (!empty($pageActionHtml)): ?>
                    <?= $pageActionHtml ?>
                <?php else: ?>
                    <a href="<?= e(url('pedidos/novo.php')) ?>" class="btn btn-primary btn-sm d-inline-flex align-items-center gap-2 text-nowrap">
                        <?= icon('plus', 16) ?>
                        <span>Novo Pedido</span>
                    </a>
                <?php endif; ?>
            </div>
        </header>

        <main class="erp-content">
            <?php foreach ($flashes as $flash): ?>
                <div class="alert alert-<?= e($flash['tipo']) ?> alert-dismissible fade show erp-alert no-print" role="alert">
                    <?= e($flash['mensagem']) ?>
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
                </div>
            <?php endforeach; ?>
