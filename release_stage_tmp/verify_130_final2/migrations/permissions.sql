-- Permissions module migration
-- Run this once to create permissions tables for per-user permission management

CREATE TABLE IF NOT EXISTS permission_modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  UNIQUE KEY ux_permission_modules_name (name),
  parent_id INT DEFAULT NULL,
  `order` INT DEFAULT 0,
  INDEX(parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permission_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  code VARCHAR(100) NOT NULL,
  UNIQUE(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  action_id INT NOT NULL,
  allowed TINYINT(1) DEFAULT 0,
  UNIQUE KEY ux_user_module_action (user_id, module_id, action_id),
  INDEX(user_id),
  INDEX(module_id),
  INDEX(action_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_defaults (
  user_id INT PRIMARY KEY,
  default_warehouse_id INT DEFAULT NULL,
  default_treasury_id INT DEFAULT NULL,
  default_sales_office_id INT DEFAULT NULL,
  can_change_warehouse TINYINT(1) DEFAULT 0,
  can_change_treasury TINYINT(1) DEFAULT 0,
  can_change_sales_office TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
