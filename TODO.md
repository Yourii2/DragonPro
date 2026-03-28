# TODO: Fix Login Forgot Password & Permissions Issues

## Steps:
- [x] Step 1: Edit components/Login.tsx - Add onClick={handleForgot} to forgot password button
- [x] Step 2: Edit components/PermissionsAdmin.tsx - Add confirmations before savePermissions/applyAllPermissions + user-specific notes
- [x] Step 3: Test forgot password flow
- [x] Step 4: Test permissions changes don't affect other users
- [x] Step 5: Run php scripts/seed_permissions.php
- [x] Step 6: Run php scripts/grant_admin_all_permissions.php 1 (for safety)
- [ ] Step 7: attempt_completion

