-- Link orders to sales offices (optional)

ALTER TABLE orders
    ADD COLUMN sales_office_id INT NULL,
    ADD INDEX idx_orders_sales_office_id (sales_office_id);
