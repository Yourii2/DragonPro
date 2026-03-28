Permissions Module

Purpose: Explains the per-user permissions system (DB tables, API, admin UI).

Migration: Run `php scripts/seed_permissions.php` from the project root. That will apply `migrations/permissions.sql` and seed basic actions and modules.

API endpoints (module=permissions):
- getModules, createModule, updateModule, deleteModule
- getActions, createAction, updateAction, deleteAction
- getUserPermissions, setUserPermissions
- getUserDefaults, setUserDefaults

Behavior:
- If permission tables are empty or missing, the API falls back to permissive mode for backward compatibility.
- When tables are populated, `user_permissions` rows are enforced. If no explicit row exists for a user/module/action, the system allows `view` but denies add/edit/delete by default.

Seeder: Use `scripts/seed_permissions.php` to create the schema and seed basic actions/modules.
