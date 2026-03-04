Release 1.1.7 - 2026-02-26

Summary
- Persist client-side settings & caches to database (added migration + tables).
- Added `localstorage_sync.php` API to push/pull frontend localStorage into DB.
- Added CLI migration helper `scripts/migrate_localstorage.php` to import JSON export.
- Patched `get_settings.php` and `save_settings.php` to prefer new `app_settings` table.
- Added SQL migration file `migrations/20260226_create_client_storage_tables.sql`.
- Frontend/server fixes: improved barcode/order validation and SalesDaily changes (already committed in previous edits).

Files to include in release
- migrations/20260226_create_client_storage_tables.sql
- scripts/migrate_localstorage.php
- components/localstorage_sync.php
- components/get_settings.php (patched)
- components/save_settings.php (patched)
- version.json (bumped to 1.1.7)

DB upgrade steps
1. Run the migration SQL on your MySQL/MariaDB server:

   mysql -u <user> -p < database_name < migrations/20260226_create_client_storage_tables.sql

2. (Optional) Import existing browser localStorage export:

   php scripts/migrate_localstorage.php /path/to/localstorage_export.json [user_id]

3. Alternatively use the API from the frontend to push/pull keys:

   POST components/localstorage_sync.php?op=push  { user_id, items }
   GET  components/localstorage_sync.php?op=pull&user_id=<id>

Notes
- Test in a staging environment before applying to production.
- Backup your DB before running the migration.
