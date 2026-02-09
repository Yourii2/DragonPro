-- Finance chart of accounts + journal postings

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

-- Seed basic chart of accounts (ignore if already created)
INSERT IGNORE INTO accounts (code, name, type) VALUES
    ('1000', 'الخزينة', 'asset'),
    ('1100', 'العملاء', 'asset'),
    ('2000', 'الموردون', 'liability'),
    ('3000', 'رأس المال', 'equity'),
    ('4000', 'إيرادات المبيعات', 'income'),
    ('5000', 'مصروفات عامة', 'expense');
