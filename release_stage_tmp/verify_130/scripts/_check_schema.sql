SELECT 'orders.sales_office_id' AS item,
       COUNT(*) AS exists_count
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME = 'sales_office_id';

SELECT 'user_defaults.default_sales_office_id' AS item,
       COUNT(*) AS exists_count
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'user_defaults'
  AND COLUMN_NAME = 'default_sales_office_id';

SELECT 'user_defaults.can_change_sales_office' AS item,
       COUNT(*) AS exists_count
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'user_defaults'
  AND COLUMN_NAME = 'can_change_sales_office';

SELECT 'permission_modules.ux_permission_modules_name' AS item,
       COUNT(*) AS exists_count
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'permission_modules'
  AND INDEX_NAME = 'ux_permission_modules_name';
