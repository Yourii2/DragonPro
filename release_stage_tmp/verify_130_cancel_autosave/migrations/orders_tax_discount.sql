-- Add tax/discount fields for sales invoices

ALTER TABLE orders
    ADD COLUMN discount_type VARCHAR(20) NULL,
    ADD COLUMN discount_value DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN tax_type VARCHAR(20) NULL,
    ADD COLUMN tax_value DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN tax_amount DECIMAL(10, 2) DEFAULT 0;
