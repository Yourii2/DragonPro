-- Add device driver fields + workers attendance support

-- 1) attendance_devices: driver fields
ALTER TABLE attendance_devices
  ADD COLUMN driver VARCHAR(50) DEFAULT NULL AFTER protocol,
  ADD COLUMN driver_config TEXT NULL AFTER driver;

CREATE INDEX idx_attendance_devices_vendor ON attendance_devices (vendor);

-- 2) workers: attendance fields
ALTER TABLE workers
  ADD COLUMN attendance_enabled TINYINT(1) DEFAULT 0 AFTER fingerprint_no,
  ADD COLUMN default_shift_id INT DEFAULT NULL AFTER attendance_enabled;

-- 3) worker-device mapping
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

-- 4) worker daily summary
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
