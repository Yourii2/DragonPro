import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';

interface ProductRow {
  product_id:       number;
  product_name:     string;
  total_qty:        number;
  delivered_qty:    number;
  delivered_amount: number;
  returned_qty:     number;
  returned_amount:  number;
}

const ProductDeliveryTable: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const [rows, setRows]       = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const currency = localStorage.getItem('Dragon_currency') || 'ج.م';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${API_BASE_PATH}/api.php?module=reports&action=product_delivery&start_date=${startDate}&end_date=${endDate}`;
        const res  = await fetch(url, { credentials: 'include' });
        const text = await res.text();

        if (!text || !text.trim()) {
          setRows([]);
          return;
        }

        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          setError('استجابة الخادم غير صالحة. تأكد من إعداد الخادم.');
          setRows([]);
          return;
        }

        if (data && data.success && Array.isArray(data.data)) {
          setRows(data.data as ProductRow[]);
        } else {
          setRows([]);
          if (data && data.message) setError(data.message);
        }
      } catch (e) {
        setError('فشل الاتصال بالخادم. تأكد من تشغيل الخادم.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startDate, endDate]);

  // Totals
  const totals = rows.reduce(
    (acc, r) => ({
      total_qty:        acc.total_qty        + r.total_qty,
      delivered_qty:    acc.delivered_qty    + r.delivered_qty,
      delivered_amount: acc.delivered_amount + r.delivered_amount,
      returned_qty:     acc.returned_qty     + r.returned_qty,
      returned_amount:  acc.returned_amount  + r.returned_amount,
    }),
    { total_qty: 0, delivered_qty: 0, delivered_amount: 0, returned_qty: 0, returned_amount: 0 }
  );

  const pct = (num: number, den: number) =>
    den === 0 ? '—' : `${Math.round((num / den) * 10000) / 100}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 gap-3">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        جارٍ تحميل تقرير المنتجات...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-sm text-right">
        <strong>خطأ:</strong> {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        لا توجد منتجات مُسلَّمة أو مرتجعة في الفترة من <strong>{startDate}</strong> إلى <strong>{endDate}</strong>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm text-right">
        <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3 font-semibold">#</th>
            <th className="px-4 py-3 font-semibold">المنتج</th>
            <th className="px-4 py-3 font-semibold text-center">قطع كلية</th>
            <th className="px-4 py-3 font-semibold text-center text-emerald-700 dark:text-emerald-400">مسلَّمة (قطعة)</th>
            <th className="px-4 py-3 font-semibold text-center text-emerald-700 dark:text-emerald-400">مبيعات ({currency})</th>
            <th className="px-4 py-3 font-semibold text-center">نسبة التسليم</th>
            <th className="px-4 py-3 font-semibold text-center text-rose-600 dark:text-rose-400">مرتجعة (قطعة)</th>
            <th className="px-4 py-3 font-semibold text-center text-rose-600 dark:text-rose-400">مرتجعات ({currency})</th>
            <th className="px-4 py-3 font-semibold text-center">نسبة الإرجاع</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.map((r, idx) => {
            const deliveryRate = pct(r.delivered_qty, r.total_qty);
            const returnRate   = pct(r.returned_qty,  r.total_qty);
            const deliveryNum  = r.total_qty > 0 ? Math.round((r.delivered_qty / r.total_qty) * 100) : 0;
            return (
              <tr key={r.product_id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{r.product_name}</td>
                <td className="px-4 py-3 text-center">{r.total_qty.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-bold">
                    {r.delivered_qty.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-black text-emerald-700 dark:text-emerald-400">
                  {r.delivered_amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${deliveryNum}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-12 flex-shrink-0 text-left">
                      {deliveryRate}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {r.returned_qty > 0 ? (
                    <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full text-xs font-bold">
                      {r.returned_qty.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center font-bold text-rose-600 dark:text-rose-400">
                  {r.returned_amount > 0 ? r.returned_amount.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                  {returnRate}
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* Totals row */}
        <tfoot>
          <tr className="bg-slate-100 dark:bg-slate-700/60 font-black text-slate-800 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-600">
            <td className="px-4 py-3" colSpan={2}>الإجمالي</td>
            <td className="px-4 py-3 text-center">{totals.total_qty.toLocaleString()}</td>
            <td className="px-4 py-3 text-center text-emerald-700 dark:text-emerald-400">{totals.delivered_qty.toLocaleString()}</td>
            <td className="px-4 py-3 text-center text-emerald-700 dark:text-emerald-400">{totals.delivered_amount.toLocaleString()}</td>
            <td className="px-4 py-3 text-center">{pct(totals.delivered_qty, totals.total_qty)}</td>
            <td className="px-4 py-3 text-center text-rose-600 dark:text-rose-400">{totals.returned_qty.toLocaleString()}</td>
            <td className="px-4 py-3 text-center text-rose-600 dark:text-rose-400">{totals.returned_amount.toLocaleString()}</td>
            <td className="px-4 py-3 text-center">{pct(totals.returned_qty, totals.total_qty)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ProductDeliveryTable;
