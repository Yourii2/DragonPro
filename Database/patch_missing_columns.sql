-- Auto-generated patch: add missing columns to existing tables
-- Generated: 2026-09-04 14:31:41

ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `discount_type` varchar(20) DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `discount_value` decimal(10,2) DEFAULT NULL DEFAULT '0.00';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `discount_amount` decimal(10,2) DEFAULT NULL DEFAULT '0.00';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `tax_type` varchar(20) DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `tax_value` decimal(10,2) DEFAULT NULL DEFAULT '0.00';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `tax_amount` decimal(10,2) DEFAULT NULL DEFAULT '0.00';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `employee` varchar(255) DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `page` varchar(255) DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `items_json` longtext DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `is_archived` tinyint(1) NOT NULL DEFAULT '0';
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';
ALTER TABLE `transactions` ADD COLUMN IF NOT EXISTS `category` varchar(50) DEFAULT NULL;
ALTER TABLE `transactions` ADD COLUMN IF NOT EXISTS `created_by` int(11) DEFAULT NULL;
ALTER TABLE `treasuries` ADD COLUMN IF NOT EXISTS `type` varchar(50) DEFAULT NULL DEFAULT 'نقدي';
