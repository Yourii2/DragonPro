Rollout Plan

1. Apply DB migration and seed permissions:

   php scripts/seed_permissions.php

2. Verify admin user can access `Permissions` admin page and assign module/action permissions to users.

3. For each user who needs locked defaults, set entries via `setUserDefaults` endpoint or the Admin UI.

4. Test key flows (sales, transactions, receivings, stock movements) with a non-admin user to ensure defaults and locks apply.

5. Monitor logs and API responses for 403/permission errors and adjust `user_permissions` records accordingly.
