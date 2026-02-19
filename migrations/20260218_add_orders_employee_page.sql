-- Migration: Add employee and page columns to orders
-- Run this SQL manually or use the PHP runner provided (20260218_add_orders_employee_page.php)

ALTER TABLE `orders`
  ADD COLUMN `employee` VARCHAR(255) NULL AFTER `sales_office_id`,
  ADD COLUMN `page` VARCHAR(255) NULL AFTER `employee`;
