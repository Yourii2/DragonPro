-- Extend user_defaults to support sales offices scope, similar to treasuries/warehouses

ALTER TABLE user_defaults
  ADD COLUMN default_sales_office_id INT DEFAULT NULL,
  ADD COLUMN can_change_sales_office TINYINT(1) DEFAULT 0;
