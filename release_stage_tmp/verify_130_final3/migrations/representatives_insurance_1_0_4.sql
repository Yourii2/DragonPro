-- تحديث قاعدة البيانات للإصدار 1.0.4
-- آخر تحديث: 2026-02-11
-- إضافة عمود التأمين للمناديب
-- ملاحظة: المناديب يتم تخزينهم في جدول users بدور role='representative'

-- إضافة أعمدة التأمين على جدول users (بشكل آمن قدر الإمكان)
SET @db := DATABASE();

SET @col_ins_paid := (
	SELECT COUNT(*) FROM information_schema.COLUMNS
	WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'insurance_paid'
);
SET @sql_ins_paid := IF(@col_ins_paid = 0,
	"ALTER TABLE users ADD COLUMN insurance_paid TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'هل دفع تأمين'",
	"SELECT 1"
);
PREPARE stmt1 FROM @sql_ins_paid; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col_ins_amt := (
	SELECT COUNT(*) FROM information_schema.COLUMNS
	WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'insurance_amount'
);
SET @sql_ins_amt := IF(@col_ins_amt = 0,
	"ALTER TABLE users ADD COLUMN insurance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'مبلغ التأمين المدفوع'",
	"SELECT 1"
);
PREPARE stmt2 FROM @sql_ins_amt; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- إضافة خزينة ثابتة باسم "تأمين المناديب" إذا لم تكن موجودة
SET @col_is_fixed := (
	SELECT COUNT(*) FROM information_schema.COLUMNS
	WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treasuries' AND COLUMN_NAME = 'is_fixed'
);
SET @col_created_at := (
	SELECT COUNT(*) FROM information_schema.COLUMNS
	WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treasuries' AND COLUMN_NAME = 'created_at'
);

SET @sql_treasury := CASE
	WHEN @col_is_fixed > 0 AND @col_created_at > 0 THEN
		"INSERT INTO treasuries (name, is_fixed, created_at)\n     SELECT 'تأمين المناديب', 1, NOW()\n     WHERE NOT EXISTS (SELECT 1 FROM treasuries WHERE name = 'تأمين المناديب')"
	WHEN @col_is_fixed > 0 AND @col_created_at = 0 THEN
		"INSERT INTO treasuries (name, is_fixed)\n     SELECT 'تأمين المناديب', 1\n     WHERE NOT EXISTS (SELECT 1 FROM treasuries WHERE name = 'تأمين المناديب')"
	WHEN @col_is_fixed = 0 AND @col_created_at > 0 THEN
		"INSERT INTO treasuries (name, created_at)\n     SELECT 'تأمين المناديب', NOW()\n     WHERE NOT EXISTS (SELECT 1 FROM treasuries WHERE name = 'تأمين المناديب')"
	ELSE
		"INSERT INTO treasuries (name)\n     SELECT 'تأمين المناديب'\n     WHERE NOT EXISTS (SELECT 1 FROM treasuries WHERE name = 'تأمين المناديب')"
END;

PREPARE stmt3 FROM @sql_treasury; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;
