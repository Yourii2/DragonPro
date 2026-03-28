import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../../services/apiConfig';
import CustomSelect from '../CustomSelect';

type FactoryProductRow = { id: number; name: string; type: string };
type Warehouse = { id: number; name: string };

type AssemblyComponentInfo = {
  product_id: number;
  name?: string | null;
  code?: string | null;
  per_unit: number;
  available_quantity: number;
  unit_cost?: number;
};

const AssemblyPage: React.FC = () => {
  const [products, setProducts] = useState<FactoryProductRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedComposite, setSelectedComposite] = useState<number>(0);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [info, setInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMeta = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getMeta`);
      const js = await res.json();
      setWarehouses(js?.data?.warehouses || []);
    } catch {
      setWarehouses([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getAll`);
      const js = await res.json();
      const rows = Array.isArray(js?.data) ? js.data.filter((r:any)=>r.type==='composite') : [];
      setProducts(rows.map((r:any)=>({ id: Number(r.id), name: r.name, type: r.type })));
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    fetchMeta();
    fetchProducts();
  }, []);

  const fetchAssemblyInfo = async () => {
    if (!selectedComposite || !selectedWarehouse) {
      setInfo(null); return;
    }
    setLoading(true);
    try {
      const qsSize = selectedSize ? `&size_id=${encodeURIComponent(String(selectedSize))}` : '';
      const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getAssemblyInfo&composite_id=${encodeURIComponent(String(selectedComposite))}&warehouse_id=${encodeURIComponent(String(selectedWarehouse))}${qsSize}`);
      const js = await res.json();
      if (!js?.success) throw new Error(js?.message || 'Failed to load');
      setInfo(js.data);
      // adjust qty to allowed max
      const maxQ = Number(js.data?.max_quantity || 0);
      if (maxQ > 0 && qty > maxQ) setQty(maxQ);
    } catch (e:any) {
      Swal.fire('خطأ', e?.message || 'فشل تحميل بيانات التجميع', 'error');
      setInfo(null);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchAssemblyInfo(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedComposite, selectedWarehouse, selectedSize]);

  const handleAssemble = async () => {
    const desired = Math.max(0, Math.floor(Number(qty || 0)));
    const maxQ = Number(info?.max_quantity || 0);
    if (!selectedComposite || !selectedWarehouse) { Swal.fire('تنبيه','اختر المخزن والمنتج المجمع','warning'); return; }
    if (desired <= 0) { Swal.fire('تنبيه','أدخل كمية صحيحة','warning'); return; }
    if (maxQ > 0 && desired > maxQ) { Swal.fire('تنبيه',`أقصى كمية: ${maxQ}`,'warning'); return; }

    const compName = (products.find(p=>p.id===selectedComposite)?.name) || info?.composite?.name || '';
    const whName = (warehouses.find(w=>w.id===selectedWarehouse)?.name) || '';

    const ok = await Swal.fire({ icon:'question', title:'تأكيد التجميع', html:`<div style="text-align:right;direction:rtl"><div><b>المنتج:</b> ${compName}</div><div><b>المخزن:</b> ${whName}</div><div><b>المقاس:</b> ${selectedSize||'-'}</div><div><b>الكمية:</b> ${desired}</div></div>`, showCancelButton:true, confirmButtonText:'تنفيذ', cancelButtonText:'إلغاء' });
    if (!ok.isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=assembleComposite`, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ composite_id: selectedComposite, warehouse_id: selectedWarehouse, size_id: selectedSize, quantity: desired })
      });
      const js = await res.json();
      if (!js?.success) throw new Error(js?.message || 'Assembly failed');
      Swal.fire('تم', 'تم التجميع بنجاح', 'success');
      // refresh info
      await fetchAssemblyInfo();
    } catch (e:any) {
      Swal.fire('خطأ', e?.message || 'فشل تنفيذ التجميع', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">تجميع المنتجات (Assembly)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm">المخزن</label>
          <CustomSelect
            value={String(selectedWarehouse||'')}
            onChange={v=>setSelectedWarehouse(Number(v)||0)}
            options={[{ value: '', label: 'اختر المخزن' }, ...warehouses.map(w=>({ value: String(w.id), label: w.name }))]}
          />
        </div>
        <div>
          <label className="block text-sm">المنتج المجمع</label>
          <CustomSelect
            value={String(selectedComposite||'')}
            onChange={v=>setSelectedComposite(Number(v)||0)}
            options={[{ value: '', label: 'اختر المنتج المجمع' }, ...products.map(p=>({ value: String(p.id), label: p.name }))]}
          />
        </div>
        <div>
          <label className="block text-sm">المقاس (إن وجد)</label>
          <input className="input mt-1 w-full" value={selectedSize||''} onChange={e=>setSelectedSize(Number(e.target.value)||0)} placeholder="size id (optional)" />
        </div>
      </div>

      <div className="mb-4">
        <button className="btn btn-primary" onClick={fetchAssemblyInfo} disabled={loading}>تحميل بيانات التجميع</button>
      </div>

      {info && (
        <div>
          <div className="mb-2">الكمية الحالية: <b>{info.current_quantity}</b> — أقصى إمكانية للتجميع الآن: <b>{info.max_quantity}</b></div>
          <div className="mb-3">
            <label className="block text-sm">الكمية التي تريد تجميعها</label>
            <input type="number" className="input mt-1 w-40" min={1} value={qty} onChange={e=>setQty(Math.max(0, Number(e.target.value||0)))} />
          </div>

          <h3 className="font-semibold">المكونات</h3>
          <table className="w-full mt-2 table-auto text-sm">
            <thead>
              <tr className="text-left"><th>المنتج</th><th>مطلوب لكل وحدة</th><th>المتوفر</th></tr>
            </thead>
            <tbody>
              {(info.components || []).map((c:AssemblyComponentInfo)=> (
                <tr key={c.product_id}>
                  <td>{c.name || c.code || c.product_id}</td>
                  <td>{c.per_unit}</td>
                  <td>{c.available_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4">
            <button className="btn btn-success" onClick={handleAssemble} disabled={loading}>تنفيذ التجميع</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssemblyPage;
