<?php
/**
 * Configuração de Conexão MySQL (PDO) - Papelaria X
 * Preencha as constantes abaixo com os dados do seu painel InfinityFree
 * (VistaPanel -> MySQL Databases) antes de enviar ou via Gerenciador de Arquivos.
 */

define('DB_HOST', getenv('PAPELARIA_DB_HOST') ?: '');
define('DB_NAME', getenv('PAPELARIA_DB_NAME') ?: '');
define('DB_USER', getenv('PAPELARIA_DB_USER') ?: '');
define('DB_PASS', getenv('PAPELARIA_DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

date_default_timezone_set('America/Sao_Paulo');

/**
 * Retorna instância única do PDO com Prepared Statements nativos.
 * Lança RuntimeException amigável caso as credenciais não tenham sido configuradas.
 */
function getPDO(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (DB_HOST === '' || DB_NAME === '' || DB_USER === '') {
        throw new RuntimeException(
            'Banco de dados não configurado. Edite o arquivo config/database.php com Host, Nome do Banco, Usuário e Senha do MySQL.'
        );
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    return $pdo;
}
