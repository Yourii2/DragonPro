-- Migration: localStorage → app_settings (1.4.0)
CREATE TABLE IF NOT EXISTS app_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  `value` TEXT,
  user_id INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(key),
  INDEX(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrate existing (run after all clients updated)
INSERT INTO app_settings (`key`, `value`) VALUES
('Dragon_currency', 'ج.م'),
('Dragon_pos_print_mode', 'thermal'),
('Dragon_product_source', 'both'),
('Dragon_default_sale_price_source', 'product'),
('Dragon_purchase_price_type', 'full_cost'),
('Dragon_sales_display_method', 'company'),
('Dragon_delivery_method', 'reps'),
('Dragon_sales_calc_order', 'discount_then_tax')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- Per-user
-- Run: php migrate_localstorage_to_db.php USER_ID

