<?php
require_once __DIR__ . '/includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    logout_user();
    session_start();
    set_flash('info', 'Você saiu do sistema com segurança.');
}

redirect('login.php');
