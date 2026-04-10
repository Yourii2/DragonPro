-- Inventory audit tables

CREATE TABLE IF NOT EXISTS inventory_audits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    status ENUM('draft','pending','approved','rejected') DEFAULT 'draft',
    notes TEXT,
    rejection_reason TEXT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME NULL,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    INDEX (warehouse_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    audit_id INT NOT NULL,
    product_id INT NOT NULL,
    system_qty INT NOT NULL DEFAULT 0,
    counted_qty INT NOT NULL DEFAULT 0,
    diff_qty INT NOT NULL DEFAULT 0,
    notes TEXT,
    UNIQUE KEY ux_audit_product (audit_id, product_id),
    INDEX (audit_id),
    INDEX (product_id),
    FOREIGN KEY (audit_id) REFERENCES inventory_audits(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
