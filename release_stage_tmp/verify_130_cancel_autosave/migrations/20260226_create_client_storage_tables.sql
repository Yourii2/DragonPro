-- Migration: create tables to persist client-side localStorage/sessionStorage data
-- Date: 2026-02-26
-- Run this file against your Nexus database (MySQL / MariaDB compatible)

-- General key/value settings stored at application scope
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `k` VARCHAR(191) NOT NULL,
  `v` TEXT,
  `description` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_settings_k` (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure compatibility: create a legacy `settings` view if legacy systems expect it
DELIMITER $$
CREATE VIEW IF NOT EXISTS `settings` AS
SELECT `k` AS `config_key`, `v` AS `config_value` FROM `app_settings`;
$$
DELIMITER ;

-- Per-user simple settings (mirrors keys like Dragon_user, theme, pos prefs)
CREATE TABLE IF NOT EXISTS `user_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `k` VARCHAR(191) NOT NULL,
  `v` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_settings_user_key` (`user_id`,`k`),
  INDEX (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cached permissions for users (mirrors sessionStorage 'Dragon_user_permissions')
CREATE TABLE IF NOT EXISTS `user_permissions_cache` (
  `user_id` INT UNSIGNED NOT NULL,
  `permissions` JSON NOT NULL,
  `expires_at` DATETIME DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Persist selected orders per module / per user (mirrors OrdersModule_selectedOrders)
CREATE TABLE IF NOT EXISTS `user_module_state` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `module` VARCHAR(100) NOT NULL,
  `state_key` VARCHAR(100) NOT NULL,
  `state_value` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_module_state` (`user_id`,`module`,`state_key`),
  INDEX (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prefilled data for printing / barcode workflows (mirrors Nexus_barcode_print_prefill_v1, other prefill keys)
CREATE TABLE IF NOT EXISTS `print_prefills` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) DEFAULT NULL,
  `data` JSON NOT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activation / licensing information previously cached in localStorage
CREATE TABLE IF NOT EXISTS `activation_cache` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `data` JSON NOT NULL,
  `last_check` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration note: many of the 'Dragon_*' keys are application settings. Use app_settings for single-instance values
-- and user_settings for per-user values (Dragon_user should be stored as authenticated session and canonical user table; user_settings may keep UI copies).

-- Optional: store a mapping of legacy localStorage keys to DB keys for migration scripts
CREATE TABLE IF NOT EXISTS `localstorage_migration_map` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ls_key` VARCHAR(191) NOT NULL,
  `table_name` VARCHAR(191) NOT NULL,
  `row_key` VARCHAR(191) DEFAULT NULL,
  `note` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ls_key` (`ls_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example inserts to map common keys (optional convenience)
INSERT INTO `localstorage_migration_map` (`ls_key`,`table_name`,`row_key`,`note`) VALUES
  ('Dragon_company_name','app_settings','company_name','Company display name'),
  ('Dragon_company_phone','app_settings','company_phone','Company phone'),
  ('Dragon_company_logo','app_settings','company_logo','Logo URL'),
  ('Dragon_tax_rate','app_settings','tax_rate','Default tax rate'),
  ('Dragon_theme','user_settings','theme','User theme preference (per user)'),
  ('Dragon_user_permissions','user_permissions_cache',NULL,'Cached permissions JSON (per user)'),
  ('OrdersModule_selectedOrders','user_module_state','selectedOrders','Selected orders saved in module state');

-- End of migration
