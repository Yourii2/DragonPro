import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import CustomSelect from './CustomSelect';
import { API_BASE_PATH } from '../services/apiConfig';
import { translateTxnLabel } from '../services/labelHelpers';

const formatDateInput = (d: Date) => d.toISOString().slice(0, 10);

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseDetails = (s: any) => {
  if (!s) return {};
  if (typeof s === 'object') return s;
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
};

const money = (n: number) => Math.abs(toNum(n)).toLocaleString();

const SalesReport: React.FC = () => {
  const currencySymbol = 'ج.م';

  const [dailyDate, setDailyDate] = useState<string>(formatDateInput(new Date()));
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [treasuryHistory, setTreasuryHistory] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  const loadTreasuries = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`);
      const j = await r.json();
      const list = j && j.success ? j.data || [] : [];
      setTreasuries(list);
      if (!selectedTreasuryId && list.length > 0) setSelectedTreasuryId(String(list[0].id));
    } catch (e) {
      console.error('Failed to load treasuries', e);
      setTreasuries([]);
    }
  };

  const loadReport = async () => {
    if (!selectedTreasuryId) {
      setStartingBalance(0);
      setTreasuryHistory([]);
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const date = dailyDate || formatDateInput(new Date());
      const url =
        `${API_BASE_PATH}/api.php?module=reports&action=finance` +
        `&treasury_id=${encodeURIComponent(selectedTreasuryId)}` +
        `&start_date=${encodeURIComponent(date)}` +
        `&end_date=${encodeURIComponent(date)}`;

      const r = await fetch(url);
      const j = await r.json();
      if (j && j.success) {
        const data = j.data || {};
        setStartingBalance(toNum(data.starting_balance ?? 0));
        setTreasuryHistory(Array.isArray(data.treasuryBalanceHistory) ? data.treasuryBalanceHistory : []);
        setRecords(Array.isArray(data.revenueAndExpenseRecords) ? data.revenueAndExpenseRecords : []);
      } else {
        setStartingBalance(0);
        setTreasuryHistory([]);
        setRecords([]);
        Swal.fire('تنبيه', j?.message || 'لا توجد بيانات للفترة المحددة.', 'info');
      }
    } catch (e) {
      console.error('Failed to load treasury report', e);
      setStartingBalance(0);
      setTreasuryHistory([]);
      setRecords([]);
      Swal.fire('خطأ', 'فشل تحميل تقرير الخزينة. راجع الكونسول.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTreasuries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTreasuryId, dailyDate]);

  const { cashIn, cashOut } = useMemo(() => {
    const ins: any[] = [];
    const outs: any[] = [];
    (records || []).forEach((rec: any) => {
      const amt = toNum(rec.amount);
      if (amt >= 0) ins.push(rec);
      else outs.push(rec);
    });
    return { cashIn: ins, cashOut: outs };
  }, [records]);

  const totals = useMemo(() => {
    const totalIn = (records || []).reduce((s: number, r: any) => (toNum(r.amount) > 0 ? s + toNum(r.amount) : s), 0);
    const totalOut = (records || []).reduce((s: number, r: any) => (toNum(r.amount) < 0 ? s + Math.abs(toNum(r.amount)) : s), 0);
    const net = (records || []).reduce((s: number, r: any) => s + toNum(r.amount), 0);

    const closingFromHistory =
      Array.isArray(treasuryHistory) && treasuryHistory.length > 0
        ? toNum(treasuryHistory[treasuryHistory.length - 1].balance)
        : null;

    const closing = closingFromHistory !== null ? closingFromHistory : toNum(startingBalance) + net;
    return { opening: toNum(startingBalance), totalIn, totalOut, closing };
  }, [records, startingBalance, treasuryHistory]);

  const getTypeLabel = (rec: any) => translateTxnLabel(rec.type, rec.desc, rec.txn_type);
  const getEntityNameForIn = (rec: any) => {
    const d = parseDetails(rec.raw_details || rec.details);
    return (
      d.related_to_name ||
      d.rep_name ||
      d.repName ||
      d.customer_name ||
      d.customerName ||
      d.supplier_name ||
      d.supplierName ||
      rec.related_name ||
      rec.entity ||
      '—'
    );
  };
  const getReasonForOut = (rec: any) => {
    const d = parseDetails(rec.raw_details || rec.details);
    return d.notes || d.note || d.reason || rec.desc || '—';
  };

  const selectedTreasuryName = useMemo(
    () => treasuries.find(t => String(t.id) === String(selectedTreasuryId))?.name || '',
    [treasuries, selectedTreasuryId]
  );

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">تقرير الخزينة (استلامات / مدفوعات)</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              تقرير خاص بالخزينة فقط — {selectedTreasuryName ? `(${selectedTreasuryName})` : ''}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div>
                <div className="text-xs text-slate-500 mb-1">الخزينة</div>
                <CustomSelect
                  value={selectedTreasuryId}
                  onChange={v => setSelectedTreasuryId(v)}
                  options={
                    treasuries.length === 0
                      ? [{ value: '', label: 'لا توجد خزائن' }]
                      : [{ value: '', label: 'اختر خزينة' }, ...treasuries.map(t => ({ value: String(t.id), label: t.name }))]
                  }
                  className="w-full sm:w-56 text-sm"
                />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">تاريخ اليومية</div>
              <input
                type="date"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-sm"
                value={dailyDate}
                onChange={e => setDailyDate(e.target.value)}
              />
            </div>
            <button
              onClick={loadReport}
              className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black"
              disabled={loading}
            >
              {loading ? 'جارٍ التحميل...' : 'تحديث'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">رصيد بداية اليوم</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {totals.opening.toLocaleString()} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">مبالغ تم استلامها</div>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            {totals.totalIn.toLocaleString()} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">مبالغ تم دفعها</div>
          <div className="mt-2 text-2xl font-black text-rose-600">
            {totals.totalOut.toLocaleString()} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">رصيد نهاية اليوم</div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {totals.closing.toLocaleString()} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {treasuryHistory.length > 0 ? 'حسب تاريخ رصيد الخزينة' : 'محسوب: بداية + صافي الحركات'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lg:order-1 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-white">مدفوعات / مصروفات</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">كل الحركات الخارجة</div>
              </div>
              <div className="text-xs font-black text-rose-600">
                {cashOut.length} حركة — الإجمالي: {totals.totalOut.toLocaleString()} {currencySymbol}
              </div>
            </div>
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-black">السبب / الملاحظات</th>
                  <th className="px-5 py-3 font-black">نوع الحركة</th>
                  <th className="px-5 py-3 font-black text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-slate-400">جارٍ التحميل...</td>
                  </tr>
                ) : cashOut.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-slate-400">لا توجد مدفوعات</td>
                  </tr>
                ) : (
                  cashOut.map((rec: any, idx: number) => {
                    const amt = toNum(rec.amount);
                    const typeLabel = getTypeLabel(rec);
                    const reason = getReasonForOut(rec);
                    return (
                      <tr key={`${rec.id || idx}`}>
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{reason || '—'}</div>
                          <div className="text-[11px] text-slate-400 mt-1">{String(rec.date || rec.transaction_date || '')}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                            {typeLabel || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-left font-black text-rose-600">
                          {money(amt)} {currencySymbol}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:order-2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-white">استلامات</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">كل الحركات الداخلة</div>
              </div>
              <div className="text-xs font-black text-emerald-600">
                {cashIn.length} حركة — الإجمالي: {totals.totalIn.toLocaleString()} {currencySymbol}
              </div>
            </div>
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-black">الجهة / الاسم</th>
                  <th className="px-5 py-3 font-black">نوع الحركة</th>
                  <th className="px-5 py-3 font-black text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-slate-400">جارٍ التحميل...</td>
                  </tr>
                ) : cashIn.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-slate-400">لا توجد استلامات</td>
                  </tr>
                ) : (
                  cashIn.map((rec: any, idx: number) => {
                    const amt = toNum(rec.amount);
                    const typeLabel = getTypeLabel(rec);
                    const entity = getEntityNameForIn(rec);
                    return (
                      <tr key={`${rec.id || idx}`}>
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{entity || '—'}</div>
                          <div className="text-[11px] text-slate-400 mt-1">{String(rec.date || rec.transaction_date || '')}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                            {typeLabel || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-left font-black text-emerald-600">
                          {money(amt)} {currencySymbol}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 dark:text-slate-400">
        ملاحظة: تم تقسيم الحركات بناءً على إشارة <span className="font-bold">amount</span> (موجب = استلام / سالب = دفع).
      </div>
    </div>
  )
};

export default SalesReport;