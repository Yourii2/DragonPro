export const SQL_SCHEMA = `
-- ERP Database Schema for Dragon ERP Pro
-- Updated: Full Inventory Tracking (Variants + Movement History)

-- 1. Users & Permissions
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'representative', 'accountant') DEFAULT 'representative',
    restricted_treasury_id INT DEFAULT NULL,
    restricted_warehouse_id INT DEFAULT NULL,
    avatar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_page_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    page_slug VARCHAR(100) NOT NULL,
    can_access BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, page_slug)
);

-- 2. Infrastructure
CREATE TABLE IF NOT EXISTS warehouses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treasuries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    current_balance DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. CRM & SRM
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone1 VARCHAR(20),
    phone2 VARCHAR(20),
    address TEXT,
    governorate VARCHAR(100),
    landmark TEXT,
    total_debit DECIMAL(15, 2) DEFAULT 0,
    total_credit DECIMAL(15, 2) DEFAULT 0,
    is_archived TINYINT(1) DEFAULT 0,
    archived_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    total_debit DECIMAL(15, 2) DEFAULT 0,
    total_credit DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Offices: used by the Sales module to assign orders to offices
CREATE TABLE IF NOT EXISTS sales_offices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phones TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- 4. Inventory & Products (Updated with Variants)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    color VARCHAR(50),           -- New: Color
    size VARCHAR(50),            -- New: Size
    cost_price DECIMAL(10, 2) DEFAULT 0,
    sale_price DECIMAL(10, 2) DEFAULT 0,
    reorder_level INT DEFAULT 5, -- Alert Quantity
    category VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock: Quantity per warehouse for each Product/Variant
CREATE TABLE IF NOT EXISTS stock (
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT DEFAULT 0,
    PRIMARY KEY (product_id, warehouse_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- Product Movements: Tracking Table (كارت الصنف)
CREATE TABLE IF NOT EXISTS product_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    movement_type ENUM('purchase', 'sale', 'return_in', 'return_out', 'transfer_in', 'transfer_out', 'adjustment', 'initial_balance') NOT NULL,
    quantity_change INT NOT NULL, -- (+ for In, - for Out)
    previous_quantity INT NOT NULL, 
    new_quantity INT NOT NULL,      
    reference_id INT, -- Order ID / Transaction ID
    reference_type VARCHAR(50), -- 'order', 'purchase_invoice'
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

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

-- 5. Orders & Sales
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    rep_id INT,
    sales_office_id INT NULL,
    status ENUM('pending', 'with_rep', 'delivered', 'returned', 'partial', 'postponed') DEFAULT 'pending',
    total_amount DECIMAL(15, 2) NOT NULL,
    shipping_fees DECIMAL(10, 2) DEFAULT 0,
    discount_type VARCHAR(20),
    discount_value DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tax_type VARCHAR(20),
    tax_value DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_orders_sales_office_id (sales_office_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (rep_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    notes TEXT,
    rep_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (order_id),
    INDEX (status),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    doc_type VARCHAR(50) NOT NULL,
    doc_url TEXT NOT NULL,
    notes TEXT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (order_id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 6. Transactions (Ledger)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('sale', 'purchase', 'return_in', 'return_out', 'payment_in', 'payment_out', 'expense', 'transfer') NOT NULL,
    warehouse_id INT,
    treasury_id INT,
    related_to_type ENUM('customer', 'supplier', 'employee', 'none'),
    related_to_id INT,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT, -- JSON details for invoices
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (treasury_id) REFERENCES treasuries(id)
);

-- 6.1 Finance Chart & Journal
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('asset','liability','equity','income','expense') NOT NULL,
    parent_id INT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code),
    INDEX(parent_id),
    FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_date DATE NOT NULL,
    memo TEXT,
    source_type VARCHAR(50) NULL,
    source_id INT NULL,
    posted TINYINT(1) DEFAULT 0,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(source_type, source_id),
    INDEX(entry_date)
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id INT NOT NULL,
    account_id INT NOT NULL,
    debit DECIMAL(15, 2) DEFAULT 0,
    credit DECIMAL(15, 2) DEFAULT 0,
    line_memo TEXT,
    FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

-- 7. Settings
CREATE TABLE IF NOT EXISTS settings (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT
);

-- 8. Representatives Custody
CREATE TABLE IF NOT EXISTS rep_stock_custody (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rep_id INT NOT NULL, 
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rep_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rep_cash_custody (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rep_id INT NOT NULL, 
    amount DECIMAL(15, 2) NOT NULL,
    treasury_id INT NOT NULL, 
    notes TEXT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMP NULL,
    FOREIGN KEY (rep_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (treasury_id) REFERENCES treasuries(id) ON DELETE CASCADE
);

-- 9. Human Resources Management (HRM)
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255),
    salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    hire_date DATE,
    phone VARCHAR(20),
    status ENUM('active', 'inactive', 'on_leave') DEFAULT 'active',
    attendance_enabled TINYINT(1) DEFAULT 1,
    default_shift_id INT DEFAULT NULL,
    fingerprint_device_id INT DEFAULT NULL,
    fingerprint_user_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    treasury_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    type ENUM('advance', 'bonus', 'penalty', 'salary') NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    status ENUM('pending', 'paid', 'deducted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (treasury_id) REFERENCES treasuries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_salaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    month VARCHAR(7) NOT NULL, -- e.g., '2024-07'
    base_salary DECIMAL(10, 2) NOT NULL,
    deductions DECIMAL(10, 2) DEFAULT 0.00,
    bonuses DECIMAL(10, 2) DEFAULT 0.00,
    net_salary DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid') DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    notes TEXT,
    UNIQUE(employee_id, month),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- 9.1 Attendance (Devices + Shifts + Logs)
CREATE TABLE IF NOT EXISTS attendance_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    vendor ENUM('hikvision', 'zkteco', 'adms', 'other') DEFAULT 'other',
    protocol VARCHAR(50) DEFAULT 'http',
    ip VARCHAR(100),
    port INT DEFAULT 80,
    serial_number VARCHAR(100),
    username VARCHAR(255),
    password VARCHAR(255),
    location VARCHAR(255),
    enabled TINYINT(1) DEFAULT 1,
    last_sync_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_device_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    employee_id INT NOT NULL,
    device_user_id VARCHAR(100) NOT NULL,
    driver VARCHAR(50) DEFAULT NULL,
    driver_config TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, device_user_id),
    UNIQUE(device_id, employee_id),
    FOREIGN KEY (device_id) REFERENCES attendance_devices(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT DEFAULT 0,
    grace_in_minutes INT DEFAULT 0,
    grace_out_minutes INT DEFAULT 0,
    late_penalty_per_minute DECIMAL(10, 2) DEFAULT 0.00,
    early_leave_penalty_per_minute DECIMAL(10, 2) DEFAULT 0.00,
    absence_penalty_per_day DECIMAL(10, 2) DEFAULT 0.00,
    overtime_rate_per_hour DECIMAL(10, 2) DEFAULT 0.00,
    is_night_shift TINYINT(1) DEFAULT 0,
    weekly_off_days VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    shift_id INT NOT NULL,
    day_of_week TINYINT NOT NULL,
    valid_from DATE NULL,
    valid_to DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    holiday_date DATE NOT NULL,
    is_paid TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(holiday_date)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NULL,
    device_id INT NULL,
    device_user_id VARCHAR(100) NULL,
    check_time DATETIME NOT NULL,
    direction ENUM('in', 'out', 'unknown') DEFAULT 'unknown',
    source VARCHAR(50) DEFAULT 'manual',
    raw_payload TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(employee_id),
    INDEX(device_id),
    INDEX(check_time),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES attendance_devices(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance_daily_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    shift_id INT NULL,
    work_date DATE NOT NULL,
    first_in DATETIME NULL,
    last_out DATETIME NULL,
    late_minutes INT DEFAULT 0,
    early_leave_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    is_absent TINYINT(1) DEFAULT 0,
    status ENUM('present', 'late', 'absent', 'leave', 'holiday') DEFAULT 'present',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,
    UNIQUE(employee_id, work_date),
    INDEX(work_date),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id) ON DELETE SET NULL
);

-- 10. Permissions (Per-user, per-module, per-action)
CREATE TABLE IF NOT EXISTS permission_modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    UNIQUE KEY ux_permission_modules_name (name),
    parent_id INT DEFAULT NULL,
    \`order\` INT DEFAULT 0,
    INDEX(parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_device_workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    worker_id INT NOT NULL,
    device_user_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, device_user_id),
    UNIQUE(device_id, worker_id),
    INDEX(worker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_worker_daily_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    shift_id INT NULL,
    work_date DATE NOT NULL,
    first_in DATETIME NULL,
    last_out DATETIME NULL,
    late_minutes INT DEFAULT 0,
    early_leave_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    is_absent TINYINT(1) DEFAULT 0,
    status ENUM('present', 'late', 'absent', 'leave', 'holiday') DEFAULT 'present',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,
    UNIQUE(worker_id, work_date),
    INDEX(work_date),
    INDEX(worker_id)
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

-- Seed common actions
INSERT IGNORE INTO permission_actions (name, code) VALUES
    ('عرض', 'view'),
    ('إضافة', 'add'),
    ('تعديل', 'edit'),
    ('حذف', 'delete'),
    ('طباعة', 'print'),
    ('تصدير', 'export');

-- Seed common modules (use english slugs as keys; UI will translate labels)
INSERT IGNORE INTO permission_modules (name, parent_id, \`order\`) VALUES
    ('users', NULL, 0),
    ('customers', NULL, 0),
    ('suppliers', NULL, 0),
    ('treasuries', NULL, 0),
    ('warehouses', NULL, 0),
    ('sales_offices', NULL, 0),
    ('products', NULL, 0),
    ('orders', NULL, 0),
    ('transactions', NULL, 0),
    ('sales', NULL, 0),
    ('employees', NULL, 0),
    ('stock', NULL, 0),
    ('product_movements', NULL, 0),
    ('reports', NULL, 0),
    ('finance', NULL, 0),
    ('inventory', NULL, 0),
    ('settings', NULL, 0),
    ('permissions', NULL, 0);

-- Grant all actions on all modules to the initial super-admin (user_id = 1)
-- This will create rows for user_id=1; if the admin user is created later with id=1,
-- they will already have permissions. Adjust your setup flow if you create the admin with
-- a different id.
INSERT IGNORE INTO user_permissions (user_id, module_id, action_id, allowed)
SELECT 1 AS user_id, m.id AS module_id, a.id AS action_id, 1 AS allowed
FROM permission_modules m
CROSS JOIN permission_actions a;

-- Give user_id=1 unrestricted treasury/warehouse scope (can change all)
INSERT IGNORE INTO user_defaults (user_id, default_warehouse_id, default_treasury_id, default_sales_office_id, can_change_warehouse, can_change_treasury, can_change_sales_office)
VALUES (1, NULL, NULL, NULL, 1, 1, 1);
-- 11. Factory & Manufacturing

-- Fabrics (الأقمشة)
CREATE TABLE IF NOT EXISTS fabrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    color VARCHAR(50),
    size VARCHAR(50),
    material VARCHAR(100),
    quantity INT DEFAULT 0,
    min_stock INT DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'متر',
    cost_price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accessories (الاكسسوارات)
CREATE TABLE IF NOT EXISTS accessories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    type VARCHAR(50),
    color VARCHAR(50),
    size VARCHAR(50),
    quantity INT DEFAULT 0,
    min_stock INT DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'قطعة',
    cost_price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fabric Stock: Quantity per warehouse for each Fabric
CREATE TABLE IF NOT EXISTS fabric_stock (
    fabric_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity DECIMAL(10,4) DEFAULT 0,
    PRIMARY KEY (fabric_id, warehouse_id),
    FOREIGN KEY (fabric_id) REFERENCES fabrics(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- Fabric Movements: Tracking Table (كارت القماش)
CREATE TABLE IF NOT EXISTS fabric_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fabric_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity_change DECIMAL(10,4) NOT NULL,
    previous_quantity DECIMAL(10,4) NOT NULL,
    new_quantity DECIMAL(10,4) NOT NULL,
    reference_id INT,
    reference_type VARCHAR(50),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (fabric_id),
    INDEX (warehouse_id),
    INDEX (created_at),
    FOREIGN KEY (fabric_id) REFERENCES fabrics(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Accessory Stock: Quantity per warehouse for each Accessory
CREATE TABLE IF NOT EXISTS accessory_stock (
    accessory_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT DEFAULT 0,
    PRIMARY KEY (accessory_id, warehouse_id),
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- Accessory Movements: Tracking Table (كارت الاكسسوار)
CREATE TABLE IF NOT EXISTS accessory_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    accessory_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity_change INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reference_id INT,
    reference_type VARCHAR(50),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (accessory_id),
    INDEX (warehouse_id),
    INDEX (created_at),
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Colors (الألوان)
CREATE TABLE IF NOT EXISTS colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sizes (المقاسات)
CREATE TABLE IF NOT EXISTS sizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Factory Products (منتجات المصنع)
CREATE TABLE IF NOT EXISTS factory_products (
    attendance_enabled TINYINT(1) DEFAULT 0,
    default_shift_id INT DEFAULT NULL,
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    type ENUM('individual','composite') NOT NULL,
    sale_price DECIMAL(10,2) DEFAULT 0,
    min_stock INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Factory Stock: Quantity per warehouse for each Factory Product
CREATE TABLE IF NOT EXISTS factory_stock (
    factory_product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT DEFAULT 0,
    PRIMARY KEY (factory_product_id, warehouse_id),
    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- Factory Product Movements: Tracking Table (كارت منتجات المصنع)
CREATE TABLE IF NOT EXISTS factory_product_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factory_product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity_change INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reference_id INT,
    reference_type VARCHAR(50),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (factory_product_id),
    INDEX (warehouse_id),
    INDEX (created_at),
    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Dispatches (Send Factory Products to Sales)
CREATE TABLE IF NOT EXISTS dispatches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factory_product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity INT NOT NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX (factory_product_id),
    INDEX (warehouse_id),
    INDEX (created_at),
    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Factory Product Sizes (المقاسات المتاحة للمنتج الفردي)
CREATE TABLE IF NOT EXISTS factory_product_sizes (
    factory_product_id INT NOT NULL,
    size_id INT NOT NULL,
    PRIMARY KEY (factory_product_id, size_id),
    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE CASCADE
);

-- Production Stages (مراحل الانتاج)
CREATE TABLE IF NOT EXISTS production_stages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    order_num INT DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Factory Product Stages (مراحل التصنيع للمنتج الفردي)
CREATE TABLE IF NOT EXISTS factory_product_stages (
    factory_product_id INT NOT NULL,
    stage_id INT NOT NULL,
    PRIMARY KEY (factory_product_id, stage_id),
    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES production_stages(id) ON DELETE CASCADE
);

-- Accessories used per Stage for a Factory Product
CREATE TABLE IF NOT EXISTS factory_product_stage_accessories (
    factory_product_id INT NOT NULL,
    stage_id INT NOT NULL,
    accessory_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (factory_product_id, stage_id, accessory_id),
    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES production_stages(id) ON DELETE CASCADE,
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE
);

-- Composite Product Items (مكونات المنتج المجمع)
CREATE TABLE IF NOT EXISTS composite_product_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    composite_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    FOREIGN KEY (composite_id) REFERENCES factory_products(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES factory_products(id) ON DELETE CASCADE
);

-- Workers (العمال)
CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    job_title VARCHAR(100),
    salary_type ENUM('daily','weekly','monthly','piecework') DEFAULT 'daily',
    salary_amount DECIMAL(10,2) DEFAULT 0.00,
    hire_date DATE,
    phone VARCHAR(20),
    fingerprint_no VARCHAR(50) NULL,
    status ENUM('active','inactive','on_leave') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (fingerprint_no)
);

-- Cutting Orders (أوامر القص)
CREATE TABLE IF NOT EXISTS cutting_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id INT NOT NULL,
    fabric_id INT NOT NULL,
    factory_product_id INT NOT NULL,
    cut_quantity INT NOT NULL,
    consumption_per_piece DECIMAL(10,4) NOT NULL DEFAULT 0,
    total_consumption DECIMAL(10,4) NOT NULL DEFAULT 0,
    available_qty INT NOT NULL DEFAULT 0,
    in_production_qty INT NOT NULL DEFAULT 0,
    ready_qty INT NOT NULL DEFAULT 0,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (warehouse_id),
    INDEX (fabric_id),
    INDEX (factory_product_id),
    INDEX (created_at)
);

-- Manufacturing Orders (أوامر التصنيع)
CREATE TABLE IF NOT EXISTS manufacturing_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cutting_order_id INT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    status ENUM('draft','in_progress','completed','cancelled') DEFAULT 'draft',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES factory_products(id)
);

-- Manufacturing Order Stages (تتبع مراحل التصنيع لكل أمر)
CREATE TABLE IF NOT EXISTS manufacturing_order_stages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    stage_id INT NOT NULL,
    started_at DATETIME,
    finished_at DATETIME,
    worker_id INT,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES production_stages(id),
    FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- Factory Receiving (استلام من المصنع)
CREATE TABLE IF NOT EXISTS factory_receiving (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    received_by INT,
    received_at DATETIME,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id)
);

-- Worker Salaries (رواتب العمال)
CREATE TABLE IF NOT EXISTS worker_salaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    period_type ENUM('day','week','month','piecework') NOT NULL,
    period_value VARCHAR(20) NOT NULL,
    base_salary DECIMAL(10,2) NOT NULL,
    deductions DECIMAL(10,2) DEFAULT 0.00,
    bonuses DECIMAL(10,2) DEFAULT 0.00,
    net_salary DECIMAL(10,2) NOT NULL,
    status ENUM('pending','paid') DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    notes TEXT,
    UNIQUE(worker_id, period_type, period_value),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

-- Worker Transactions (معاملات العمال)
CREATE TABLE IF NOT EXISTS worker_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type ENUM('advance','bonus','penalty','piecework','salary') NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    status ENUM('pending','paid','deducted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

-- Product Tracking (تتبع المنتج من القص للعميل)
CREATE TABLE IF NOT EXISTS product_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    manufacturing_order_id INT NOT NULL,
    product_id INT NOT NULL,
    stage_id INT NOT NULL,
    worker_id INT,
    size_id INT NULL,
    piece_uid VARCHAR(32) NULL,
    is_paid TINYINT(1) NOT NULL DEFAULT 0,
    piece_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    started_at DATETIME,
    finished_at DATETIME,
    notes TEXT,
    customer_id INT,
    delivered_at DATETIME,
    FOREIGN KEY (manufacturing_order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES factory_products(id),
    FOREIGN KEY (stage_id) REFERENCES production_stages(id),
    FOREIGN KEY (worker_id) REFERENCES workers(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Update purchase invoice to support fabrics/accessories
-- (You may need to update purchase logic in backend)

`;