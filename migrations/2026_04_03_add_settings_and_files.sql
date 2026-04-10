-- Migration: add tables for storing app settings, uploaded files, and logs

CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  `value` LONGTEXT,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_files` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename` VARCHAR(255) NOT NULL,
  `mime` VARCHAR(100) DEFAULT NULL,
  `data` LONGBLOB NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `level` VARCHAR(20) DEFAULT 'info',
  `message` LONGTEXT,
  `context` LONGTEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed basic keys (if not exist)
INSERT IGNORE INTO `app_settings` (`name`, `value`) VALUES
('company_name',''),
('company_phone',''),
('company_address',''),
('company_terms',''),
('company_logo_file_id',''),
('tax_rate','14'),
('currency','EGP');
