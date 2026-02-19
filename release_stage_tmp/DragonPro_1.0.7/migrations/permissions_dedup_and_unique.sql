-- Fix permissions module duplication by deduplicating permission_modules by name,
-- then enforce uniqueness so repeated seeding won't create duplicates.

-- NOTE:
-- Some installs already have UNIQUE(user_id, module_id, action_id) on user_permissions.
-- When we remap duplicate module_id values to the canonical (MIN(id)) module, this can
-- temporarily create duplicates that violate the UNIQUE constraint.
-- We drop the UNIQUE index, remap, merge duplicates (keeping MAX(allowed)), then recreate it.

-- 0) Temporarily drop UNIQUE index to avoid collisions during remap
ALTER TABLE user_permissions
  DROP INDEX ux_user_module_action;

-- 1) Move user_permissions references to the canonical module id per name
UPDATE user_permissions up
JOIN permission_modules pm ON pm.id = up.module_id
JOIN (
  SELECT name, MIN(id) AS keep_id
  FROM permission_modules
  GROUP BY name
) k ON k.name = pm.name
SET up.module_id = k.keep_id
WHERE up.module_id <> k.keep_id;

-- 1b) Merge any duplicates produced by the remap (keep MAX(allowed))
UPDATE user_permissions up
JOIN (
  SELECT user_id, module_id, action_id, MAX(allowed) AS max_allowed, MIN(id) AS keep_row_id
  FROM user_permissions
  GROUP BY user_id, module_id, action_id
  HAVING COUNT(*) > 1
) d ON d.keep_row_id = up.id
SET up.allowed = d.max_allowed;

DELETE up
FROM user_permissions up
JOIN (
  SELECT user_id, module_id, action_id, MIN(id) AS keep_row_id
  FROM user_permissions
  GROUP BY user_id, module_id, action_id
  HAVING COUNT(*) > 1
) d ON d.user_id = up.user_id
   AND d.module_id = up.module_id
   AND d.action_id = up.action_id
   AND up.id <> d.keep_row_id;

-- 1c) Recreate UNIQUE index after cleanup
ALTER TABLE user_permissions
  ADD UNIQUE KEY ux_user_module_action (user_id, module_id, action_id);

-- 2) Delete duplicate modules (keep the smallest id per name)
DELETE pm
FROM permission_modules pm
JOIN (
  SELECT name, MIN(id) AS keep_id
  FROM permission_modules
  GROUP BY name
) k ON k.name = pm.name
WHERE pm.id <> k.keep_id;

-- 3) Enforce uniqueness moving forward
ALTER TABLE permission_modules
  ADD UNIQUE KEY ux_permission_modules_name (name);
