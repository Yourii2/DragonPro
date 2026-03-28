-- CRM/SRM improvements: customer archive + interactions

ALTER TABLE customers
  ADD COLUMN is_archived TINYINT(1) DEFAULT 0,
  ADD COLUMN archived_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS customer_interactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  interaction_type VARCHAR(50) NOT NULL,
  note TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(customer_id),
  INDEX(created_at),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
