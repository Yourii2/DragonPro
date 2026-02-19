-- Migration: make schema match Database/Schema998877.sql (users + orders)
-- تاريخ: 2026-02-13
-- ملاحظة: نفّذ هذا الملف على بيئة اختبارية أولاً. بعض العبارات (مثل إضافة PRIMARY KEY) قد تحتاج تحقق يدوي إذا كانت الجداول تحتوي على بيانات غير متوافقة.

-- ===== users: add missing columns =====
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `id` int(11) NOT NULL AUTO_INCREMENT FIRST,
  ADD COLUMN IF NOT EXISTS `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL AFTER `id`,
  ADD COLUMN IF NOT EXISTS `username` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL AFTER `username`,
  ADD COLUMN IF NOT EXISTS `role` enum('admin','manager','representative','accountant') COLLATE utf8mb4_unicode_ci DEFAULT 'representative' AFTER `password`,
  ADD COLUMN IF NOT EXISTS `restricted_treasury_id` int(11) DEFAULT NULL AFTER `role`,
  ADD COLUMN IF NOT EXISTS `restricted_warehouse_id` int(11) DEFAULT NULL AFTER `restricted_treasury_id`,
  ADD COLUMN IF NOT EXISTS `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `restricted_warehouse_id`,
  ADD COLUMN IF NOT EXISTS `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `avatar`,
  ADD COLUMN IF NOT EXISTS `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `created_at`;

-- ===== users: normalize changed columns =====
ALTER TABLE `users`
  MODIFY COLUMN `balance` decimal(15,2) NOT NULL DEFAULT '0.00' AFTER `phone`,
  MODIFY COLUMN `insurance_paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'هل دفع تأمين' AFTER `balance`,
  MODIFY COLUMN `insurance_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'مبلغ التأمين المدفوع' AFTER `insurance_paid`;

-- ===== users: ensure index and primary key =====
DROP INDEX IF EXISTS `username` ON `users`;
ALTER TABLE `users` ADD INDEX `username` (`username`);

-- Attempt to add PRIMARY KEY on `id` if none exists. This may fail if table has an existing incompatible PK.
-- Run the following manually on a test DB if you need safer conditional behavior.
ALTER TABLE `users` ADD PRIMARY KEY (`id`);

-- ===== orders: add missing discount/tax columns =====
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `discount_type` varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `discount_value` decimal(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `discount_amount` decimal(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `tax_type` varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `tax_value` decimal(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `tax_amount` decimal(10,2) DEFAULT 0;

-- ===== orders: normalize sales_office_id type =====
ALTER TABLE `orders`
  MODIFY COLUMN `sales_office_id` int(11) DEFAULT NULL;

-- ===== orders: ensure indexes =====
DROP INDEX IF EXISTS `order_number` ON `orders`;
DROP INDEX IF EXISTS `customer_id` ON `orders`;
DROP INDEX IF EXISTS `rep_id` ON `orders`;
DROP INDEX IF EXISTS `idx_orders_sales_office_id` ON `orders`;
ALTER TABLE `orders` ADD INDEX `order_number` (`order_number`);
ALTER TABLE `orders` ADD INDEX `customer_id` (`customer_id`);
ALTER TABLE `orders` ADD INDEX `rep_id` (`rep_id`);
ALTER TABLE `orders` ADD INDEX `idx_orders_sales_office_id` (`sales_office_id`);

-- ===== orders: foreign keys =====
-- Drop existing foreign keys with the same names if present, then add.
ALTER TABLE `orders` DROP FOREIGN KEY IF EXISTS `fk_orders_customer`;
ALTER TABLE `orders` DROP FOREIGN KEY IF EXISTS `fk_orders_rep`;
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_rep` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;

-- ===== End migration =====
