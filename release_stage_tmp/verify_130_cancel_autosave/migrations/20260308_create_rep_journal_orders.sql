-- Migration: 20260308 - Create rep_journal_orders table
-- Tracks order status changes throughout the rep daily journey
-- Status: with_rep, delivered, deferred, full_return, partial_return

CREATE TABLE IF NOT EXISTS `rep_journal_orders` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `journal_id`  INT NULL COMMENT 'FK to rep_daily_journal.id',
    `rep_id`      INT NOT NULL,
    `order_id`    INT NOT NULL,
    `status`      VARCHAR(32) NOT NULL DEFAULT 'with_rep'
                  COMMENT 'with_rep | delivered | deferred | full_return | partial_return',
    `event_date`  DATE NOT NULL,
    `event_time`  TIME NOT NULL,
    `employee`    VARCHAR(255) NULL,
    `notes`       TEXT NULL,
    `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_rep_order` (`rep_id`, `order_id`),
    INDEX `idx_rep_id`    (`rep_id`),
    INDEX `idx_order_id`  (`order_id`),
    INDEX `idx_event_date`(`event_date`),
    INDEX `idx_status`    (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
