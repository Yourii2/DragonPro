-- Performance optimization indexes for high-traffic tables in DragonPro
-- These indexes drastically speed up Dashboard, Reports, Sales, and CRM lookups.

-- 1. Orders table indexes (Critical for Dashboard & Sales filtering)
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_created_at');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `orders` ADD INDEX `idx_orders_created_at` (`created_at`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_status');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `orders` ADD INDEX `idx_orders_status` (`status`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_status_created');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `orders` ADD INDEX `idx_orders_status_created` (`status`, `created_at`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_customer_created');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `orders` ADD INDEX `idx_orders_customer_created` (`customer_id`, `created_at`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_rep_status');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `orders` ADD INDEX `idx_orders_rep_status` (`rep_id`, `status`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Transactions table indexes (Critical for Financial Reports & Treasury balance lookups)
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_date');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `transactions` ADD INDEX `idx_transactions_date` (`transaction_date`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_type_date');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `transactions` ADD INDEX `idx_transactions_type_date` (`type`, `transaction_date`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_related');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `transactions` ADD INDEX `idx_transactions_related` (`related_to_type`, `related_to_id`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_treasury_date');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `transactions` ADD INDEX `idx_transactions_treasury_date` (`treasury_id`, `transaction_date`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Product Movements table indexes (Critical for Stock history & Inventory reports)
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_movements' AND INDEX_NAME = 'idx_pm_created_at');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `product_movements` ADD INDEX `idx_pm_created_at` (`created_at`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_movements' AND INDEX_NAME = 'idx_pm_type_created');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `product_movements` ADD INDEX `idx_pm_type_created` (`movement_type`, `created_at`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_movements' AND INDEX_NAME = 'idx_pm_prod_warehouse');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `product_movements` ADD INDEX `idx_pm_prod_warehouse` (`product_id`, `warehouse_id`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Customers table indexes (Critical for Phone search & Governorate filtering during Order Creation)
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_phone1');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `customers` ADD INDEX `idx_customers_phone1` (`phone1`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_phone2');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `customers` ADD INDEX `idx_customers_phone2` (`phone2`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_gov');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `customers` ADD INDEX `idx_customers_gov` (`governorate`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Rep Daily Journal & Journal Orders indexes
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rep_daily_journal' AND INDEX_NAME = 'idx_rdj_rep_date');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `rep_daily_journal` ADD INDEX `idx_rdj_rep_date` (`rep_id`, `journal_date`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rep_daily_journal' AND INDEX_NAME = 'idx_rdj_date');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `rep_daily_journal` ADD INDEX `idx_rdj_date` (`journal_date`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Order Status History indexes
SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history' AND INDEX_NAME = 'idx_osh_order_created');
SET @sqlstmt := IF(@exist > 0, 'SELECT 1', 'ALTER TABLE `order_status_history` ADD INDEX `idx_osh_order_created` (`order_id`, `created_at`)');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
