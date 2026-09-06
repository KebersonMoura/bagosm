-- ==============================================================================
-- DATABASE CREATION SCRIPT FOR BAGÔ SANDUÍCHES E SALADAS
-- Target Database: MySQL 5.7+ / 8.0+ / MariaDB
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `bago_restaurant` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `bago_restaurant`;

-- Disable Foreign Key checks for clean table drop/re-creation
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `cash_transactions`;
DROP TABLE IF EXISTS `cash_register_sessions`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `ready_products`;
DROP TABLE IF EXISTS `step_options`;
DROP TABLE IF EXISTS `customizer_steps`;
DROP TABLE IF EXISTS `ingredients`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `store_settings`;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE (Usuários do sistema / Funcionários / Admin)
-- ------------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `role` ENUM('admin', 'cozinha', 'balcao') NOT NULL DEFAULT 'balcao',
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. INGREDIENTS TABLE (Estoque & Ingredientes)
-- ------------------------------------------------------------------------------
CREATE TABLE `ingredients` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `category` ENUM('bread', 'protein', 'cheese', 'vegetable', 'sauce', 'extra', 'drink_cookie') NOT NULL,
  `stock` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `min_stock` DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  `unit` VARCHAR(20) NOT NULL DEFAULT 'unidades',
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `image` VARCHAR(500) DEFAULT NULL,
  `track_stock` TINYINT(1) NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. CUSTOMIZER STEPS TABLE (Etapas do Montador de Sanduíche/Salada)
-- ------------------------------------------------------------------------------
CREATE TABLE `customizer_steps` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `step_order` INT NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `allowed_items_json` JSON DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. STEP OPTIONS TABLE (Opções específicas de etapas)
-- ------------------------------------------------------------------------------
CREATE TABLE `step_options` (
  `id` VARCHAR(50) NOT NULL,
  `step_id` INT NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `value` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `price_add` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_step_options_step` FOREIGN KEY (`step_id`) REFERENCES `customizer_steps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. READY PRODUCTS TABLE (Produtos Prontos / Lanches do Cardápio / Saladas Prontas)
-- ------------------------------------------------------------------------------
CREATE TABLE `ready_products` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `original_price` DECIMAL(10,2) DEFAULT NULL,
  `is_popular` TINYINT(1) NOT NULL DEFAULT 0,
  `is_promo` TINYINT(1) NOT NULL DEFAULT 0,
  `badge_text` VARCHAR(50) DEFAULT NULL,
  `image` VARCHAR(500) DEFAULT NULL,
  `category` ENUM('sandwich', 'salad', 'addon', 'drink', 'cookie', 'other') NOT NULL DEFAULT 'sandwich',
  `display_section` ENUM('destaques', 'promocao', 'cardapio', 'all') NOT NULL DEFAULT 'cardapio',
  `linked_ingredient_id` VARCHAR(50) DEFAULT NULL,
  `sandwich_config_json` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ready_products_ingredient` FOREIGN KEY (`linked_ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. ORDERS TABLE (Pedidos de Clientes / Balcão)
-- ------------------------------------------------------------------------------
CREATE TABLE `orders` (
  `id` VARCHAR(50) NOT NULL,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_phone` VARCHAR(30) DEFAULT NULL,
  `total_price` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pendente', 'preparo', 'finalizado', 'entregue', 'cancelado') NOT NULL DEFAULT 'pendente',
  `estimated_minutes` INT NOT NULL DEFAULT 15,
  `delivery_type` ENUM('retirada', 'entrega') NOT NULL DEFAULT 'retirada',
  `delivery_address` TEXT DEFAULT NULL,
  `customer_type` ENUM('cliente', 'funcionario') NOT NULL DEFAULT 'cliente',
  `payment_method` ENUM('debito', 'credito', 'pix', 'dinheiro') DEFAULT NULL,
  `cash_received` DECIMAL(10,2) DEFAULT NULL,
  `change_amount` DECIMAL(10,2) DEFAULT NULL,
  `need_change` TINYINT(1) DEFAULT 0,
  `change_for_amount` DECIMAL(10,2) DEFAULT NULL,
  `print_receipt` TINYINT(1) DEFAULT 0,
  `is_pos_order` TINYINT(1) DEFAULT 0,
  `table_number` VARCHAR(20) DEFAULT NULL,
  `card_provider` VARCHAR(50) DEFAULT NULL,
  `machine_model` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. ORDER ITEMS TABLE (Itens dos Pedidos)
-- ------------------------------------------------------------------------------
CREATE TABLE `order_items` (
  `id` VARCHAR(50) NOT NULL,
  `order_id` VARCHAR(50) NOT NULL,
  `product_name` VARCHAR(150) DEFAULT NULL,
  `is_ready_product` TINYINT(1) NOT NULL DEFAULT 0,
  `price` DECIMAL(10,2) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `sandwich_details_json` JSON DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. CASH REGISTER SESSIONS TABLE (Caixa PDV / Fechamento de Caixa)
-- ------------------------------------------------------------------------------
CREATE TABLE `cash_register_sessions` (
  `id` VARCHAR(50) NOT NULL,
  `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `opened_by` VARCHAR(100) NOT NULL,
  `initial_cash` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  `closed_at` DATETIME DEFAULT NULL,
  `closed_by` VARCHAR(100) DEFAULT NULL,
  `expected_cash_in_drawer` DECIMAL(10,2) DEFAULT 0.00,
  `actual_cash_in_drawer` DECIMAL(10,2) DEFAULT 0.00,
  `cash_difference` DECIMAL(10,2) DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. CASH TRANSACTIONS TABLE (Movimentações Financeiras / Sangria / Suprimento)
-- ------------------------------------------------------------------------------
CREATE TABLE `cash_transactions` (
  `id` VARCHAR(50) NOT NULL,
  `session_id` VARCHAR(50) NOT NULL,
  `type` ENUM('opening', 'sale', 'suprimento', 'sangria') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `payment_method` VARCHAR(30) DEFAULT NULL,
  `order_id` VARCHAR(50) DEFAULT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cash_trans_session` FOREIGN KEY (`session_id`) REFERENCES `cash_register_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. STORE SETTINGS TABLE (Configurações Gerais da Loja)
-- ------------------------------------------------------------------------------
CREATE TABLE `store_settings` (
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ==============================================================================
-- INSERÇÃO DE DADOS INICIAIS / DADOS DE SEED (RESTAURANTE BAGÔ)
-- ==============================================================================

-- 1. USUÁRIOS
INSERT INTO `users` (`id`, `username`, `name`, `role`, `password_hash`) VALUES
('usr-admin', 'admin', 'Administrador Bagô', 'admin', 'admin123'),
('usr-cozinha', 'cozinha', 'Equipe da Cozinha', 'cozinha', 'cozinha123'),
('usr-balcao', 'balcao', 'Atendimento Balcão', 'balcao', 'balcao123');

-- 2. INGREDIENTES
INSERT INTO `ingredients` (`id`, `name`, `category`, `stock`, `min_stock`, `unit`, `price`, `image`) VALUES
-- Pães
('pao-italiano', 'Italiano Integral', 'bread', 120.00, 20.00, 'unidades', 0.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80'),
('pao-3-queijos', 'Três Queijos', 'bread', 80.00, 15.00, 'unidades', 2.00, 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&auto=format&fit=crop&q=80'),
('pao-parmesao', 'Parmesão e Orégano', 'bread', 100.00, 15.00, 'unidades', 2.00, 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&auto=format&fit=crop&q=80'),
('pao-9-graos', 'Nove Grãos', 'bread', 90.00, 15.00, 'unidades', 0.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80'),

-- Proteínas
('prot-frango-teriyaki', 'Frango Teriyaki', 'protein', 50.00, 10.00, 'porções', 14.50, 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&auto=format&fit=crop&q=80'),
('prot-carne-defumada', 'Carne Defumada (Costela)', 'protein', 40.00, 8.00, 'porções', 17.00, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80'),
('prot-bife-carne', 'Bife de Carne', 'protein', 45.00, 10.00, 'porções', 16.00, 'https://images.unsplash.com/photo-1558030006-450675393462?w=400&auto=format&fit=crop&q=80'),
('prot-atum', 'Atum Cremoso', 'protein', 30.00, 5.00, 'porções', 13.50, 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&auto=format&fit=crop&q=80'),
('prot-vegano', 'Falafel Vegano', 'protein', 35.00, 5.00, 'porções', 12.00, 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=400&auto=format&fit=crop&q=80'),

-- Queijos
('queijo-prato', 'Queijo Prato', 'cheese', 150.00, 30.00, 'fatias', 0.00, 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&auto=format&fit=crop&q=80'),
('queijo-cheddar', 'Cheddar Cremoso', 'cheese', 120.00, 25.00, 'fatias', 1.50, 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&auto=format&fit=crop&q=80'),
('queijo-suico', 'Suíço', 'cheese', 80.00, 15.00, 'fatias', 1.50, 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&auto=format&fit=crop&q=80'),
('queijo-nenhum', 'Sem Queijo', 'cheese', 9999.00, 0.00, 'porções', 0.00, NULL),

-- Vegetais
('veg-alface', 'Alface Americana', 'vegetable', 200.00, 30.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=400&auto=format&fit=crop&q=80'),
('veg-tomate', 'Tomate Fatiado', 'vegetable', 180.00, 25.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&auto=format&fit=crop&q=80'),
('veg-pepino', 'Pepino', 'vegetable', 150.00, 20.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400&auto=format&fit=crop&q=80'),
('veg-cebola', 'Cebola Roxa', 'vegetable', 140.00, 15.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?w=400&auto=format&fit=crop&q=80'),
('veg-azeitona', 'Azeitona Preta', 'vegetable', 120.00, 10.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1563822249510-04678c787311?w=400&auto=format&fit=crop&q=80'),
('veg-picles', 'Picles', 'vegetable', 100.00, 10.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=400&auto=format&fit=crop&q=80'),

-- Molhos
('molho-maionese', 'Maionese Bagô', 'sauce', 300.00, 30.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&auto=format&fit=crop&q=80'),
('molho-mostarda-mel', 'Mostarda e Mel', 'sauce', 250.00, 25.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80'),
('molho-barbecue', 'Barbecue Defumado', 'sauce', 250.00, 25.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=400&auto=format&fit=crop&q=80'),
('molho-chipotle', 'Chipotle Picante', 'sauce', 200.00, 20.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80'),
('molho-parmesao', 'Parmesão', 'sauce', 180.00, 15.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&auto=format&fit=crop&q=80'),
('molho-azeite', 'Azeite de Oliva', 'sauce', 400.00, 40.00, 'porções', 0.00, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80'),

-- Adicionais
('ext-bacon', 'Bacon Crocante', 'extra', 60.00, 10.00, 'fatias', 5.00, 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=400&auto=format&fit=crop&q=80'),
('ext-cream-cheese', 'Cream Cheese', 'extra', 50.00, 8.00, 'porções', 4.00, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80'),
('ext-dobro-queijo', 'Dobro de Queijo', 'extra', 100.00, 15.00, 'fatias', 3.00, 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&auto=format&fit=crop&q=80'),
('ext-pepperoni', 'Pepperoni', 'extra', 70.00, 10.00, 'fatias', 4.50, 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400&auto=format&fit=crop&q=80'),

-- Bebidas e Sobremesas
('sob-coca', 'Coca-Cola Lata', 'drink_cookie', 100.00, 15.00, 'unidades', 6.50, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80'),
('sob-guarana', 'Guaraná Antarctica', 'drink_cookie', 85.00, 15.00, 'unidades', 6.00, 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&auto=format&fit=crop&q=80'),
('sob-agua', 'Água Mineral', 'drink_cookie', 120.00, 10.00, 'unidades', 4.00, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80'),
('sob-cookie-choc', 'Cookie Triple Chocolate', 'drink_cookie', 60.00, 10.00, 'unidades', 5.50, 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80'),
('sob-cookie-macadamia', 'Cookie Macadâmia', 'drink_cookie', 40.00, 8.00, 'unidades', 6.00, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80');

-- 3. ETAPAS DO MONTADOR
INSERT INTO `customizer_steps` (`step_order`, `name`, `description`, `is_active`) VALUES
(1, 'Tipo e Pão', 'Escolha entre Sanduíche no pão ou Salada na Tigela.', 1),
(2, 'Tamanho / Porção', 'Escolha o tamanho do seu Bagô (15cm ou 30cm) ou porção da Salada.', 1),
(3, 'Proteína Principal', 'Escolha o recheio de proteína que irá compor o pedido.', 1),
(4, 'Queijo Fatiado', 'Selecione o queijo de sua preferência.', 1),
(5, 'Tostar / Aquecer', 'Informe se deseja o pão tostado e queijo derretido.', 1),
(6, 'Vegetais e Saladas', 'Escolha quantos vegetais frescos quiser.', 1),
(7, 'Molhos Bagô', 'Selecione os molhos saborosos.', 1),
(8, 'Adicionais Extras', 'Deseja adicionar bacon, cream cheese ou pepperoni?', 1),
(9, 'Bebidas e Cookies', 'Acompanhe seu pedido com bebida gelada ou cookie quente.', 1),
(10, 'Resumo e Finalização', 'Revise o pedido e informe o nome para retirada.', 1);

-- 4. PRODUTOS PRONTOS DO CARDÁPIO
INSERT INTO `ready_products` (`id`, `name`, `description`, `price`, `original_price`, `is_popular`, `is_promo`, `badge_text`, `image`, `category`, `display_section`) VALUES
('prod-teriyaki-combo', 'Combo Teriyaki Supremo', 'Sanduíche Frango Teriyaki 15cm + Coca-Cola Lata + Cookie Triple Chocolate.', 32.90, 39.00, 1, 1, 'Super Oferta', 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80', 'sandwich', 'destaques'),
('prod-costela-bbq', 'Bagô Costela BBQ Defumada', 'Sanduíche de Costela bovina defumada, queijo cheddar derretido e molho barbecue.', 28.50, 32.00, 1, 0, 'Mais Vendido', 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=500&auto=format&fit=crop&q=80', 'sandwich', 'cardapio'),
('prod-salada-fit', 'Salada Bagô Frango Teriyaki (500g)', 'Tigela repleta de vegetais frescos, frango teriyaki suculento e molho mostarda e mel.', 26.00, NULL, 1, 0, 'Saudável', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80', 'salad', 'cardapio'),
('prod-salada-falafel', 'Salada Vegana Falafel (500g)', 'Tigela de vegetais com Falafel vegano, azeitona preta, picles e azeite de oliva.', 24.50, NULL, 0, 0, '100% Vegano', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80', 'salad', 'cardapio'),
('prod-cookie-choc', 'Cookie Triple Chocolate Bagô', 'Cookie quentinho com gotas de chocolate ao leite, amargo e branco.', 5.50, NULL, 1, 0, 'Sobremesa', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80', 'cookie', 'all');

-- 5. CONFIGURAÇÕES DA LOJA
INSERT INTO `store_settings` (`setting_key`, `setting_value`) VALUES
('store_name', 'Bagô Sanduíches e Saladas'),
('store_is_open', 'true'),
('estimated_prep_time_minutes', '15'),
('delivery_fee_fixed', '5.00'),
('accept_pickup', 'true'),
('accept_delivery', 'true');

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================
