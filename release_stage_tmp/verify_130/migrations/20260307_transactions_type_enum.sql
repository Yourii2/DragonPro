-- Migration: 20260307_transactions_type_enum
-- Adds transfer_in, transfer_out, other to transactions.type ENUM
-- Safe to run multiple times (ALTER COLUMN is idempotent for ENUM expansion).

ALTER TABLE `transactions`
  MODIFY COLUMN `type` enum(
    'sale',
    'purchase',
    'return_in',
    'return_out',
    'payment_in',
    'payment_out',
    'transfer_in',
    'transfer_out',
    'other'
  ) COLLATE utf8mb4_unicode_ci NOT NULL;
