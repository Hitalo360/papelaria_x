<?php
/**
 * Menu Lateral Fixo + Menu Mobile Offcanvas - Papelaria X
 */
$menuItems = [
    ['id' => 'dashboard',     'label' => 'Dashboard',     'href' => url('dashboard/index.php'),     'icon' => 'dashboard'],
    ['id' => 'pedidos',       'label' => 'Pedidos',       'href' => url('pedidos/index.php'),       'icon' => 'orders'],
    ['id' => 'novo_pedido',   'label' => 'Novo pedido',   'href' => url('pedidos/novo.php'),        'icon' => 'plus-circle'],
    ['id' => 'clientes',      'label' => 'Clientes',      'href' => url('clientes/index.php'),      'icon' => 'users'],
    ['id' => 'produtos',      'label' => 'Produtos',      'href' => url('produtos/index.php'),      'icon' => 'package'],
    ['id' => 'relatorios',    'label' => 'Relatórios',    'href' => url('relatorios/index.php'),    'icon' => 'chart'],
    ['id' => 'configuracoes', 'label' => 'Configurações', 'href' => url('configuracoes/index.php'), 'icon' => 'settings'],
];
?>

<!-- Sidebar Desktop -->
<aside class="erp-sidebar d-none d-lg-flex flex-column no-print" aria-label="Menu principal">
    <div class="erp-brand">
        <a href="<?= e(url('dashboard/index.php')) ?>" class="erp-brand-link">
            <span class="erp-brand-mark">PX</span>
            <span class="erp-brand-text">Papelaria X</span>
        </a>
    </div>

    <nav class="erp-nav flex-grow-1">
        <?php foreach ($menuItems as $item): ?>
            <?php $isActive = ($activeMenu === $item['id']); ?>
            <a href="<?= e($item['href']) ?>" class="erp-nav-link <?= $isActive ? 'is-active' : '' ?>">
                <?= icon($item['icon'], 18) ?>
                <span><?= e($item['label']) ?></span>
            </a>
        <?php endforeach; ?>
    </nav>

    <div class="erp-sidebar-footer">
        <?php if ($usuarioLogado): ?>
            <div class="erp-user-box">
                <div class="erp-user-name text-truncate"><?= e($usuarioLogado['nome']) ?></div>
                <div class="erp-user-role"><?= $usuarioLogado['perfil'] === 'admin' ? 'Administrador' : 'Atendente' ?></div>
            </div>
        <?php endif; ?>
        <form action="<?= e(url('logout.php')) ?>" method="post" class="mt-2">
            <?= csrf_field() ?>
            <button type="submit" class="erp-nav-link erp-logout-btn w-100 border-0 bg-transparent text-start">
                <?= icon('logout', 18) ?>
                <span>Sair</span>
            </button>
        </form>
    </div>
</aside>

<!-- Sidebar Mobile (Offcanvas) -->
<div class="offcanvas offcanvas-start erp-offcanvas no-print" tabindex="-1" id="mobileSidebar" aria-labelledby="mobileSidebarLabel">
    <div class="offcanvas-header border-bottom border-secondary border-opacity-25">
        <span class="erp-brand-link text-white" id="mobileSidebarLabel">
            <span class="erp-brand-mark">PX</span>
            <span class="erp-brand-text">Papelaria X</span>
        </span>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Fechar"></button>
    </div>
    <div class="offcanvas-body d-flex flex-column p-0">
        <nav class="erp-nav flex-grow-1">
            <?php foreach ($menuItems as $item): ?>
                <?php $isActive = ($activeMenu === $item['id']); ?>
                <a href="<?= e($item['href']) ?>" class="erp-nav-link <?= $isActive ? 'is-active' : '' ?>">
                    <?= icon($item['icon'], 18) ?>
                    <span><?= e($item['label']) ?></span>
                </a>
            <?php endforeach; ?>
        </nav>
        <div class="erp-sidebar-footer">
            <?php if ($usuarioLogado): ?>
                <div class="erp-user-box">
                    <div class="erp-user-name text-truncate"><?= e($usuarioLogado['nome']) ?></div>
                    <div class="erp-user-role"><?= $usuarioLogado['perfil'] === 'admin' ? 'Administrador' : 'Atendente' ?></div>
                </div>
            <?php endif; ?>
            <form action="<?= e(url('logout.php')) ?>" method="post" class="mt-2">
                <?= csrf_field() ?>
                <button type="submit" class="erp-nav-link erp-logout-btn w-100 border-0 bg-transparent text-start">
                    <?= icon('logout', 18) ?>
                    <span>Sair</span>
                </button>
            </form>
        </div>
    </div>
</div>
