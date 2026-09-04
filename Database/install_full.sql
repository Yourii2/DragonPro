-- ============================================================
-- DragonPro - Full Installation SQL
-- Generated: 2026-09-04 14:32:22
-- This file creates ALL tables needed for a fresh installation
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================
-- SECTION 1: ALL TABLES (CREATE IF NOT EXISTS)
-- ============================================================

-- Table: accessories
DROP TABLE IF EXISTS `accessories`;
CREATE TABLE IF NOT EXISTS `accessories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int(11) DEFAULT '0',
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'Ù‚Ø·Ø¹Ø©',
  `cost_price` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `min_stock` int(11) DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: accessory_movements
DROP TABLE IF EXISTS `accessory_movements`;
CREATE TABLE IF NOT EXISTS `accessory_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `accessory_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `accessory_id` (`accessory_id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: accessory_stock
DROP TABLE IF EXISTS `accessory_stock`;
CREATE TABLE IF NOT EXISTS `accessory_stock` (
  `accessory_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`accessory_id`,`warehouse_id`) USING BTREE,
  KEY `fk_accessory_stock_warehouse` (`warehouse_id`) USING BTREE,
  CONSTRAINT `fk_accessory_stock_accessory` FOREIGN KEY (`accessory_id`) REFERENCES `accessories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_accessory_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: accounts
DROP TABLE IF EXISTS `accounts`;
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('asset','liability','equity','income','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE,
  KEY `parent_id` (`parent_id`) USING BTREE,
  CONSTRAINT `accounts_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: app_feedback
DROP TABLE IF EXISTS `app_feedback`;
CREATE TABLE IF NOT EXISTS `app_feedback` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rating` int(11) NOT NULL,
  `comment` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: app_files
DROP TABLE IF EXISTS `app_files`;
CREATE TABLE IF NOT EXISTS `app_files` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sha1` char(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data` longblob NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_files_sha1` (`sha1`),
  KEY `idx_app_files_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: app_settings
DROP TABLE IF EXISTS `app_settings`;
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `k` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `v` text COLLATE utf8mb4_unicode_ci,
  `description` text COLLATE utf8mb4_unicode_ci,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_app_settings_k` (`k`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_daily_summary
DROP TABLE IF EXISTS `attendance_daily_summary`;
CREATE TABLE IF NOT EXISTS `attendance_daily_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `shift_id` int(11) DEFAULT NULL,
  `work_date` date NOT NULL,
  `first_in` datetime DEFAULT NULL,
  `last_out` datetime DEFAULT NULL,
  `late_minutes` int(11) DEFAULT '0',
  `early_leave_minutes` int(11) DEFAULT '0',
  `overtime_minutes` int(11) DEFAULT '0',
  `is_absent` tinyint(1) DEFAULT '0',
  `status` enum('present','late','absent','leave','holiday') COLLATE utf8mb4_unicode_ci DEFAULT 'present',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `employee_id` (`employee_id`,`work_date`) USING BTREE,
  KEY `work_date` (`work_date`) USING BTREE,
  KEY `shift_id` (`shift_id`) USING BTREE,
  CONSTRAINT `attendance_daily_summary_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_daily_summary_ibfk_2` FOREIGN KEY (`shift_id`) REFERENCES `attendance_shifts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_device_users
DROP TABLE IF EXISTS `attendance_device_users`;
CREATE TABLE IF NOT EXISTS `attendance_device_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `device_user_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `device_id` (`device_id`,`device_user_id`) USING BTREE,
  UNIQUE KEY `device_id_2` (`device_id`,`employee_id`) USING BTREE,
  KEY `employee_id` (`employee_id`) USING BTREE,
  CONSTRAINT `attendance_device_users_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `attendance_devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_device_users_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_device_workers
DROP TABLE IF EXISTS `attendance_device_workers`;
CREATE TABLE IF NOT EXISTS `attendance_device_workers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `device_id` int(11) NOT NULL,
  `worker_id` int(11) NOT NULL,
  `device_user_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `device_id` (`device_id`,`device_user_id`) USING BTREE,
  UNIQUE KEY `device_id_2` (`device_id`,`worker_id`) USING BTREE,
  KEY `worker_id` (`worker_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_devices
DROP TABLE IF EXISTS `attendance_devices`;
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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_attendance_devices_vendor` (`vendor`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_holidays
DROP TABLE IF EXISTS `attendance_holidays`;
CREATE TABLE IF NOT EXISTS `attendance_holidays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `holiday_date` date NOT NULL,
  `is_paid` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `holiday_date` (`holiday_date`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_logs
DROP TABLE IF EXISTS `attendance_logs`;
CREATE TABLE IF NOT EXISTS `attendance_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL,
  `device_user_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `check_time` datetime NOT NULL,
  `direction` enum('in','out','unknown') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `raw_payload` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `employee_id` (`employee_id`) USING BTREE,
  KEY `device_id` (`device_id`) USING BTREE,
  KEY `check_time` (`check_time`) USING BTREE,
  CONSTRAINT `attendance_logs_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `attendance_logs_ibfk_2` FOREIGN KEY (`device_id`) REFERENCES `attendance_devices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_schedules
DROP TABLE IF EXISTS `attendance_schedules`;
CREATE TABLE IF NOT EXISTS `attendance_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `shift_id` int(11) NOT NULL,
  `day_of_week` tinyint(4) NOT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `employee_id` (`employee_id`) USING BTREE,
  KEY `shift_id` (`shift_id`) USING BTREE,
  CONSTRAINT `attendance_schedules_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_schedules_ibfk_2` FOREIGN KEY (`shift_id`) REFERENCES `attendance_shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_shifts
DROP TABLE IF EXISTS `attendance_shifts`;
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
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: attendance_worker_daily_summary
DROP TABLE IF EXISTS `attendance_worker_daily_summary`;
CREATE TABLE IF NOT EXISTS `attendance_worker_daily_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `worker_id` int(11) NOT NULL,
  `shift_id` int(11) DEFAULT NULL,
  `work_date` date NOT NULL,
  `first_in` datetime DEFAULT NULL,
  `last_out` datetime DEFAULT NULL,
  `late_minutes` int(11) DEFAULT '0',
  `early_leave_minutes` int(11) DEFAULT '0',
  `overtime_minutes` int(11) DEFAULT '0',
  `is_absent` tinyint(1) DEFAULT '0',
  `status` enum('present','late','absent','leave','holiday') COLLATE utf8mb4_unicode_ci DEFAULT 'present',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `worker_id` (`worker_id`,`work_date`) USING BTREE,
  KEY `work_date` (`work_date`) USING BTREE,
  KEY `worker_id_2` (`worker_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: audit_logs
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int(11) DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `module` (`module`) USING BTREE,
  KEY `action` (`action`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: backup_email_otps
DROP TABLE IF EXISTS `backup_email_otps`;
CREATE TABLE IF NOT EXISTS `backup_email_otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `email` (`email`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: colors
DROP TABLE IF EXISTS `colors`;
CREATE TABLE IF NOT EXISTS `colors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: composite_product_items
DROP TABLE IF EXISTS `composite_product_items`;
CREATE TABLE IF NOT EXISTS `composite_product_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `composite_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `composite_id` (`composite_id`) USING BTREE,
  KEY `product_id` (`product_id`) USING BTREE,
  CONSTRAINT `composite_product_items_ibfk_1` FOREIGN KEY (`composite_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `composite_product_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: customer_interactions
DROP TABLE IF EXISTS `customer_interactions`;
CREATE TABLE IF NOT EXISTS `customer_interactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `interaction_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `customer_id` (`customer_id`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE,
  CONSTRAINT `customer_interactions_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: customers
DROP TABLE IF EXISTS `customers`;
CREATE TABLE IF NOT EXISTS `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone1` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone2` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `governorate` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `landmark` text COLLATE utf8mb4_unicode_ci,
  `total_debit` decimal(15,2) DEFAULT '0.00',
  `total_credit` decimal(15,2) DEFAULT '0.00',
  `is_archived` tinyint(1) DEFAULT '0',
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_customers_phone1` (`phone1`),
  KEY `idx_customers_phone2` (`phone2`),
  KEY `idx_customers_gov` (`governorate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: cutting_orders
DROP TABLE IF EXISTS `cutting_orders`;
CREATE TABLE IF NOT EXISTS `cutting_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `fabric_id` int(11) NOT NULL,
  `factory_product_id` int(11) NOT NULL,
  `cut_quantity` int(11) NOT NULL,
  `consumption_per_piece` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `total_consumption` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `available_qty` int(11) NOT NULL DEFAULT '0',
  `in_production_qty` int(11) NOT NULL DEFAULT '0',
  `ready_qty` int(11) NOT NULL DEFAULT '0',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE,
  KEY `fabric_id` (`fabric_id`) USING BTREE,
  KEY `factory_product_id` (`factory_product_id`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: delivery_note_lines
DROP TABLE IF EXISTS `delivery_note_lines`;
CREATE TABLE IF NOT EXISTS `delivery_note_lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `delivery_note_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `qty` int(11) DEFAULT NULL,
  `journal_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `delivery_note_id` (`delivery_note_id`),
  KEY `product_id` (`product_id`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: delivery_notes
DROP TABLE IF EXISTS `delivery_notes`;
CREATE TABLE IF NOT EXISTS `delivery_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `note_code` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_id` int(11) NOT NULL,
  `rep_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `note_code` (`note_code`),
  KEY `order_id` (`order_id`),
  KEY `rep_id` (`rep_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `created_by` (`created_by`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: dispatch_order_items
DROP TABLE IF EXISTS `dispatch_order_items`;
CREATE TABLE IF NOT EXISTS `dispatch_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `factory_product_id` int(11) NOT NULL,
  `qty_sent` int(11) NOT NULL,
  `qty_received` int(11) DEFAULT NULL,
  `size_id` int(11) NOT NULL DEFAULT '0',
  `color` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ux_order_variant` (`order_id`,`factory_product_id`,`size_id`,`color`) USING BTREE,
  KEY `order_id` (`order_id`) USING BTREE,
  KEY `factory_product_id` (`factory_product_id`) USING BTREE,
  KEY `size_id` (`size_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: dispatch_orders
DROP TABLE IF EXISTS `dispatch_orders`;
CREATE TABLE IF NOT EXISTS `dispatch_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from_warehouse_id` int(11) NOT NULL,
  `to_warehouse_id` int(11) NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_by` int(11) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ux_dispatch_orders_code` (`code`) USING BTREE,
  KEY `from_warehouse_id` (`from_warehouse_id`) USING BTREE,
  KEY `to_warehouse_id` (`to_warehouse_id`) USING BTREE,
  KEY `status` (`status`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: dispatches
DROP TABLE IF EXISTS `dispatches`;
CREATE TABLE IF NOT EXISTS `dispatches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `factory_product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `factory_product_id` (`factory_product_id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE,
  KEY `created_by` (`created_by`) USING BTREE,
  CONSTRAINT `dispatches_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dispatches_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `dispatches_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: employee_advances
DROP TABLE IF EXISTS `employee_advances`;
CREATE TABLE IF NOT EXISTS `employee_advances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('advance','loan') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','paid','deducted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `employee_id` (`employee_id`) USING BTREE,
  CONSTRAINT `employee_advances_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: employee_salaries
DROP TABLE IF EXISTS `employee_salaries`;
CREATE TABLE IF NOT EXISTS `employee_salaries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `month` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_salary` decimal(10,2) NOT NULL,
  `deductions` decimal(10,2) DEFAULT '0.00',
  `bonuses` decimal(10,2) DEFAULT '0.00',
  `net_salary` decimal(10,2) NOT NULL,
  `status` enum('pending','paid') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `paid_at` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `employee_id` (`employee_id`,`month`) USING BTREE,
  CONSTRAINT `employee_salaries_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: employee_transactions
DROP TABLE IF EXISTS `employee_transactions`;
CREATE TABLE IF NOT EXISTS `employee_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `treasury_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('advance','bonus','penalty','salary') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','paid','deducted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `employee_id` (`employee_id`) USING BTREE,
  KEY `treasury_id` (`treasury_id`) USING BTREE,
  CONSTRAINT `employee_transactions_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_transactions_ibfk_2` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: employees
DROP TABLE IF EXISTS `employees`;
CREATE TABLE IF NOT EXISTS `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salary` decimal(10,2) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','on_leave') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `attendance_enabled` tinyint(1) DEFAULT '1',
  `default_shift_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: fabric_movements
DROP TABLE IF EXISTS `fabric_movements`;
CREATE TABLE IF NOT EXISTS `fabric_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fabric_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` decimal(10,4) NOT NULL,
  `previous_quantity` decimal(10,4) NOT NULL,
  `new_quantity` decimal(10,4) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `fabric_id` (`fabric_id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE,
  KEY `created_by` (`created_by`) USING BTREE,
  CONSTRAINT `fabric_movements_ibfk_1` FOREIGN KEY (`fabric_id`) REFERENCES `fabrics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fabric_movements_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fabric_movements_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: fabric_stock
DROP TABLE IF EXISTS `fabric_stock`;
CREATE TABLE IF NOT EXISTS `fabric_stock` (
  `fabric_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` decimal(10,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`fabric_id`,`warehouse_id`) USING BTREE,
  KEY `fk_fabric_stock_warehouse` (`warehouse_id`) USING BTREE,
  CONSTRAINT `fk_fabric_stock_fabric` FOREIGN KEY (`fabric_id`) REFERENCES `fabrics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fabric_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: fabrics
DROP TABLE IF EXISTS `fabrics`;
CREATE TABLE IF NOT EXISTS `fabrics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `material` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int(11) DEFAULT '0',
  `min_stock` int(1) DEFAULT '0',
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'Ù…ØªØ±',
  `cost_price` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: factory_product_movements
DROP TABLE IF EXISTS `factory_product_movements`;
CREATE TABLE IF NOT EXISTS `factory_product_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `factory_product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `factory_product_id` (`factory_product_id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: factory_product_sizes
DROP TABLE IF EXISTS `factory_product_sizes`;
CREATE TABLE IF NOT EXISTS `factory_product_sizes` (
  `factory_product_id` int(11) NOT NULL,
  `size_id` int(11) NOT NULL,
  PRIMARY KEY (`factory_product_id`,`size_id`) USING BTREE,
  KEY `size_id` (`size_id`) USING BTREE,
  CONSTRAINT `factory_product_sizes_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_sizes_ibfk_2` FOREIGN KEY (`size_id`) REFERENCES `sizes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: factory_product_stage_accessories
DROP TABLE IF EXISTS `factory_product_stage_accessories`;
CREATE TABLE IF NOT EXISTS `factory_product_stage_accessories` (
  `factory_product_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  `accessory_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT '1',
  PRIMARY KEY (`factory_product_id`,`stage_id`,`accessory_id`) USING BTREE,
  KEY `stage_id` (`stage_id`) USING BTREE,
  KEY `accessory_id` (`accessory_id`) USING BTREE,
  CONSTRAINT `factory_product_stage_accessories_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_stage_accessories_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_stage_accessories_ibfk_3` FOREIGN KEY (`accessory_id`) REFERENCES `accessories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: factory_product_stages
DROP TABLE IF EXISTS `factory_product_stages`;
CREATE TABLE IF NOT EXISTS `factory_product_stages` (
  `factory_product_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  PRIMARY KEY (`factory_product_id`,`stage_id`) USING BTREE,
  KEY `stage_id` (`stage_id`) USING BTREE,
  CONSTRAINT `factory_product_stages_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_product_stages_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: factory_products
DROP TABLE IF EXISTS `factory_products`;
CREATE TABLE IF NOT EXISTS `factory_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('individual','composite') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sale_price` decimal(10,2) DEFAULT '0.00',
  `min_stock` int(11) DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: factory_receiving
DROP TABLE IF EXISTS `factory_receiving`;
CREATE TABLE IF NOT EXISTS `factory_receiving` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `received_by` int(11) DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `order_id` (`order_id`) USING BTREE,
  CONSTRAINT `factory_receiving_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `manufacturing_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: factory_stock
DROP TABLE IF EXISTS `factory_stock`;
CREATE TABLE IF NOT EXISTS `factory_stock` (
  `factory_product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`factory_product_id`,`warehouse_id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  CONSTRAINT `factory_stock_ibfk_1` FOREIGN KEY (`factory_product_id`) REFERENCES `factory_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_stock_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: inventory_audit_items
DROP TABLE IF EXISTS `inventory_audit_items`;
CREATE TABLE IF NOT EXISTS `inventory_audit_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `audit_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `system_qty` int(11) NOT NULL DEFAULT '0',
  `counted_qty` int(11) NOT NULL DEFAULT '0',
  `diff_qty` int(11) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ux_audit_product` (`audit_id`,`product_id`) USING BTREE,
  KEY `audit_id` (`audit_id`) USING BTREE,
  KEY `product_id` (`product_id`) USING BTREE,
  CONSTRAINT `inventory_audit_items_ibfk_1` FOREIGN KEY (`audit_id`) REFERENCES `inventory_audits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_audit_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: inventory_audits
DROP TABLE IF EXISTS `inventory_audits`;
CREATE TABLE IF NOT EXISTS `inventory_audits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL,
  `status` enum('draft','pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` datetime DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  CONSTRAINT `inventory_audits_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: journal_entries
DROP TABLE IF EXISTS `journal_entries`;
CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entry_date` date NOT NULL,
  `memo` text COLLATE utf8mb4_unicode_ci,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` int(11) DEFAULT NULL,
  `posted` tinyint(1) DEFAULT '0',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `source_type` (`source_type`,`source_id`) USING BTREE,
  KEY `entry_date` (`entry_date`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: journal_lines
DROP TABLE IF EXISTS `journal_lines`;
CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entry_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `debit` decimal(15,2) DEFAULT '0.00',
  `credit` decimal(15,2) DEFAULT '0.00',
  `line_memo` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `entry_id` (`entry_id`) USING BTREE,
  KEY `account_id` (`account_id`) USING BTREE,
  CONSTRAINT `journal_lines_ibfk_1` FOREIGN KEY (`entry_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `journal_lines_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: manufacturing_order_stages
DROP TABLE IF EXISTS `manufacturing_order_stages`;
CREATE TABLE IF NOT EXISTS `manufacturing_order_stages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `worker_id` int(11) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `order_id` (`order_id`) USING BTREE,
  KEY `stage_id` (`stage_id`) USING BTREE,
  KEY `worker_id` (`worker_id`) USING BTREE,
  CONSTRAINT `manufacturing_order_stages_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `manufacturing_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `manufacturing_order_stages_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`),
  CONSTRAINT `manufacturing_order_stages_ibfk_3` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: manufacturing_orders
DROP TABLE IF EXISTS `manufacturing_orders`;
CREATE TABLE IF NOT EXISTS `manufacturing_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cutting_order_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `status` enum('draft','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `product_id` (`product_id`) USING BTREE,
  CONSTRAINT `manufacturing_orders_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `factory_products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: order_confirmation_assignments
DROP TABLE IF EXISTS `order_confirmation_assignments`;
CREATE TABLE IF NOT EXISTS `order_confirmation_assignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `rep_id` int(11) NOT NULL,
  `assigned_by` int(11) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'assigned',
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `warehouse_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_order_confirmation_order` (`order_id`) USING BTREE,
  KEY `idx_order_confirmation_rep_status` (`rep_id`,`status`) USING BTREE,
  KEY `idx_order_confirmation_status` (`status`) USING BTREE,
  KEY `idx_oca_rep_assigned` (`rep_id`,`status`,`assigned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: order_documents
DROP TABLE IF EXISTS `order_documents`;
CREATE TABLE IF NOT EXISTS `order_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `doc_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `doc_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `order_id` (`order_id`) USING BTREE,
  CONSTRAINT `order_documents_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: order_items
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price_per_unit` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `order_id` (`order_id`) USING BTREE,
  KEY `product_id` (`product_id`) USING BTREE,
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product_variants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: order_status_history
DROP TABLE IF EXISTS `order_status_history`;
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `rep_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `order_id` (`order_id`) USING BTREE,
  KEY `status` (`status`) USING BTREE,
  KEY `idx_osh_order_created` (`order_id`,`created_at`),
  KEY `idx_osh_order_status` (`order_id`,`status`,`created_at`),
  CONSTRAINT `order_status_history_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: orders
DROP TABLE IF EXISTS `orders`;
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` int(11) NOT NULL,
  `rep_id` int(11) DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `total_amount` decimal(15,2) NOT NULL,
  `shipping_fees` decimal(10,2) DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sales_office_id` int(11) DEFAULT NULL,
  `discount_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discount_value` decimal(10,2) DEFAULT '0.00',
  `discount_amount` decimal(10,2) DEFAULT '0.00',
  `tax_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_value` decimal(10,2) DEFAULT '0.00',
  `tax_amount` decimal(10,2) DEFAULT '0.00',
  `employee` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `items_json` longtext COLLATE utf8mb4_unicode_ci COMMENT 'أصناف الطلب مخزنة بصيغة JSON',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `order_number` (`order_number`) USING BTREE,
  KEY `idx_orders_sales_office_id` (`sales_office_id`) USING BTREE,
  KEY `customer_id` (`customer_id`) USING BTREE,
  KEY `rep_id` (`rep_id`) USING BTREE,
  KEY `idx_orders_created_at` (`created_at`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_status_created` (`status`,`created_at`),
  KEY `idx_orders_customer_created` (`customer_id`,`created_at`),
  KEY `idx_orders_rep_status` (`rep_id`,`status`),
  KEY `idx_orders_status_date` (`status`,`created_at`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_rep` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: permission_actions
DROP TABLE IF EXISTS `permission_actions`;
CREATE TABLE IF NOT EXISTS `permission_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: permission_modules
DROP TABLE IF EXISTS `permission_modules`;
CREATE TABLE IF NOT EXISTS `permission_modules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `order` int(11) DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ux_permission_modules_name` (`name`) USING BTREE,
  KEY `parent_id` (`parent_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: product_movements
DROP TABLE IF EXISTS `product_movements`;
CREATE TABLE IF NOT EXISTS `product_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `movement_type` enum('purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','initial_balance') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `previous_quantity` int(11) NOT NULL,
  `new_quantity` int(11) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `product_id` (`product_id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  KEY `idx_pm_created_at` (`created_at`),
  KEY `idx_pm_type_created` (`movement_type`,`created_at`),
  KEY `idx_pm_prod_warehouse` (`product_id`,`warehouse_id`),
  CONSTRAINT `product_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_movements_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: product_tracking
DROP TABLE IF EXISTS `product_tracking`;
CREATE TABLE IF NOT EXISTS `product_tracking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `manufacturing_order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  `worker_id` int(11) DEFAULT NULL,
  `size_id` int(11) DEFAULT NULL,
  `piece_uid` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_paid` tinyint(1) DEFAULT NULL,
  `piece_rate` decimal(10,2) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `customer_id` int(11) DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `manufacturing_order_id` (`manufacturing_order_id`) USING BTREE,
  KEY `product_id` (`product_id`) USING BTREE,
  KEY `stage_id` (`stage_id`) USING BTREE,
  KEY `worker_id` (`worker_id`) USING BTREE,
  KEY `customer_id` (`customer_id`) USING BTREE,
  CONSTRAINT `product_tracking_ibfk_1` FOREIGN KEY (`manufacturing_order_id`) REFERENCES `manufacturing_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_tracking_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `factory_products` (`id`),
  CONSTRAINT `product_tracking_ibfk_3` FOREIGN KEY (`stage_id`) REFERENCES `production_stages` (`id`),
  CONSTRAINT `product_tracking_ibfk_4` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`),
  CONSTRAINT `product_tracking_ibfk_5` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: product_variants
DROP TABLE IF EXISTS `product_variants`;
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
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `barcode` (`barcode`) USING BTREE,
  KEY `idx_pv_product_id` (`product_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: production_stages
DROP TABLE IF EXISTS `production_stages`;
CREATE TABLE IF NOT EXISTS `production_stages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_num` int(11) DEFAULT '1',
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: products
DROP TABLE IF EXISTS `products`;
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_products_name` (`name`(191)) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: rep_cash_custody
DROP TABLE IF EXISTS `rep_cash_custody`;
CREATE TABLE IF NOT EXISTS `rep_cash_custody` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `treasury_id` int(11) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settled` tinyint(1) DEFAULT '0',
  `settled_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `rep_id` (`rep_id`) USING BTREE,
  KEY `treasury_id` (`treasury_id`) USING BTREE,
  CONSTRAINT `rep_cash_custody_ibfk_1` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rep_cash_custody_ibfk_2` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: rep_close_events
DROP TABLE IF EXISTS `rep_close_events`;
CREATE TABLE IF NOT EXISTS `rep_close_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `treasury_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_amount` decimal(14,2) DEFAULT '0.00',
  `direction` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: rep_daily_journal
DROP TABLE IF EXISTS `rep_daily_journal`;
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
  `daily_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_closed` tinyint(1) NOT NULL DEFAULT '0',
  `page` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_rdj_rep_date` (`rep_id`,`journal_date`),
  KEY `idx_rdj_date` (`journal_date`),
  KEY `idx_rdj_rep_closed` (`rep_id`,`is_closed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: rep_delivery_sessions
DROP TABLE IF EXISTS `rep_delivery_sessions`;
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
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_rds_rep_date` (`rep_id`,`session_date`),
  KEY `idx_rds_date` (`session_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: rep_journal_orders
DROP TABLE IF EXISTS `rep_journal_orders`;
CREATE TABLE IF NOT EXISTS `rep_journal_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `journal_id` int(11) DEFAULT NULL,
  `rep_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'with_rep',
  `event_date` date NOT NULL,
  `event_time` time NOT NULL,
  `employee` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `returned_pieces` int(11) DEFAULT '0',
  `returned_value` decimal(14,2) DEFAULT '0.00',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_rep_order_journal` (`rep_id`,`order_id`,`journal_id`),
  KEY `idx_rjo_rep_journal` (`rep_id`,`journal_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: rep_return_events
DROP TABLE IF EXISTS `rep_return_events`;
CREATE TABLE IF NOT EXISTS `rep_return_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `order_ids` json DEFAULT NULL,
  `event_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: rep_stock_custody
DROP TABLE IF EXISTS `rep_stock_custody`;
CREATE TABLE IF NOT EXISTS `rep_stock_custody` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rep_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `rep_id` (`rep_id`) USING BTREE,
  KEY `product_id` (`product_id`) USING BTREE,
  CONSTRAINT `rep_stock_custody_ibfk_1` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rep_stock_custody_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: report_archives
DROP TABLE IF EXISTS `report_archives`;
CREATE TABLE IF NOT EXISTS `report_archives` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `report_date` date NOT NULL,
  `report_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sections` text COLLATE utf8mb4_unicode_ci,
  `html` longtext COLLATE utf8mb4_unicode_ci,
  `sent` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `report_date` (`report_date`) USING BTREE,
  KEY `report_type` (`report_type`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: report_email_otps
DROP TABLE IF EXISTS `report_email_otps`;
CREATE TABLE IF NOT EXISTS `report_email_otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `email` (`email`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: sales_offices
DROP TABLE IF EXISTS `sales_offices`;
CREATE TABLE IF NOT EXISTS `sales_offices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phones` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: selected_products
DROP TABLE IF EXISTS `selected_products`;
CREATE TABLE IF NOT EXISTS `selected_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `color` varchar(100) DEFAULT NULL,
  `size` varchar(100) DEFAULT NULL,
  `qty` int(11) DEFAULT '1',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- Table: settings
DROP TABLE IF EXISTS `settings`;
CREATE TABLE IF NOT EXISTS `settings` (
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`config_key`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: shipping_companies
DROP TABLE IF EXISTS `shipping_companies`;
CREATE TABLE IF NOT EXISTS `shipping_companies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phones` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: sizes
DROP TABLE IF EXISTS `sizes`;
CREATE TABLE IF NOT EXISTS `sizes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: stock
DROP TABLE IF EXISTS `stock`;
CREATE TABLE IF NOT EXISTS `stock` (
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT '0',
  PRIMARY KEY (`product_id`,`warehouse_id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product_variants` (`id`),
  CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: suppliers
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `total_debit` decimal(15,2) DEFAULT '0.00',
  `total_credit` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: transactions
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('sale','purchase','return_in','return_out','payment_in','payment_out','transfer_in','transfer_out','other','rep_bonus_in','rep_penalty') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `treasury_id` int(11) DEFAULT NULL,
  `related_to_type` enum('customer','supplier','employee','none') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_to_id` int(11) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `transaction_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `details` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `warehouse_id` (`warehouse_id`) USING BTREE,
  KEY `treasury_id` (`treasury_id`) USING BTREE,
  KEY `idx_transactions_created_by` (`created_by`),
  KEY `idx_transactions_date` (`transaction_date`),
  KEY `idx_transactions_type_date` (`type`,`transaction_date`),
  KEY `idx_transactions_related` (`related_to_type`,`related_to_id`),
  KEY `idx_transactions_treasury_date` (`treasury_id`,`transaction_date`),
  KEY `idx_tx_rep` (`related_to_type`,`related_to_id`,`amount`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`treasury_id`) REFERENCES `treasuries` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: treasuries
DROP TABLE IF EXISTS `treasuries`;
CREATE TABLE IF NOT EXISTS `treasuries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_balance` decimal(15,2) DEFAULT '0.00',
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'نقدي',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: user_defaults
DROP TABLE IF EXISTS `user_defaults`;
CREATE TABLE IF NOT EXISTS `user_defaults` (
  `user_id` int(11) NOT NULL,
  `default_warehouse_id` int(11) DEFAULT NULL,
  `default_treasury_id` int(11) DEFAULT NULL,
  `can_change_warehouse` tinyint(1) DEFAULT '0',
  `can_change_treasury` tinyint(1) DEFAULT '0',
  `default_sales_office_id` int(11) DEFAULT NULL,
  `can_change_sales_office` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: user_notifications
DROP TABLE IF EXISTS `user_notifications`;
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci,
  `data` longtext COLLATE utf8mb4_unicode_ci,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `is_read` (`is_read`) USING BTREE,
  KEY `created_at` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: user_page_permissions
DROP TABLE IF EXISTS `user_page_permissions`;
CREATE TABLE IF NOT EXISTS `user_page_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `page_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `can_access` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `user_id` (`user_id`,`page_slug`) USING BTREE,
  CONSTRAINT `user_page_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: user_permissions
DROP TABLE IF EXISTS `user_permissions`;
CREATE TABLE IF NOT EXISTS `user_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `action_id` int(11) NOT NULL,
  `allowed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ux_user_module_action` (`user_id`,`module_id`,`action_id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `module_id` (`module_id`) USING BTREE,
  KEY `action_id` (`action_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: user_preferences
DROP TABLE IF EXISTS `user_preferences`;
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `pref_key` varchar(100) NOT NULL,
  `pref_value` text,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_pref` (`user_id`,`pref_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: users
DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','manager','representative','accountant') COLLATE utf8mb4_unicode_ci DEFAULT 'representative',
  `restricted_treasury_id` int(11) DEFAULT NULL,
  `restricted_warehouse_id` int(11) DEFAULT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `phone` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `insurance_paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'هل دفع تأمين',
  `insurance_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'مبلغ التأمين المدفوع',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `username` (`username`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: warehouses
DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: worker_salaries
DROP TABLE IF EXISTS `worker_salaries`;
CREATE TABLE IF NOT EXISTS `worker_salaries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `worker_id` int(11) NOT NULL,
  `period_type` enum('day','week','month','piecework') COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_value` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_salary` decimal(10,2) NOT NULL,
  `deductions` decimal(10,2) DEFAULT '0.00',
  `bonuses` decimal(10,2) DEFAULT '0.00',
  `net_salary` decimal(10,2) NOT NULL,
  `status` enum('pending','paid') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `paid_at` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uniq_worker_period` (`worker_id`,`period_type`,`period_value`) USING BTREE,
  CONSTRAINT `worker_salaries_ibfk_1` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: worker_transactions
DROP TABLE IF EXISTS `worker_transactions`;
CREATE TABLE IF NOT EXISTS `worker_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `worker_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `type` enum('advance','bonus','penalty','piecework','salary') COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','paid','deducted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `worker_id` (`worker_id`) USING BTREE,
  CONSTRAINT `worker_transactions_ibfk_1` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Table: workers
DROP TABLE IF EXISTS `workers`;
CREATE TABLE IF NOT EXISTS `workers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salary_type` enum('daily','weekly','monthly','piecework') COLLATE utf8mb4_unicode_ci DEFAULT 'daily',
  `salary_amount` decimal(10,2) DEFAULT '0.00',
  `hire_date` date DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fingerprint_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendance_enabled` tinyint(1) DEFAULT '0',
  `default_shift_id` int(11) DEFAULT NULL,
  `status` enum('active','inactive','on_leave') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `fingerprint_no` (`fingerprint_no`) USING BTREE,
  KEY `idx_workers_fingerprint_no` (`fingerprint_no`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- ============================================================
-- SECTION 2: DEFAULT SEED DATA
-- ============================================================

-- Default admin user (username: admin, password: admin123)
INSERT IGNORE INTO `users` (`id`, `name`, `username`, `password`, `role`, `phone`, `is_active`, `created_at`)
VALUES (1, 'مدير النظام', 'admin', MD5('admin123'), 'admin', '', 1, NOW());

-- Default warehouse
INSERT IGNORE INTO `warehouses` (`id`, `name`, `location`, `is_default`, `created_at`)
VALUES (1, 'المستودع الرئيسي', '', 1, NOW());

-- Default treasury
INSERT IGNORE INTO `treasuries` (`id`, `name`, `balance`, `type`, `created_at`)
VALUES (1, 'الخزينة الرئيسية', 0.00, 'نقدي', NOW());

-- Default app settings
INSERT IGNORE INTO `settings` (`config_key`, `config_value`) VALUES
  ('company_name', 'شركتي'),
  ('company_phone', ''),
  ('company_address', ''),
  ('currency', 'ج.م'),
  ('auto_backup', 'false'),
  ('sales_display_method', 'company'),
  ('product_source', 'both'),
  ('delivery_method', 'reps'),
  ('purchase_price_type', 'cost');

-- Default permission modules
SET FOREIGN_KEY_CHECKS = 1;

-- Installation complete. DragonPro is ready!
