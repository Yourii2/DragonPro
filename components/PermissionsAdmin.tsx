import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { MENU_ITEMS } from '../constants';
import CustomSelect from './CustomSelect';

const PermissionsAdmin: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [userPerms, setUserPerms] = useState<any[]>([]);
  const [userPages, setUserPages] = useState<any[]>([]);
  const [expandedPages, setExpandedPages] = useState<string[]>([]);
  const [showManagement, setShowManagement] = useState<boolean>(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [uRes,mRes,aRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`).then(r=>r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getModules`).then(r=>r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getActions`).then(r=>r.json())
      ]);
      if (uRes.success) {
        const rawUsers = uRes.data || [];
        const filteredUsers = rawUsers.filter((u: any) => {
          const role = (u?.role || '').toString().toLowerCase();
          return role !== 'representative';
        });
        setUsers(filteredUsers);
      }
      if (mRes.success) setModules(mRes.data || []);
      if (aRes.success) setActions(aRes.data || []);
    } catch (e) { console.error(e); }
  };

  const createModule = async (name:string, parent_id:number|null) => {
    try {
      const body = { name, parent_id };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=createModule`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) { Swal.fire('تم', 'تم إنشاء القسم', 'success'); fetchAll(); } else Swal.fire('فشل', j.message||'خطأ', 'error');
    } catch (e) { console.error(e); Swal.fire('خطأ', 'فشل إنشاء القسم', 'error'); }
  };

  const createAction = async (name:string, code:string) => {
    try {
      const body = { name, code };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=createAction`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) { Swal.fire('تم', 'تم إنشاء الإجراء', 'success'); fetchAll(); } else Swal.fire('فشل', j.message||'خطأ', 'error');
    } catch (e) { console.error(e); Swal.fire('خطأ', 'فشل إنشاء الإجراء', 'error'); }
  };

  const loadUserPerms = async (uid:number) => {
    setSelectedUser(uid);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserPermissions&user_id=${uid}`);
      const j = await res.json();
      if (j.success) setUserPerms(j.data || []);
      // load page toggles
      try {
        const r2 = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserPages&user_id=${uid}`);
        const j2 = await r2.json();
        if (j2.success) setUserPages(j2.data || []);
        else setUserPages([]);
      } catch (e) { setUserPages([]); }
    } catch (e) { console.error(e); }
  };

  const permAllowed = (moduleId:number, actionId:number) => {
    const p = userPerms.find((x:any)=>x.module_id==moduleId && x.action_id==actionId);
    return p ? Boolean(p.allowed) : false;
  };

  const translateAction = (act:any) => {
    const code = (act.code || '').toString().toLowerCase();
    const map: Record<string,string> = {
      view: 'عرض',
      add: 'إضافة',
      create: 'إنشاء',
      edit: 'تعديل',
      update: 'تعديل',
      delete: 'حذف',
      remove: 'حذف',
      approve: 'موافقة',
      manage: 'إدارة',
      list: 'قائمة',
      print: 'طباعة',
      export: 'تصدير'
    };
    return map[code] || act.name || code || 'إجراء';
  };

  const translateModule = (mod:any) => {
    const key = (mod.slug || mod.name || '').toString().toLowerCase();
    const map: Record<string,string> = {
      users: 'المستخدمون',
      customers: 'العملاء',
      suppliers: 'الموردون',
      treasuries: 'الخزائن',
      warehouses: 'المستودعات',
      sales_offices: 'مكاتب المبيعات',
      products: 'المنتجات',
      orders: 'الطلبيات',
      transactions: 'المعاملات',
      sales: 'المبيعات',
      employees: 'الموظفين',
      stock: 'المخزون',
      product_movements: 'حركات المنتجات',
      reports: 'التقارير',
      finance: 'المالية',
      inventory: 'المخزون',
      settings: 'الإعدادات'
    };
    return map[key] || mod.name || key || 'قسم';
  };

  const togglePerm = (moduleId:number, actionId:number) => {
    const exists = userPerms.find((x:any)=>x.module_id==moduleId && x.action_id==actionId);
    let next = [...userPerms];
    if (exists) {
      next = next.map(x => x.module_id==moduleId && x.action_id==actionId ? { ...x, allowed: exists.allowed ? 0 : 1 } : x);
    } else {
      next.push({ user_id: selectedUser, module_id: moduleId, action_id: actionId, allowed: 1 });
    }
    setUserPerms(next);
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    try {
      const body = { user_id: selectedUser, permissions: userPerms };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=setUserPermissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) Swal.fire('تم', 'تم حفظ الصلاحيات', 'success'); else Swal.fire('فشل', j.message || 'خطأ', 'error');
    } catch (e) { console.error(e); Swal.fire('خطأ', 'فشل حفظ الصلاحيات', 'error'); }
  };

  const togglePageAccess = async (page_slug: string, allowed: boolean) => {
    if (!selectedUser) return;
    try {
      const body = { user_id: selectedUser, pages: [{ page_slug, can_access: allowed ? 1 : 0 }] };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=setUserPages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) {
        // update local state
        setUserPages(prev => {
          const next = prev.filter(p => (p.page_slug || '').toString().toLowerCase() !== page_slug.toLowerCase());
          next.push({ page_slug, can_access: allowed ? 1 : 0 });
          return next;
        });
        Swal.fire('تم', `تم ${allowed ? 'فتح' : 'إغلاق'} القسم.`, 'success');
      } else {
        Swal.fire('فشل', j.message || 'خطأ', 'error');
      }
    } catch (e) { console.error(e); Swal.fire('خطأ', 'فشل تحديث حالة القسم', 'error'); }
  };

  const moduleToPageSlug = (mod: any) => {
    const key = (mod.slug || mod.name || '').toString().toLowerCase();
    const map: Record<string,string> = {
      customers: 'crm',
      suppliers: 'srm',
      treasuries: 'finance',
      transactions: 'finance',
      stock: 'inventory',
      products: 'inventory',
      warehouses: 'inventory',
      product_movements: 'inventory',
      employees: 'hrm',
      users: 'admin',
      permissions: 'admin'
    };
    return map[key] || key;
  };

  const sidebarSections = MENU_ITEMS
    .map((i: any) => ({ slug: String(i.slug || ''), label: String(i.label || i.slug || '') }))
    .filter((i: any) => i.slug);

  const pageSlugsAll = Array.from(new Set(sidebarSections.map((s: any) => s.slug)));

  const isPageAllowed = (pageSlug: string) => {
    const slug = (pageSlug || '').toString().toLowerCase();
    const entry = userPages.find((p: any) => (p.page_slug || '').toString().toLowerCase() === slug);
    return entry ? Boolean(entry.can_access) : true;
  };

  const applyAllPermissions = async (allowed: boolean) => {
    if (!selectedUser) return;
    const confirm = await Swal.fire({
      title: allowed ? 'تأكيد منح جميع الصلاحيات' : 'تأكيد حذف جميع الصلاحيات',
      text: allowed ? 'سيتم تفعيل جميع الصلاحيات لهذا المستخدم.' : 'سيتم إلغاء جميع الصلاحيات لهذا المستخدم.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) return;

    const allPerms = modules.flatMap(mod =>
      actions.map(act => ({
        user_id: selectedUser,
        module_id: mod.id,
        action_id: act.id,
        allowed: allowed ? 1 : 0
      }))
    );

    try {
      const body = { user_id: selectedUser, permissions: allPerms };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=setUserPermissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (!j.success) {
        Swal.fire('فشل', j.message || 'خطأ', 'error');
        return;
      }
      setUserPerms(allPerms);

      const pagesPayload = pageSlugsAll.map(slug => ({ page_slug: slug, can_access: allowed ? 1 : 0 }));
      const resPages = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=setUserPages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser, pages: pagesPayload })
      });
      const jPages = await resPages.json();
      if (!jPages.success) {
        Swal.fire('تنبيه', jPages.message || 'تم حفظ الصلاحيات ولكن فشل تحديث الصفحات', 'warning');
      } else {
        setUserPages(pagesPayload);
      }
      Swal.fire('تم', allowed ? 'تم منح جميع الصلاحيات.' : 'تم حذف جميع الصلاحيات.', 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل تنفيذ العملية.', 'error');
    }
  };

  return (
      <div className="space-y-6 p-4">
        <h2 className="text-2xl font-extrabold">إدارة صلاحيات المستخدمين</h2>
        <div className="flex gap-6 flex-col lg:flex-row">
          <aside className="w-full lg:w-64 p-4 rounded-xl shadow-sm border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h4 className="font-bold mb-3">المستخدمون</h4>
            <div className="space-y-2">
              {users
                .filter((u: any) => (u?.role || '').toString().toLowerCase() !== 'representative')
                .map(u=> (
                <div key={u.id} className={`p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition ${selectedUser===u.id? 'bg-slate-100 ring-1 ring-blue-200':''}`} onClick={()=>loadUserPerms(u.id)}>
                  <div className="font-semibold">{u.name || u.username}</div>
                  <div className="text-xs text-slate-500">{u.role || ''}</div>
                </div>
              ))}
            </div>
          </aside>

          <main className="flex-1 p-6 rounded-xl shadow-sm border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            {!selectedUser ? (
              <div className="text-slate-500">اختر مستخدماً للبدء في تعديل الصلاحيات.</div>
            ) : (
              <div className="space-y-6">
                  <div className="flex items-center justify-between">
                  <div className="text-lg font-bold">تعديل صلاحيات: {users.find(u=>u.id===selectedUser)?.name || users.find(u=>u.id===selectedUser)?.username}</div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => applyAllPermissions(true)} className="px-3 py-1 bg-emerald-600 text-white rounded">منح الكل</button>
                    <button onClick={() => applyAllPermissions(false)} className="px-3 py-1 bg-rose-600 text-white rounded">حذف الكل</button>
                    <button onClick={() => setShowManagement(s => !s)} className="px-3 py-1 bg-slate-200 rounded">{showManagement ? 'إخفاء إدارة الأقسام' : 'إظهار إدارة الأقسام'}</button>
                    <button onClick={savePermissions} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow">حفظ التعديلات</button>
                  </div>
                </div>

                <section>
                  <h5 className="font-semibold mb-2">الصلاحيات حسب القسم</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sidebarSections.map((s: any) => {
                      const pageSlug = (s.slug || '').toString().toLowerCase();
                      const pageAllowed = isPageAllowed(pageSlug);
                      const isPageExpanded = expandedPages.includes(pageSlug);
                      const togglePageExpand = (slug: string) => {
                        setExpandedPages(prev => prev.includes(slug) ? prev.filter(x => x !== slug) : [...prev, slug]);
                      };

                      // Group modules under this sidebar section using moduleToPageSlug()
                      const sectionModules = modules.filter((m: any) => {
                        const ms = (moduleToPageSlug(m) || '').toString().toLowerCase();
                        return ms === pageSlug;
                      });

                      return (
                        <div key={pageSlug} className={`rounded-lg shadow-sm border ${pageAllowed ? 'ring-1 ring-green-300' : 'ring-1 ring-red-300'}`}>
                          <div
                            onClick={() => togglePageExpand(pageSlug)}
                            className={`cursor-pointer p-3 flex items-center justify-between ${pageAllowed ? 'bg-green-50' : 'bg-red-50'} rounded-t-lg`}
                          >
                            <div>
                              <div className="font-medium">{s.label}</div>
                              <div className="text-xs text-slate-500">{pageSlug}</div>
                            </div>
                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                              <div className={`px-2 py-1 rounded-full text-xs font-semibold ${pageAllowed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                {pageAllowed ? 'مفعل' : 'مغلق'}
                              </div>
                              <input type="checkbox" checked={pageAllowed} onChange={e => togglePageAccess(pageSlug, e.target.checked)} />
                            </div>
                          </div>

                          {/* When section is enabled and expanded, show action permissions inside */}
                          {pageAllowed && isPageExpanded && (
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-b-lg space-y-3">
                              {sectionModules.map((mod: any) => (
                                <div key={mod.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                  <div className="p-3 bg-slate-50 dark:bg-slate-800">
                                    <div className="font-medium">{translateModule(mod)}</div>
                                    <div className="text-xs text-slate-500">{mod.slug || mod.name}</div>
                                  </div>
                                  <div className="p-3">
                                    <div className="flex flex-wrap gap-2">
                                      {actions.map(act => {
                                        const allowed = permAllowed(mod.id, act.id);
                                        return (
                                          <button
                                            key={act.id}
                                            onClick={() => togglePerm(mod.id, act.id)}
                                            className={`px-3 py-1 rounded-full text-sm font-medium transition ${allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                          >
                                            {translateAction(act)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <TreasuryAccess selectedUser={selectedUser} />
                  </div>
                  <div>
                    <WarehouseAccess selectedUser={selectedUser} />
                  </div>
                  <div>
                    <SalesOfficeAccess selectedUser={selectedUser} />
                  </div>
                </div>

                {showManagement && (
                  <div className="mt-6 p-4 rounded-lg border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <h5 className="font-semibold mb-3">إدارة الأقسام والإجراءات</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <ModuleForm modules={modules} onCreate={createModule} />
                      </div>
                      <div>
                        <ActionForm onCreate={createAction} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <h6 className="font-semibold mb-2">شجرة الأقسام</h6>
                      <ModuleTree modules={modules} />
                    </div>
                  </div>
                )}

              </div>
            )}
          </main>
        </div>
      </div>
  );
};
         /*  </div>
        </div>
        <div className="mt-4">
          <h5 className="font-semibold mb-2">شجرة الأقسام</h5>
          <ModuleTree modules={modules} />
        </div>
      </div>
    </div>
  ); */


// Helper subcomponents
const ModuleForm: React.FC<{ modules:any[], onCreate: (name:string,parent_id:number|null)=>void }> = ({ modules, onCreate }) => {
  const [name, setName] = useState('');
  const [parent, setParent] = useState<string>('');
  return (
    <div>
      <input className="w-full p-2 border rounded mb-2" placeholder="اسم القسم" value={name} onChange={e=>setName(e.target.value)} />
      <CustomSelect
        value={parent}
        onChange={v=>setParent(v)}
        options={[{ value: '', label: 'بدون والد' }, ...modules.filter(m=>!m.parent_id).map(m=>({ value: String(m.id), label: m.name }))]}
      />
      <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={()=>{ if(name.trim()) { onCreate(name.trim(), parent?Number(parent):null); setName(''); setParent(''); } }}>إنشاء</button>
    </div>
  );
};

const ActionForm: React.FC<{ onCreate: (name:string,code:string)=>void }> = ({ onCreate }) => {
  const [name,setName] = useState('');
  const [code,setCode] = useState('');
  return (
    <div>
      <input className="w-full p-2 border rounded mb-2" placeholder="اسم الإجراء" value={name} onChange={e=>setName(e.target.value)} />
      <input className="w-full p-2 border rounded mb-2" placeholder="كود (مثال: view)" value={code} onChange={e=>setCode(e.target.value)} />
      <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={()=>{ if(name.trim()&&code.trim()){ onCreate(name.trim(), code.trim()); setName(''); setCode(''); } }}>إنشاء</button>
    </div>
  );
};

const ModuleTree: React.FC<{ modules:any[] }> = ({ modules }) => {
  const parents = modules.filter(m=>!m.parent_id);
  const childrenMap: Record<string, any[]> = {};
  modules.forEach(m => { if (m.parent_id) { childrenMap[m.parent_id] = childrenMap[m.parent_id] || []; childrenMap[m.parent_id].push(m); } });
  return (
    <div className="space-y-2">
      {parents.map(p => (
        <div key={p.id} className="border p-2 rounded">
          <div className="font-bold">{p.name}</div>
          <div className="mt-2 pl-4 space-y-1">
            {(childrenMap[p.id]||[]).map(ch => (
              <div key={ch.id} className="text-sm">- {ch.name}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Treasury access component: allow assigning scope of treasuries to a user
const TreasuryAccess: React.FC<{ selectedUser: number }> = ({ selectedUser }) => {
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [scope, setScope] = useState<'all'|'specific'|'none'>('all');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<number|null>(null);

  useEffect(() => {
    const fetchT = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`);
        const j = await res.json(); if (j.success) setTreasuries(j.data || []);
      } catch (e) { console.error('Failed to fetch treasuries', e); }
    };
    fetchT();
  }, []);

  useEffect(() => {
    // Load user's default scope if exists
    const loadDefaults = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${selectedUser}`);
        const jr = await r.json();
        if (jr.success && jr.data) {
          const d = jr.data;
          const tid = (d.default_treasury_id === null || typeof d.default_treasury_id === 'undefined') ? null : Number(d.default_treasury_id);
          if (tid === -1) { setScope('none'); setSelectedTreasuryId(null); }
          else if (tid && tid > 0) { setScope('specific'); setSelectedTreasuryId(tid); }
          else setScope('all');
        }
      } catch (e) { console.error('Failed to load defaults', e); }
    };
    loadDefaults();
  }, [selectedUser]);

  const saveScope = async () => {
    try {
      // fetch current defaults to avoid overwriting other fields
      let current: any = {};
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${selectedUser}`);
        const jr = await r.json();
        if (jr.success && jr.data) current = jr.data;
      } catch (err) { console.error('Failed to fetch current defaults', err); }

      const body = {
        user_id: selectedUser,
        default_treasury_id: scope==='specific' ? selectedTreasuryId : (scope==='none' ? -1 : null),
        can_change_treasury: scope==='all' ? 1 : 0,
        // preserve warehouse-related defaults when saving treasury
        default_warehouse_id: current.default_warehouse_id ?? null,
        can_change_warehouse: typeof current.can_change_warehouse !== 'undefined' ? current.can_change_warehouse : 1,
        default_sales_office_id: current.default_sales_office_id ?? null,
        can_change_sales_office: typeof current.can_change_sales_office !== 'undefined' ? current.can_change_sales_office : 1
      };

      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=setUserDefaults`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) Swal.fire('تم', 'تم حفظ نطاق الخزائن للمستخدم', 'success'); else Swal.fire('فشل', j.message||'خطأ', 'error');
    } catch (e) { console.error(e); Swal.fire('خطأ', 'فشل الحفظ', 'error'); }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
      <h6 className="font-semibold mb-2">نطاق الخزائن</h6>
      <div className="flex items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2"><input type="radio" name={`tre_scope_${selectedUser}`} checked={scope==='all'} onChange={() => setScope('all')} /> كل الخزائن</label>
        <label className="inline-flex items-center gap-2"><input type="radio" name={`tre_scope_${selectedUser}`} checked={scope==='specific'} onChange={() => setScope('specific')} /> خزينة محددة</label>
        <label className="inline-flex items-center gap-2"><input type="radio" name={`tre_scope_${selectedUser}`} checked={scope==='none'} onChange={() => setScope('none')} /> لا خزائن</label>
      </div>
      {scope === 'specific' && (
        <div className="mb-3">
          <CustomSelect
            value={selectedTreasuryId || ''}
            onChange={v => setSelectedTreasuryId(v?Number(v):null)}
            options={[{ value: '', label: '-- اختر خزينة --' }, ...treasuries.map(t=>({ value: String(t.id), label: t.name }))]}
          />
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={saveScope} className="px-3 py-1 bg-green-600 text-white rounded">حفظ نطاق الخزن</button>
      </div>
    </div>
  );
};

// Warehouse access component: allow assigning scope of warehouses to a user
const WarehouseAccess: React.FC<{ selectedUser: number }> = ({ selectedUser }) => {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [scope, setScope] = useState<'all'|'specific'|'none'>('all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number|null>(null);

  useEffect(() => {
    const fetchW = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const j = await res.json(); if (j.success) setWarehouses(j.data || []);
      } catch (e) { console.error('Failed to fetch warehouses', e); }
    };
    fetchW();
  }, []);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${selectedUser}`);
        const jr = await r.json();
        if (jr.success && jr.data) {
          const d = jr.data;
          const wid = (d.default_warehouse_id === null || typeof d.default_warehouse_id === 'undefined') ? null : Number(d.default_warehouse_id);
          if (wid === -1) { setScope('none'); setSelectedWarehouseId(null); }
          else if (wid && wid > 0) { setScope('specific'); setSelectedWarehouseId(wid); }
          else setScope('all');
        }
      } catch (e) { console.error('Failed to load defaults', e); }
    };
    loadDefaults();
  }, [selectedUser]);

  const saveScope = async () => {
    try {
      // fetch current defaults to avoid overwriting other fields
      let current: any = {};
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${selectedUser}`);
        const jr = await r.json();
        if (jr.success && jr.data) current = jr.data;
      } catch (err) { console.error('Failed to fetch current defaults', err); }

      const body = {
        user_id: selectedUser,
        default_warehouse_id: scope==='specific' ? selectedWarehouseId : (scope==='none' ? -1 : null),
        can_change_warehouse: scope==='all' ? 1 : 0,
        // preserve treasury-related defaults when saving warehouse
        default_treasury_id: current.default_treasury_id ?? null,
        can_change_treasury: typeof current.can_change_treasury !== 'undefined' ? current.can_change_treasury : 1,
        default_sales_office_id: current.default_sales_office_id ?? null,
        can_change_sales_office: typeof current.can_change_sales_office !== 'undefined' ? current.can_change_sales_office : 1
      };

      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=setUserDefaults`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) Swal.fire('تم', 'تم حفظ نطاق المستودعات للمستخدم', 'success'); else Swal.fire('فشل', j.message||'خطأ', 'error');
    } catch (e) { console.error(e); Swal.fire('خطأ', 'فشل الحفظ', 'error'); }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
      <h6 className="font-semibold mb-2">نطاق المخازن</h6>
      <div className="flex items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2"><input type="radio" name={`wh_scope_${selectedUser}`} checked={scope==='all'} onChange={() => setScope('all')} /> كل المخازن</label>
        <label className="inline-flex items-center gap-2"><input type="radio" name={`wh_scope_${selectedUser}`} checked={scope==='specific'} onChange={() => setScope('specific')} /> مستودع محدد</label>
        <label className="inline-flex items-center gap-2"><input type="radio" name={`wh_scope_${selectedUser}`} checked={scope==='none'} onChange={() => setScope('none')} /> لا مخازن</label>
      </div>
      {scope === 'specific' && (
        <div className="mb-3">
          <CustomSelect
            value={selectedWarehouseId || ''}
            onChange={v => setSelectedWarehouseId(v?Number(v):null)}
            options={[{ value: '', label: '-- اختر مستودع --' }, ...warehouses.map(w=>({ value: String(w.id), label: w.name }))]}
          />
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={saveScope} className="px-3 py-1 bg-green-600 text-white rounded">حفظ نطاق المستودع</button>
      </div>
    </div>
  );
};

// Sales offices access component: allow assigning scope of sales offices to a user
const SalesOfficeAccess: React.FC<{ selectedUser: number }> = ({ selectedUser }) => {
  const [offices, setOffices] = useState<any[]>([]);
  const [scope, setScope] = useState<'all'|'specific'|'none'>('all');
  const [selectedOfficeId, setSelectedOfficeId] = useState<number|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=sales_offices&action=getAll`);
        const j = await res.json();
        if (j.success) setOffices(j.data || []);
      } catch (e) {
        console.error('Failed to fetch sales offices', e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${selectedUser}`);
        const jr = await r.json();
        if (jr.success && jr.data) {
          const d = jr.data;
          const oid = (d.default_sales_office_id === null || typeof d.default_sales_office_id === 'undefined') ? null : Number(d.default_sales_office_id);
          if (oid === -1) { setScope('none'); setSelectedOfficeId(null); }
          else if (oid && oid > 0) { setScope('specific'); setSelectedOfficeId(oid); }
          else setScope('all');
        }
      } catch (e) {
        console.error('Failed to load sales office defaults', e);
      }
    })();
  }, [selectedUser]);

  const saveScope = async () => {
    try {
      let current: any = {};
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${selectedUser}`);
        const jr = await r.json();
        if (jr.success && jr.data) current = jr.data;
      } catch (err) { console.error('Failed to fetch current defaults', err); }

      const body = {
        user_id: selectedUser,
        default_sales_office_id: scope==='specific' ? selectedOfficeId : (scope==='none' ? -1 : null),
        can_change_sales_office: scope==='all' ? 1 : 0,
        // preserve other defaults
        default_warehouse_id: current.default_warehouse_id ?? null,
        can_change_warehouse: typeof current.can_change_warehouse !== 'undefined' ? current.can_change_warehouse : 1,
        default_treasury_id: current.default_treasury_id ?? null,
        can_change_treasury: typeof current.can_change_treasury !== 'undefined' ? current.can_change_treasury : 1
      };

      const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=setUserDefaults`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) Swal.fire('تم', 'تم حفظ نطاق مكاتب المبيعات للمستخدم', 'success');
      else Swal.fire('فشل', j.message||'خطأ', 'error');
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل الحفظ', 'error');
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
      <h6 className="font-semibold mb-2">نطاق مكاتب المبيعات</h6>
      <div className="flex items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2"><input type="radio" name={`so_scope_${selectedUser}`} checked={scope==='all'} onChange={() => setScope('all')} /> كل المكاتب</label>
        <label className="inline-flex items-center gap-2"><input type="radio" name={`so_scope_${selectedUser}`} checked={scope==='specific'} onChange={() => setScope('specific')} /> مكتب محدد</label>
        <label className="inline-flex items-center gap-2"><input type="radio" name={`so_scope_${selectedUser}`} checked={scope==='none'} onChange={() => setScope('none')} /> لا مكاتب</label>
      </div>
      {scope === 'specific' && (
        <div className="mb-3">
          <CustomSelect
            value={selectedOfficeId || ''}
            onChange={v => setSelectedOfficeId(v?Number(v):null)}
            options={[{ value: '', label: '-- اختر مكتب --' }, ...offices.map(o=>({ value: String(o.id), label: o.name }))]}
          />
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={saveScope} className="px-3 py-1 bg-green-600 text-white rounded">حفظ نطاق المكاتب</button>
      </div>
    </div>
  );
};

export default PermissionsAdmin;