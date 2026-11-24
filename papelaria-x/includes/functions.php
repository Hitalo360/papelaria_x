<?php
/**
 * Funções Auxiliares Globais - Papelaria X
 */

if (!defined('APP_ROOT')) {
    define('APP_ROOT', dirname(__DIR__));
}

/**
 * Escapa saída HTML para prevenção de XSS.
 */
function e(mixed $valor): string
{
    return htmlspecialchars((string)($valor ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Calcula automaticamente a URL base da aplicação (funciona em raiz ou subpasta no InfinityFree).
 */
function base_url(): string
{
    static $base = null;
    if ($base !== null) {
        return $base;
    }

    $appRootNorm = str_replace('\\', '/', realpath(APP_ROOT) ?: APP_ROOT);
    $scriptFile  = str_replace('\\', '/', realpath($_SERVER['SCRIPT_FILENAME'] ?? '') ?: ($_SERVER['SCRIPT_FILENAME'] ?? ''));
    $scriptDir   = str_replace('\\', '/', dirname($scriptFile));

    $depth = 0;
    if ($scriptDir !== '' && str_starts_with($scriptDir, $appRootNorm)) {
        $rel = trim(substr($scriptDir, strlen($appRootNorm)), '/');
        if ($rel !== '') {
            $depth = count(explode('/', $rel));
        }
    }

    $urlDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    $urlDir = rtrim($urlDir, '/');

    if ($depth > 0 && $urlDir !== '') {
        $parts = explode('/', trim($urlDir, '/'));
        if (count($parts) >= $depth) {
            $parts = array_slice($parts, 0, count($parts) - $depth);
            $base = count($parts) > 0 ? '/' . implode('/', $parts) : '';
        } else {
            $base = '';
        }
    } else {
        $base = ($urlDir === '' || $urlDir === '.') ? '' : $urlDir;
    }

    return $base;
}

/**
 * Monta URL interna segura.
 */
function url(string $path = ''): string
{
    $clean = ltrim($path, '/');
    $base  = base_url();
    return $base . ($clean === '' ? '/' : '/' . $clean);
}

/**
 * Redireciona para uma rota interna e encerra execução.
 */
function redirect(string $path): never
{
    header('Location: ' . url($path));
    exit;
}

/**
 * Gera ou recupera o token CSRF da sessão atual.
 */
function csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Campo oculto HTML com token CSRF.
 */
function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

/**
 * Valida token CSRF enviado em formulário POST.
 */
function verify_csrf(): void
{
    $sent = $_POST['csrf_token'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if (!is_string($sent) || $expected === '' || !hash_equals($expected, $sent)) {
        http_response_code(403);
        die('Falha na verificação de segurança (CSRF). Recarregue a página e tente novamente.');
    }
}

/**
 * Mensagens flash na sessão.
 */
function set_flash(string $tipo, string $mensagem): void
{
    $_SESSION['flash_messages'][] = [
        'tipo' => $tipo, // success, danger, warning, info
        'mensagem' => $mensagem,
    ];
}

function get_flashes(): array
{
    $msgs = $_SESSION['flash_messages'] ?? [];
    unset($_SESSION['flash_messages']);
    return is_array($msgs) ? $msgs : [];
}

/**
 * Normaliza telefone mantendo apenas dígitos (para evitar duplicidade e montar link wa.me).
 */
function limpar_telefone(string $telefone): string
{
    return preg_replace('/\D+/', '', $telefone) ?? '';
}

/**
 * Formata telefone brasileiro para exibição.
 */
function formatar_telefone(string $telefone): string
{
    $digits = limpar_telefone($telefone);
    if (strlen($digits) === 11) {
        return sprintf('(%s) %s-%s', substr($digits, 0, 2), substr($digits, 2, 5), substr($digits, 7, 4));
    }
    if (strlen($digits) === 10) {
        return sprintf('(%s) %s-%s', substr($digits, 0, 2), substr($digits, 2, 4), substr($digits, 6, 4));
    }
    return $telefone;
}

/**
 * Monta número para link https://wa.me/ adicionando DDI 55 caso não informado.
 */
function telefone_whatsapp(string $telefone): string
{
    $digits = limpar_telefone($telefone);
    $digits = ltrim($digits, '0');
    if (strlen($digits) === 10 || strlen($digits) === 11) {
        return '55' . $digits;
    }
    return $digits;
}

/**
 * Formata valor monetário em Real brasileiro.
 */
function formatar_moeda(float|string|null $valor): string
{
    return 'R$ ' . number_format((float)($valor ?? 0), 2, ',', '.');
}

/**
 * Converte string monetária PT-BR ("1.250,50" ou "1250.50") para float.
 */
function parse_decimal(string $valor): float
{
    $limpo = trim($valor);
    if ($limpo === '') {
        return 0.0;
    }
    if (str_contains($limpo, ',')) {
        $limpo = str_replace('.', '', $limpo);
        $limpo = str_replace(',', '.', $limpo);
    }
    return round((float)$limpo, 2);
}

/**
 * Formata data SQL para DD/MM/AAAA.
 */
function formatar_data(?string $data): string
{
    if (empty($data)) {
        return '-';
    }
    $ts = strtotime($data);
    return $ts ? date('d/m/Y', $ts) : '-';
}

/**
 * Formata data/hora SQL para DD/MM/AAAA HH:MM.
 */
function formatar_data_hora(?string $dataHora): string
{
    if (empty($dataHora)) {
        return '-';
    }
    $ts = strtotime($dataHora);
    return $ts ? date('d/m/Y H:i', $ts) : '-';
}

/**
 * Mapeamento oficial dos status de pedidos.
 */
function status_pedido_lista(): array
{
    return [
        'aguardando_confirmacao' => [
            'label' => 'Aguardando confirmação',
            'badge' => 'status-aguardando',
            'cor'   => '#D97706',
        ],
        'confirmado' => [
            'label' => 'Confirmado',
            'badge' => 'status-confirmado',
            'cor'   => '#2563EB',
        ],
        'em_producao' => [
            'label' => 'Em produção',
            'badge' => 'status-producao',
            'cor'   => '#7C3AED',
        ],
        'pronto_retirada' => [
            'label' => 'Pronto para retirada',
            'badge' => 'status-pronto',
            'cor'   => '#0D9488',
        ],
        'entregue' => [
            'label' => 'Entregue',
            'badge' => 'status-entregue',
            'cor'   => '#16A34A',
        ],
        'cancelado' => [
            'label' => 'Cancelado',
            'badge' => 'status-cancelado',
            'cor'   => '#DC2626',
        ],
    ];
}

function status_pedido_info(string $status): array
{
    $lista = status_pedido_lista();
    return $lista[$status] ?? [
        'label' => ucfirst(str_replace('_', ' ', $status)),
        'badge' => 'status-aguardando',
        'cor'   => '#64748B',
    ];
}

/**
 * Carrega todas as configurações do banco como array associativo.
 */
function obter_configuracoes(PDO $pdo): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $stmt = $pdo->query('SELECT chave, valor FROM configuracoes');
    $rows = $stmt->fetchAll();
    $cache = [];
    foreach ($rows as $row) {
        $cache[$row['chave']] = $row['valor'];
    }
    return $cache;
}

/**
 * Gera próximo número sequencial de pedido (ex: 000001).
 */
function gerar_proximo_numero_pedido(PDO $pdo): string
{
    $stmt = $pdo->query('SELECT MAX(id) AS max_id FROM pedidos');
    $maxId = (int)($stmt->fetchColumn() ?: 0);
    $proximo = $maxId + 1;

    // Garante unicidade caso algum número tenha sido inserido manualmente
    while (true) {
        $candidato = str_pad((string)$proximo, 6, '0', STR_PAD_LEFT);
        $check = $pdo->prepare('SELECT COUNT(*) FROM pedidos WHERE numero = ?');
        $check->execute([$candidato]);
        if ((int)$check->fetchColumn() === 0) {
            return $candidato;
        }
        $proximo++;
    }
}

/**
 * Preenche um modelo de mensagem WhatsApp com os dados reais do pedido.
 */
function montar_mensagem_whatsapp(string $template, array $pedido, array $itens, array $configs): string
{
    $linhasItens = [];
    foreach ($itens as $item) {
        $qtd = rtrim(rtrim(number_format((float)$item['quantidade'], 2, ',', '.'), '0'), ',');
        $linhasItens[] = sprintf(
            '- %sx %s — %s',
            $qtd,
            $item['descricao_item'],
            formatar_moeda($item['subtotal'])
        );
    }

    $empresa = $configs['nome_empresa'] ?? 'Papelaria X';
    $previsao = !empty($pedido['data_previsao']) ? formatar_data($pedido['data_previsao']) : 'A combinar';

    $substituicoes = [
        '{cliente}'  => $pedido['cliente_nome'] ?? '',
        '{numero}'   => $pedido['numero'] ?? '',
        '{itens}'    => implode("\n", $linhasItens),
        '{total}'    => formatar_moeda($pedido['valor_total'] ?? 0),
        '{previsao}' => $previsao,
        '{empresa}'  => $empresa,
    ];

    return str_replace(array_keys($substituicoes), array_values($substituicoes), $template);
}
