-- ============================================================
-- Migration: 20260302_new_tables.sql
-- Created: 2026-03-02 18:55:06
-- Covers all tables added in v1.1.x release
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Table: rep_daily_journal
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rep_daily_journal` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `journal_date` date NOT NULL,
  `opening_amount` decimal(14,2) DEFAULT '0.00',
  `opening_orders_count` int(11) DEFAULT '0',
  `opening_pieces_count` int(11) DEFAULT '0',
  `orders_received_count` int(11) DEFAULT '0',
  `pieces_received` int(11) DEFAULT '0',
  `orders_delivered_count` int(11) DEFAULT '0',
  `pieces_delivered` int(11) DEFAULT '0',
  `delivered_value` decimal(14,2) DEFAULT '0.00',
  `orders_returned_count` int(11) DEFAULT '0',
  `pieces_returned` int(11) DEFAULT '0',
  `returned_value` decimal(14,2) DEFAULT '0.00',
  `orders_postponed_count` int(11) DEFAULT '0',
  `pieces_postponed` int(11) DEFAULT '0',
  `postponed_value` decimal(14,2) DEFAULT '0.00',
  `transactions` text COLLATE utf8mb4_unicode_ci,
  `closing_amount` decimal(14,2) DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `employee` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `treasury_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `prev_balance` decimal(14,2) DEFAULT '0.00',
  `old_orders_value` decimal(14,2) DEFAULT '0.00',
  `orders_assigned_count` int(11) DEFAULT '0',
  `pieces_assigned_count` int(11) DEFAULT '0',
  `assigned_value` decimal(14,2) DEFAULT '0.00',
  `total_orders_count` int(11) DEFAULT '0',
  `total_pieces_count` int(11) DEFAULT '0',
  `total_orders_value` decimal(14,2) DEFAULT '0.00',
  `final_before_payment` decimal(14,2) DEFAULT '0.00',
  `payment_action` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_amount` decimal(14,2) DEFAULT '0.00',
  `balance_after_payment` decimal(14,2) DEFAULT '0.00',
  `orders_json` text COLLATE utf8mb4_unicode_ci,
  `session_seq` int(11) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: rep_delivery_sessions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rep_delivery_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `rep_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `treasury_id` int(11) DEFAULT NULL,
  `store_id` int(11) DEFAULT NULL,
  `previous_balance` decimal(14,2) DEFAULT '0.00',
  `old_orders_count` int(11) DEFAULT '0',
  `old_pieces_count` int(11) DEFAULT '0',
  `old_orders_value` decimal(14,2) DEFAULT '0.00',
  `today_orders_count` int(11) DEFAULT '0',
  `today_pieces_count` int(11) DEFAULT '0',
  `today_orders_value` decimal(14,2) DEFAULT '0.00',
  `total_orders_count` int(11) DEFAULT '0',
  `total_pieces_count` int(11) DEFAULT '0',
  `total_orders_value` decimal(14,2) DEFAULT '0.00',
  `final_balance_before_pay` decimal(14,2) DEFAULT '0.00',
  `payment_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'none',
  `paid_amount` decimal(14,2) DEFAULT '0.00',
  `remaining_after_pay` decimal(14,2) DEFAULT '0.00',
  `orders_data` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: rep_stock_custody
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rep_stock_custody` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `rep_id` (`rep_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `rep_stock_custody_ibfk_1` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rep_stock_custody_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: rep_cash_custody
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rep_cash_custody` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `treasury_id` int(11) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settled` tinyint(1) DEFAULT '0',
  `settled_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rep_id` (`rep_id`),
  KEY `treasury_id` (`treasury_id`),
  CONSTRAINT `rep_cash_custody_ibfk_1` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rep_cash_custody_ibfk_2` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: product_variants
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT '0.00',
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `sale_price` decimal(10,2) DEFAULT NULL,
  `reorder_level` int(11) DEFAULT '5',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode` (`barcode`),
  KEY `idx_pv_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: stock
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock` (
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`product_id`,`warehouse_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product_variants` (`id`),
  CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: user_notifications
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci,
  `data` longtext COLLATE utf8mb4_unicode_ci,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `is_read` (`is_read`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: user_page_permissions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_page_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `page_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `can_access` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`page_slug`),
  CONSTRAINT `user_page_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: report_archives
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_archives` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `report_date` date NOT NULL,
  `report_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sections` text COLLATE utf8mb4_unicode_ci,
  `html` longtext COLLATE utf8mb4_unicode_ci,
  `sent` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `report_date` (`report_date`),
  KEY `report_type` (`report_type`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: shipping_companies
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shipping_companies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phones` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sales_offices
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_offices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phones` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: user_defaults
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_defaults` (
  `user_id` int(11) NOT NULL,
  `default_warehouse_id` int(11) DEFAULT NULL,
  `default_treasury_id` int(11) DEFAULT NULL,
  `can_change_warehouse` tinyint(1) DEFAULT '0',
  `can_change_treasury` tinyint(1) DEFAULT '0',
  `default_sales_office_id` int(11) DEFAULT NULL,
  `can_change_sales_office` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sizes
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sizes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: colors
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `colors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: order_documents
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `doc_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `doc_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `order_documents_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: order_status_history
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `rep_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `status` (`status`),
  CONSTRAINT `order_status_history_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: attendance_shifts
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance_shifts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `break_minutes` int(11) DEFAULT '0',
  `grace_in_minutes` int(11) DEFAULT '0',
  `grace_out_minutes` int(11) DEFAULT '0',
  `late_penalty_per_minute` decimal(10,2) DEFAULT '0.00',
  `early_leave_penalty_per_minute` decimal(10,2) DEFAULT '0.00',
  `absence_penalty_per_day` decimal(10,2) DEFAULT '0.00',
  `overtime_rate_per_hour` decimal(10,2) DEFAULT '0.00',
  `is_night_shift` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `weekly_off_days` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: attendance_devices
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance_devices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor` enum('hikvision','zkteco','adms','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  `protocol` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'http',
  `driver` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_config` text COLLATE utf8mb4_unicode_ci,
  `ip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `port` int(11) DEFAULT '80',
  `serial_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `last_sync_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attendance_devices_vendor` (`vendor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
