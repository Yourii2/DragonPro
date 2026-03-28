import { API_BASE_PATH } from './apiConfig';

let cachedPermissions: any[] | null = null;
let cachedUserId: number | null = null;

export async function loadMyPermissions(): Promise<any[]> {
  try {
    const user = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
    if (!user || !user.id) return [];
    if (cachedUserId !== null && cachedUserId !== user.id) {
      cachedPermissions = null;
    }
    const uid = user.id;
    const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserPermissions&user_id=${uid}`);
    const j = await res.json();
    if (j && j.success) {
      cachedUserId = uid;
      cachedPermissions = j.data || [];
      try { sessionStorage.setItem('Dragon_user_permissions', JSON.stringify(cachedPermissions)); } catch(e) {}
      return cachedPermissions;
    }
  } catch (e) {
    console.error('Failed to load permissions', e);
  }
  // Fallback to any cached copy
  const s = sessionStorage.getItem('Dragon_user_permissions');
  if (s) {
    try { cachedPermissions = JSON.parse(s); return cachedPermissions; } catch(e) {}
  }
  cachedPermissions = [];
  return cachedPermissions;
}

export function getCachedPermissions(): any[] {
  if (cachedPermissions) return cachedPermissions;
  const s = sessionStorage.getItem('Dragon_user_permissions');
  if (s) {
    try { cachedPermissions = JSON.parse(s); return cachedPermissions; } catch(e) { /* ignore */ }
  }
  return [];
}

// moduleName: e.g. 'customers', actionCode: e.g. 'view'|'add'|'edit'|'delete'
export function hasPermission(moduleName: string, actionCode: string): boolean {
  const perms = getCachedPermissions();
  const m = (moduleName || '').toString().toLowerCase();
  const a = (actionCode || '').toString().toLowerCase();

  if (!perms || perms.length === 0) {
    return false;
  }

  // Find a matching permission entry
  const found = perms.find(p => {
    const mod = (p.module_name || p.name || '').toString().toLowerCase();
    const code = (p.action_code || p.code || '').toString().toLowerCase();
    return (mod === m || String(p.module_id) === m) && (code === a || String(p.action_id) === a);
  });
  if (!found) return false;
  return Boolean(found.allowed);
}

export async function ensurePermissionsLoaded(): Promise<void> {
  if (cachedPermissions && Array.isArray(cachedPermissions)) return;
  await loadMyPermissions();
}

export default { loadMyPermissions, getCachedPermissions, hasPermission, ensurePermissionsLoaded };

