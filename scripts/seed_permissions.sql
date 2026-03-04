-- Seed script: create pages for daily flows and grant admin access (user_id = 1)
-- Run: mysql -u root -p < seed_permissions.sql

-- Create top-level pages if missing
INSERT INTO permission_modules (name, parent_id, `order`)
SELECT 'sales-daily', NULL, 100
WHERE NOT EXISTS (SELECT 1 FROM permission_modules WHERE name = 'sales-daily');

INSERT INTO permission_modules (name, parent_id, `order`)
SELECT 'sales-update-status', NULL, 110
WHERE NOT EXISTS (SELECT 1 FROM permission_modules WHERE name = 'sales-update-status');

INSERT INTO permission_modules (name, parent_id, `order`)
SELECT 'close-daily', NULL, 120
WHERE NOT EXISTS (SELECT 1 FROM permission_modules WHERE name = 'close-daily');

-- Ensure sales-report exists under Reports (attempt to attach to parent named 'reports' or 'Reports')
INSERT INTO permission_modules (name, parent_id, `order`)
SELECT 'sales-report', (SELECT id FROM permission_modules WHERE LOWER(name) = 'reports' LIMIT 1), 50
WHERE NOT EXISTS (SELECT 1 FROM permission_modules WHERE name = 'sales-report');

-- Grant admin (user_id 1) access to the pages (upsert style)
-- If your DB has UNIQUE(user_id,page_slug) on user_page_permissions this will avoid duplicates.
INSERT INTO user_page_permissions (user_id, page_slug, can_access)
SELECT 1, 'sales-daily', 1
WHERE NOT EXISTS (SELECT 1 FROM user_page_permissions WHERE user_id = 1 AND page_slug = 'sales-daily');

INSERT INTO user_page_permissions (user_id, page_slug, can_access)
SELECT 1, 'sales-update-status', 1
WHERE NOT EXISTS (SELECT 1 FROM user_page_permissions WHERE user_id = 1 AND page_slug = 'sales-update-status');

INSERT INTO user_page_permissions (user_id, page_slug, can_access)
SELECT 1, 'close-daily', 1
WHERE NOT EXISTS (SELECT 1 FROM user_page_permissions WHERE user_id = 1 AND page_slug = 'close-daily');

INSERT INTO user_page_permissions (user_id, page_slug, can_access)
SELECT 1, 'sales-report', 1
WHERE NOT EXISTS (SELECT 1 FROM user_page_permissions WHERE user_id = 1 AND page_slug = 'sales-report');

-- Optionally, you may want to grant these pages to other roles/users as needed.

COMMIT;
