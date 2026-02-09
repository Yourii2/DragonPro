-- Attendance module migration

ALTER TABLE employees
    ADD COLUMN attendance_enabled TINYINT(1) DEFAULT 1,
    ADD COLUMN default_shift_id INT DEFAULT NULL,
    ADD COLUMN fingerprint_device_id INT DEFAULT NULL,
    ADD COLUMN fingerprint_user_id VARCHAR(100);

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

ALTER TABLE attendance_shifts
    ADD COLUMN weekly_off_days VARCHAR(50) DEFAULT NULL;

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
