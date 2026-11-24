<?php
require_once __DIR__ . '/../includes/auth.php';
require_auth();

$pdo = getPDO();

$tipo       = trim($_GET['tipo'] ?? 'pedidos');
$dataInicio = trim($_GET['data_inicio'] ?? date('Y-m-01'));
$dataFim    = trim($_GET['data_fim'] ?? date('Y-m-d'));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataInicio)) {
    $dataInicio = date('Y-m-01');
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataFim)) {
    $dataFim = date('Y-m-d');
}

$filename = sprintf('papelaria_x_%s_%s_a_%s.csv', $tipo, $dataInicio, $dataFim);

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$out = fopen('php://output', 'w');
// BOM UTF-8 para abrir acentos corretamente no Microsoft Excel
fwrite($out, "\xEF\xBB\xBF");

if ($tipo === 'produtos') {
    fputcsv($out, ['Produto / Serviço', 'Quantidade Total', 'Qtd. Pedidos', 'Valor Total (R$)'], ';');

    $stmt = $pdo->prepare(
        "SELECT pi.descricao_item,
                SUM(pi.quantidade) AS total_qtd,
                COUNT(DISTINCT pi.pedido_id) AS total_pedidos,
                COALESCE(SUM(pi.subtotal), 0) AS total_valor
         FROM pedido_itens pi
         INNER JOIN pedidos p ON p.id = pi.pedido_id
         WHERE DATE(p.data_cadastro) BETWEEN ? AND ?
           AND p.status <> 'cancelado'
         GROUP BY pi.descricao_item
         ORDER BY total_qtd DESC"
    );
    $stmt->execute([$dataInicio, $dataFim]);
    foreach ($stmt->fetchAll() as $row) {
        fputcsv($out, [
            $row['descricao_item'],
            number_format((float)$row['total_qtd'], 2, ',', '.'),
            (int)$row['total_pedidos'],
            number_format((float)$row['total_valor'], 2, ',', '.'),
        ], ';');
    }
} elseif ($tipo === 'clientes') {
    fputcsv($out, ['Cliente', 'Telefone', 'Qtd. Pedidos', 'Total Compras (R$)'], ';');

    $stmt = $pdo->prepare(
        "SELECT c.nome, c.telefone,
                COUNT(p.id) AS total_pedidos,
                COALESCE(SUM(p.valor_total), 0) AS total_gasto
         FROM pedidos p
         INNER JOIN clientes c ON c.id = p.cliente_id
         WHERE DATE(p.data_cadastro) BETWEEN ? AND ?
           AND p.status <> 'cancelado'
         GROUP BY c.id, c.nome, c.telefone
         ORDER BY total_gasto DESC"
    );
    $stmt->execute([$dataInicio, $dataFim]);
    foreach ($stmt->fetchAll() as $row) {
        fputcsv($out, [
            $row['nome'],
            formatar_telefone($row['telefone']),
            (int)$row['total_pedidos'],
            number_format((float)$row['total_gasto'], 2, ',', '.'),
        ], ';');
    }
} else {
    fputcsv($out, ['Número', 'Data Cadastro', 'Previsão Entrega', 'Cliente', 'Telefone', 'Subtotal (R$)', 'Desconto (R$)', 'Valor Total (R$)', 'Status'], ';');

    $stmt = $pdo->prepare(
        "SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone
         FROM pedidos p
         INNER JOIN clientes c ON c.id = p.cliente_id
         WHERE DATE(p.data_cadastro) BETWEEN ? AND ?
         ORDER BY p.data_cadastro DESC"
    );
    $stmt->execute([$dataInicio, $dataFim]);
    foreach ($stmt->fetchAll() as $row) {
        $st = status_pedido_info($row['status']);
        fputcsv($out, [
            $row['numero'],
            formatar_data_hora($row['data_cadastro']),
            formatar_data($row['data_previsao']),
            $row['cliente_nome'],
            formatar_telefone($row['cliente_telefone']),
            number_format((float)$row['subtotal'], 2, ',', '.'),
            number_format((float)$row['desconto'], 2, ',', '.'),
            number_format((float)$row['valor_total'], 2, ',', '.'),
            $st['label'],
        ], ';');
    }
}

fclose($out);
exit;
