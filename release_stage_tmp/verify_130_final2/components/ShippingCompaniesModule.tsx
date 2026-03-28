import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';
import { Eye, Edit, Trash2, Plus, Search, X } from 'lucide-react';

const ShippingCompaniesModule: React.FC = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [modalMode, setModalMode] = useState<'none' | 'add' | 'edit' | 'view'>('none');
  const [selected, setSelected] = useState<any>(null);
  const [name, setName] = useState('');
  const [phones, setPhones] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=getAll`);
      const j = await res.json();
      if (j.success) setCompanies((j.data || []).map((r: any) => ({ ...r })));
      else setCompanies([]);
    } catch (e) {
      console.error(e);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async () => {
    if (!name.trim()) {
      await Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'ادخل اسم شركة الشحن' });
      return;
    }
    try {
      setLoading(true);
      const payload = { name: name.trim(), phones: phones.trim() };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (j.success) {
        setName('');
        setPhones('');
        setModalMode('none');
        fetchCompanies();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم إضافة شركة الشحن', showConfirmButton: false, timer: 1800 });
      } else {
        await Swal.fire({ icon: 'error', title: 'فشل', text: j.message || 'فشل إنشاء شركة الشحن' });
      }
    } catch (e) {
      console.error(e);
      alert('فشل الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const updateCompany = async () => {
    if (!selected || !selected.id) {
      await Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اختار شركة للتعديل' });
      return;
    }
    if (!name.trim()) {
      await Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'ادخل اسم شركة الشحن' });
      return;
    }
    try {
      setLoading(true);
      const payload = { id: selected.id, name: name.trim(), phones: phones.trim() };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (j.success) {
        setSelected(null);
        setModalMode('none');
        fetchCompanies();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم التحديث', showConfirmButton: false, timer: 1500 });
      } else {
        await Swal.fire({ icon: 'error', title: 'فشل', text: j.message || 'فشل التحديث' });
      }
    } catch (e) {
      console.error(e);
      alert('فشل الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const deleteCompany = async (id: any) => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const j = await res.json();
      if (j.success) {
        if (selected && selected.id === id) setSelected(null);
        fetchCompanies();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم الحذف', showConfirmButton: false, timer: 1500 });
      } else {
        await Swal.fire({ icon: 'error', title: 'فشل', text: j.message || 'فشل الحذف' });
      }
    } catch (e) {
      console.error(e);
      alert('فشل الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const filtered = companies.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (o.name || '').toString().toLowerCase().includes(q) || (o.phones || '').toString().toLowerCase().includes(q);
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">شركات الشحن</h1>
          <p className="text-sm text-slate-500">قائمة شركات الشحن المستخدمة في تسليم الطلبات.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم الشركة أو رقم الهاتف"
              className="pl-10 pr-4 py-2 w-72 rounded-lg border focus:ring-2 focus:ring-blue-200"
            />
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
          </div>
          <button
            onClick={() => {
              setModalMode('add');
              setSelected(null);
              setName('');
              setPhones('');
            }}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
          >
            <Plus className="w-4 h-4" /> إضافة شركة جديدة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!loading && filtered.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-500 border rounded-lg">لم يتم العثور على شركات.</div>
        )}

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="p-4 border rounded-lg animate-pulse bg-white" />)
        ) : (
          filtered.map((o: any) => (
            <div key={o.id} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-lg font-semibold">{o.name}</div>
                <div className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{o.phones || '-'}</div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-slate-400">{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</div>
                <div className="flex items-center gap-2">
                  <button title="عرض" onClick={() => {
                    setSelected(o);
                    setModalMode('view');
                  }} className="p-2 rounded hover:bg-slate-100">
                    <Eye className="w-4 h-4 text-slate-600" />
                  </button>
                  <button title="تعديل" onClick={() => {
                    setSelected(o);
                    setName(o.name || '');
                    setPhones(o.phones || '');
                    setModalMode('edit');
                  }} className="p-2 rounded hover:bg-amber-100">
                    <Edit className="w-4 h-4 text-amber-600" />
                  </button>
                  <button
                    title="حذف"
                    onClick={async () => {
                      const res = await Swal.fire({
                        title: 'تأكيد الحذف',
                        text: 'هل أنت متأكد من حذف هذه الشركة؟',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'نعم',
                        cancelButtonText: 'إلغاء'
                      });
                      if (res.isConfirmed) deleteCompany(o.id);
                    }}
                    className="p-2 rounded hover:bg-rose-100"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modalMode !== 'none' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              {modalMode === 'add' && <h3 className="text-lg font-semibold">إضافة شركة شحن جديدة</h3>}
              {modalMode === 'edit' && <h3 className="text-lg font-semibold">تعديل شركة الشحن</h3>}
              {modalMode === 'view' && <h3 className="text-lg font-semibold">تفاصيل الشركة</h3>}
              <button onClick={() => {
                setModalMode('none');
                setSelected(null);
              }} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="mt-4">
              {modalMode === 'view' ? (
                <div className="space-y-3">
                  <div><strong>الاسم:</strong> {selected?.name || '-'}</div>
                  <div><strong>أرقام الهاتف:</strong> {selected?.phones || '-'}</div>
                  <div><strong>أنشئ في:</strong> {selected?.created_at ? new Date(selected.created_at).toLocaleString() : '-'}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الشركة" className="w-full p-2 border rounded" />
                  <input value={phones} onChange={(e) => setPhones(e.target.value)} placeholder="أرقام الهاتف مفصولة بفاصلة" className="w-full p-2 border rounded" />
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => {
                setModalMode('none');
                setSelected(null);
              }} className="px-3 py-1 bg-gray-200 rounded">
                إغلاق
              </button>
              {modalMode === 'add' && (
                <button onClick={createCompany} disabled={loading} className="px-4 py-1 bg-green-600 text-white rounded">
                  حفظ
                </button>
              )}
              {modalMode === 'edit' && (
                <button onClick={updateCompany} disabled={loading} className="px-4 py-1 bg-amber-600 text-white rounded">
                  تحديث
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingCompaniesModule;
