-- Migration: add `balance` column to `users` and backfill from `transactions`
-- Run this in your MySQL (phpMyAdmin / mysql CLI) while the app is stopped or in maintenance.

-- NOTE: Some MySQL versions do not support `ADD COLUMN IF NOT EXISTS`.
-- Prefer running the PHP script `scripts/add_users_balance_and_backfill.php`
-- which checks column existence and backfills balances safely.

-- If you prefer pure SQL and are sure the column doesn't exist, run:
-- ALTER TABLE `users` ADD COLUMN `balance` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `phone`;

-- Backfill users.balance from transactions (rep/employee)
UPDATE `users` u
LEFT JOIN (
  SELECT related_to_id AS user_id, COALESCE(SUM(amount),0) AS bal
  FROM transactions
  WHERE related_to_type IN ('rep','employee')
  GROUP BY related_to_id
) t ON u.id = t.user_id
SET u.balance = COALESCE(t.bal,0);
