import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';
import CustomSelect from './CustomSelect';

const DeliveryConfirmation: React.FC = () => {
  const [noteId, setNoteId] = useState('');
  const [note, setNote] = useState<any | null>(null);
  const [scanValue, setScanValue] = useState('');

  const [reps, setReps] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedWarehouseName, setSelectedWarehouseName] = useState<string>('');
  const [notesList, setNotesList] = useState<any[]>([]);

  const loadNote = async () => {
    if (!noteId) return Swal.fire('تنبيه', 'ادخل رقم إذن التسليم أو اختاره.', 'info');
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=getDeliveryNote&id=${encodeURIComponent(noteId)}`, { credentials: 'include' });
      const data = await res.json();
      if (!data || !data.success) {
        setNote(null);
        return Swal.fire('خطأ', data?.message || 'تعذر تحميل إذن التسليم', 'error');
      }
      // Normalize shapes: backend may return { order, items } (getOrderV2) or direct payload.
      let payload: any = data.data || {};
      if (payload.order) {
        const order = payload.order || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        payload = {
          id: order.id,
          rep_name: order.to_user_name || order.rep_name || order.to_user || null,
          from_warehouse_id: order.from_warehouse_id,
          to_warehouse_id: order.to_warehouse_id,
          items: items.map((it: any) => ({
            id: it.id,
            factory_product_id: it.factory_product_id,
            product_name: it.product_name || it.name || '',
            product_code: it.product_code || it.code || '',
            barcode: it.product_code || it.code || '',
            size: it.size_name || it.size || it.size_code || '',
            color: it.color || it.color_name || '',
            qty: Number(it.qty_sent ?? it.qty ?? 0),
            scanned_qty: Number(it.qty_received ?? it.scanned_qty ?? 0)
          }))
        };
      } else {
        payload.items = (payload.items || []).map((it: any) => ({ ...it, scanned_qty: Number(it.scanned_qty || it.qty_received || 0) }));
      }
      setNote(payload);
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  const fetchRepsAndWarehouses = async () => {
    try {
      const [rRes, wRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`, { credentials: 'include' }).then(r=>r.json()).catch(()=>({success:false,data:[]})),
        fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`, { credentials: 'include' }).then(r=>r.json()).catch(()=>({success:false,data:[]}))
      ]);
      setReps((rRes && rRes.success) ? (rRes.data||[]) : []);
      setWarehouses((wRes && wRes.success) ? (wRes.data||[]) : []);
    } catch (e) {
      console.error('Failed to load reps/warehouses', e);
      setReps([]); setWarehouses([]);
    }
  };

  const fetchNotesList = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=listOrdersV2`, { credentials: 'include' });
      const js = await res.json();
      setNotesList(js?.data || []);
    } catch (e) {
      console.error('Failed to fetch notes list', e);
      setNotesList([]);
    }
  };

  useEffect(() => {
    fetchRepsAndWarehouses().catch(()=>{});
    fetchNotesList().catch(()=>{});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = (val: string) => {
    if (!note) return Swal.fire('تنبيه', 'حمّل إذن التسليم أولاً.', 'info');
    const v = (val || '').trim();
    if (!v) return;
    // find matching item by barcode or product code
    const item = note.items.find((it: any) => String((it.barcode || it.product_code || '').toString()).trim() === v || String((it.product_code || it.barcode || '').toString()).trim() === v);
    if (!item) {
      Swal.fire('غير موجود', 'الباركود الممسوح غير موجود في إذن التسليم.', 'error');
      setScanValue('');
      return;
    }
    if (Number(item.scanned_qty || 0) >= Number(item.qty || 0)) {
      Swal.fire('مكتمل', 'تم بالفعل مسح الكمية المطلوبة من هذا المنتج.', 'warning');
      setScanValue('');
      return;
    }
    item.scanned_qty = Number(item.scanned_qty || 0) + 1;
    setNote({ ...note, items: [...note.items] });
    setScanValue('');
  };

  const saveScans = async () => {
    if (!note) return;
    try {
      // Use server's confirm receipt endpoint (confirmReceiptV2) expecting order_id + items with item_id/qty_received
      const payload = { order_id: Number(note.id), items: note.items.map((it: any) => ({ item_id: Number(it.id), qty_received: Number(it.scanned_qty || 0) })) };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=confirmReceiptV2`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.success) {
        Swal.fire('تم', 'تم حفظ حالة التسليم بنجاح.', 'success');
        setNote(null);
        setNoteId('');
      } else {
        Swal.fire('خطأ', data?.message || 'فشل حفظ حالة التسليم.', 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white p-4 rounded-lg border">
            <div className="mb-2">
              <label className="text-xs text-slate-500">المندوب</label>
              <CustomSelect
                value={String(selectedRepId)}
                onChange={(v:any) => setSelectedRepId(v)}
                options={reps.map(r=>({ value: String(r.id), label: r.name }))}
                placeholder="— اختر مندوب —"
              />
            </div>
            <div className="mb-2">
              <label className="text-xs text-slate-500">المخزن (بدء اليومية)</label>
              <CustomSelect
                value={String(selectedWarehouseId)}
                onChange={(v:any) => setSelectedWarehouseId(v)}
                options={warehouses.map(w=>({ value: String(w.id), label: w.name }))}
                placeholder="— اختر مخزن —"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">اختر إذن التسليم</label>
              <select value={noteId} onChange={e=>{
                  const val = e.target.value;
                  setNoteId(val);
                  // auto-fill warehouse from selected note (if available)
                  try {
                    const nid = Number(val || 0);
                    const found = notesList.find(n => Number(n.id) === nid || String(n.id) === String(val));
                    const wid = found ? (found.from_warehouse_id ?? found.from_warehouse ?? found.warehouse_id ?? '') : '';
                    if (wid !== '' && typeof wid !== 'undefined' && wid !== null) setSelectedWarehouseId(String(wid));
                  } catch (err) { /* ignore */ }
                }} className="w-full px-3 py-2 border rounded-lg" disabled={!selectedRepId}>
                <option value="">— اختر —</option>
                {notesList
                  .filter(n=> {
                    if (selectedRepId && String(n.to_user_id) !== String(selectedRepId) && String(n.to_user_id) !== String(n.rep_id)) return false;
                    if (selectedWarehouseId && String(n.from_warehouse_id) !== String(selectedWarehouseId)) return false;
                    return true;
                  })
                  .map(n => (<option key={n.id} value={String(n.id)}>{n.code ? `${n.code} — ${n.to_user_name||n.rep_name||''}` : `#${n.id}`}</option>))}
              </select>
            </div>

            <div className="mt-3">
              <button onClick={loadNote} className="px-4 py-2 bg-blue-600 text-white rounded-lg">تحميل الإذن</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <div className="mb-2">
              <label className="text-xs text-slate-500">امسح باركود المنتج</label>
              <input
                autoFocus
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(scanValue); }}
                placeholder="امسح باركود المنتج هنا ثم اضغط Enter"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="text-xs text-slate-500">يظهر المنتج أخضر عند التطابق الكامل، أحمر عند عدم التطابق.</div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {note ? (
            <>
              <div className="bg-white p-4 rounded-lg border mb-3">
                <h3 className="font-bold">إذن التسليم: {note.id} — المندوب: {note.rep_name || 'غير محدد'}</h3>
              </div>

              <div className="overflow-x-auto rounded-lg border bg-white p-2">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2">المنتج</th>
                      <th className="px-4 py-2">اللون</th>
                      <th className="px-4 py-2">المقاس</th>
                      <th className="px-4 py-2">الباركود</th>
                      <th className="px-4 py-2">المطلوب</th>
                      <th className="px-4 py-2">تم مسحه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {note.items.map((it: any) => {
                      const matched = Number(it.scanned_qty || 0) === Number(it.qty || 0);
                      return (
                        <tr key={it.id} className={`border-t ${matched ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          <td className="px-4 py-2 font-bold">{it.product_name}</td>
                          <td className="px-4 py-2">{it.color || it.color_name || '—'}</td>
                          <td className="px-4 py-2">{it.size || it.size_name || '—'}</td>
                          <td className="px-4 py-2 font-mono text-xs">{it.barcode}</td>
                          <td className="px-4 py-2">{it.qty}</td>
                          <td className={`px-4 py-2 ${matched ? 'text-emerald-600 font-black' : 'text-rose-600'}`}>{it.scanned_qty || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={saveScans} disabled={!note.items.every((it:any) => Number(it.scanned_qty||0) === Number(it.qty||0))} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">حفظ وتسليم</button>
                <button onClick={() => { setNote(null); setNoteId(''); }} className="px-4 py-2 bg-slate-100 rounded-lg">إلغاء</button>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">قم بتحميل إذن التسليم لمشاهدة المحتويات.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryConfirmation;
