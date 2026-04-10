import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';

const ProductDeliveryTable: React.FC<{startDate: string, endDate: string}> = ({ startDate, endDate }) => {
  const [rows, setRows] = useState<any[]>([]);
  const currency = localStorage.getItem('Dragon_currency') || 'ج.م';

  useEffect(() => {
    const load = async () => {
      try {
        const url = `${API_BASE_PATH}/api.php?module=reports&action=product_delivery&start_date=${startDate}&end_date=${endDate}`;
        const res = await fetch(url, { credentials: 'include' });
        const text = await res.text();
        if (!text || !text.trim()) {
          // empty response -> treat as no data
          console.warn('reports.product_delivery returned empty response');
          setRows([]);
          return;
        }
        let data: any;
        try {
          data = JSON.parse(text);
        } catch (err) {
          console.error('Invalid JSON from product_delivery:', text);
          Swal.fire('خطأ', 'استجابة الخادم ليست JSON صالحاً: ' + (text.length > 200 ? text.slice(0,200) + '...' : text), 'error');
          setRows([]);
          return;
        }

        if (data && data.success && Array.isArray(data.data)) {
          setRows(data.data);
        } else {
          setRows([]);
          if (data && !data.success) Swal.fire('تنبيه', data.message || 'لا توجد بيانات للتقرير.', 'info');
        }
      } catch (e) {
        console.error(e);
        Swal.fire('خطأ', 'فشل جلب بيانات التقرير.', 'error');
      }
    };
    load();
  }, [startDate, endDate]);

  return (
    <div>
      {rows.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-100 rounded-md text-right">
          <div className="mb-2">لا توجد بيانات من الخادم للتواريخ المحددة.</div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => {
              const sample = [
                { product_name: 'قميص أبيض', total_orders: 120, delivered_qty: 110, delivered_amount: 27500, returned_qty: 5, returned_amount: 1250 },
                { product_name: 'بنطال جينز', total_orders: 80, delivered_qty: 72, delivered_amount: 36000, returned_qty: 2, returned_amount: 1000 }
              ];
              setRows(sample);
            }} className="px-3 py-2 bg-blue-600 text-white rounded-lg">عرض بيانات تجريبية</button>
          </div>
        </div>
      )}
      <table className="w-full text-right text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-2">المنتج</th>
            <th className="px-4 py-2">تم التسليم (كمية)</th>
            <th className="px-4 py-2">إجمالي التسليم ({currency})</th>
            <th className="px-4 py-2">نسبة التسليم</th>
            <th className="px-4 py-2">تم الارتجاع (كمية)</th>
            <th className="px-4 py-2">إجمالي مرتجع ({currency})</th>
            <th className="px-4 py-2">نسبة المرتجع</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, idx: number) => (
            <tr key={idx} className="border-t hover:bg-slate-50">
              <td className="px-4 py-2 font-bold">{r.product_name}</td>
              <td className="px-4 py-2">{Number(r.delivered_qty || 0).toLocaleString()}</td>
              <td className="px-4 py-2 font-black">{Number(r.delivered_amount || 0).toLocaleString()}</td>
              <td className="px-4 py-2">{Number(r.total_orders || 0) === 0 ? '0%' : `${Math.round((Number(r.delivered_qty || 0) / Number(r.total_orders || 1)) * 10000) / 100}%`}</td>
              <td className="px-4 py-2">{Number(r.returned_qty || 0).toLocaleString()}</td>
              <td className="px-4 py-2 font-black">{Number(r.returned_amount || 0).toLocaleString()}</td>
              <td className="px-4 py-2">{Number(r.total_orders || 0) === 0 ? '0%' : `${Math.round((Number(r.returned_qty || 0) / Number(r.total_orders || 1)) * 10000) / 100}%`}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500">لا توجد بيانات</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductDeliveryTable;
