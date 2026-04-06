-- Migration: create app_files table to store uploaded binaries in DB
CREATE TABLE IF NOT EXISTS `app_files` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename` VARCHAR(255) NOT NULL,
  `mime` VARCHAR(120) DEFAULT NULL,
  `sha1` CHAR(40) DEFAULT NULL,
  `data` LONGBLOB NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_files_sha1` (`sha1`),
  KEY `idx_app_files_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
