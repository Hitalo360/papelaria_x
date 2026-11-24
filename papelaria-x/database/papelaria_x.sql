-- ============================================================================
-- PAPELARIA X - BANCO DE DADOS MYSQL
-- Compatível com MySQL 5.7+ / 8.0+ / MariaDB (InfinityFree / phpMyAdmin)
-- Charset: utf8mb4
-- ============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "-03:00";

/*!40101 SET NAMES utf8mb4 */;

-- ----------------------------------------------------------------------------
-- 1. Tabela de Usuários (Painel Administrativo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(120) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `senha_hash` VARCHAR(255) NOT NULL,
  `perfil` ENUM('admin', 'atendente') NOT NULL DEFAULT 'atendente',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `ultimo_login` DATETIME NULL DEFAULT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Tabela de Clientes (Evita duplicidade por telefone_limpo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `clientes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(150) NOT NULL,
  `telefone` VARCHAR(30) NOT NULL,
  `telefone_limpo` VARCHAR(20) NOT NULL,
  `empresa` VARCHAR(150) NULL DEFAULT NULL,
  `observacoes` TEXT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clientes_telefone_limpo` (`telefone_limpo`),
  KEY `idx_clientes_nome` (`nome`),
  KEY `idx_clientes_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Tabela de Categorias de Produtos e Serviços
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categorias` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `descricao` VARCHAR(255) NULL DEFAULT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categorias_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Tabela de Produtos e Serviços
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `produtos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `categoria_id` INT UNSIGNED NOT NULL,
  `nome` VARCHAR(150) NOT NULL,
  `codigo` VARCHAR(50) NOT NULL,
  `descricao` TEXT NULL,
  `preco` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unidade_medida` VARCHAR(30) NOT NULL DEFAULT 'un',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_produtos_codigo` (`codigo`),
  KEY `idx_produtos_categoria` (`categoria_id`),
  KEY `idx_produtos_nome` (`nome`),
  KEY `idx_produtos_ativo` (`ativo`),
  CONSTRAINT `fk_produtos_categoria`
    FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Tabela de Pedidos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero` VARCHAR(20) NOT NULL,
  `cliente_id` INT UNSIGNED NOT NULL,
  `usuario_id` INT UNSIGNED NULL DEFAULT NULL,
  `data_cadastro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_previsao` DATE NULL DEFAULT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `desconto` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `valor_total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM(
    'aguardando_confirmacao',
    'confirmado',
    'em_producao',
    'pronto_retirada',
    'entregue',
    'cancelado'
  ) NOT NULL DEFAULT 'aguardando_confirmacao',
  `observacoes` TEXT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pedidos_numero` (`numero`),
  KEY `idx_pedidos_cliente` (`cliente_id`),
  KEY `idx_pedidos_usuario` (`usuario_id`),
  KEY `idx_pedidos_status` (`status`),
  KEY `idx_pedidos_data_cadastro` (`data_cadastro`),
  CONSTRAINT `fk_pedidos_cliente`
    FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_pedidos_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Tabela de Itens dos Pedidos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pedido_itens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pedido_id` INT UNSIGNED NOT NULL,
  `produto_id` INT UNSIGNED NULL DEFAULT NULL,
  `descricao_item` VARCHAR(200) NOT NULL,
  `unidade_medida` VARCHAR(30) NOT NULL DEFAULT 'un',
  `quantidade` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `valor_unitario` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_pedido_itens_pedido` (`pedido_id`),
  KEY `idx_pedido_itens_produto` (`produto_id`),
  CONSTRAINT `fk_pedido_itens_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_pedido_itens_produto`
    FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Tabela de Histórico de Status dos Pedidos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pedido_historico` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pedido_id` INT UNSIGNED NOT NULL,
  `usuario_id` INT UNSIGNED NULL DEFAULT NULL,
  `status_anterior` VARCHAR(40) NULL DEFAULT NULL,
  `status_novo` VARCHAR(40) NOT NULL,
  `observacao` VARCHAR(255) NULL DEFAULT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_historico_pedido` (`pedido_id`),
  KEY `idx_historico_usuario` (`usuario_id`),
  CONSTRAINT `fk_historico_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_historico_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. Tabela de Configurações do Sistema e Templates WhatsApp
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `configuracoes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `chave` VARCHAR(100) NOT NULL,
  `valor` TEXT NULL,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_configuracoes_chave` (`chave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- DADOS INICIAIS DE CATEGORIAS, PRODUTOS/SERVIÇOS E CONFIGURAÇÕES
-- ----------------------------------------------------------------------------

INSERT IGNORE INTO `categorias` (`id`, `nome`, `descricao`, `ativo`) VALUES
(1, 'Impressão e Cópias', 'Impressões P&B, coloridas e xerox em diversos formatos', 1),
(2, 'Acabamentos', 'Encadernação espiral, wire-o, plastificação e laminação', 1),
(3, 'Papéis Especiais', 'Papel fotográfico, couchê, vergê e cartolina', 1),
(4, 'Material Escolar', 'Cadernos, canetas, lápis, pastas e itens escolares', 1),
(5, 'Serviços Gráficos', 'Cartões de visita, panfletos, banners e convites', 1),
(6, 'Escritório', 'Resmas de papel, envelopes, etiquetas e suprimentos', 1);

INSERT IGNORE INTO `produtos` (`categoria_id`, `nome`, `codigo`, `descricao`, `preco`, `unidade_medida`, `ativo`) VALUES
(1, 'Impressão preto e branco A4', 'IMP-PB-A4', 'Impressão laser alta definição A4 em papel sulfite 75g', 0.50, 'folha', 1),
(1, 'Impressão colorida A4', 'IMP-COR-A4', 'Impressão jato de tinta / laser colorida A4 em papel 75g/90g', 1.50, 'folha', 1),
(1, 'Xerox simples A4', 'XER-PB-A4', 'Cópia preto e branco frente simples em papel A4', 0.40, 'folha', 1),
(2, 'Encadernação espiral até 100 folhas', 'ENC-ESP-100', 'Encadernação com capa transparente, contracapa preta e espiral', 10.00, 'un', 1),
(2, 'Plastificação A4', 'PLAST-A4', 'Plastificação térmica com polaseal 0,05mm tamanho A4', 8.00, 'un', 1),
(3, 'Papel fotográfico A4 brilhante 180g (impresso)', 'PAP-FOTO-A4', 'Impressão em alta resolução em papel fotográfico glossy 180g', 5.50, 'folha', 1),
(4, 'Caderno universitário 10 matérias', 'MAT-CAD-10M', 'Caderno capa dura 200 folhas pautadas', 24.90, 'un', 1),
(5, 'Cartão de visita 1000 un (4x4 cores)', 'GRAF-CV-1000', 'Couchê 300g com verniz localizado frente e verso', 120.00, 'cento/milheiro', 1);

INSERT IGNORE INTO `configuracoes` (`chave`, `valor`) VALUES
('nome_empresa', 'Papelaria X'),
('telefone_empresa', ''),
('endereco_empresa', ''),
('cnpj_empresa', ''),
('whatsapp_registro', "Olá, {cliente}!\n\nSeu pedido na {empresa} foi registrado!\n\nPedido nº: {numero}\n\nItens:\n{itens}\n\nTotal: {total}\n\nPrevisão de entrega: {previsao}.\n\nObrigado pela preferência!\n{empresa}."),
('whatsapp_confirmacao', "Olá, {cliente}!\n\nConfirmamos o seu pedido nº {numero} na {empresa}.\n\nItens:\n{itens}\n\nValor total: {total}\nPrevisão de entrega: {previsao}.\n\nQualquer dúvida, estamos à disposição!"),
('whatsapp_producao', "Olá, {cliente}!\n\nBoa notícia: o seu pedido nº {numero} já entrou em produção na {empresa}.\n\nPrevisão de entrega: {previsao}.\n\nAssim que estiver pronto, avisaremos por aqui!"),
('whatsapp_pronto', "Olá, {cliente}!\n\nSeu pedido nº {numero} está PRONTO para retirada na {empresa}!\n\nValor total: {total}\n\nAguardamos você!"),
('whatsapp_entregue', "Olá, {cliente}!\n\nConfirmamos a entrega do seu pedido nº {numero}.\n\nMuito obrigado por escolher a {empresa}! Conte sempre conosco.");
