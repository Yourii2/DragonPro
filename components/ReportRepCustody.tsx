import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, Download, Users, Printer } from 'lucide-react';
import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';
import Swal from 'sweetalert2';
import { useTheme } from './ThemeContext';

interface OrderItem {
  name?: string;
  product_name?: string;
  quantity?: number | string;
  qty?: number | string;
  price?: number | string;
}

interface Order {
  id: number;
  status: string;
  rep_id: number | null;
  items_json: string;
  [key: string]: any;
}

const ReportRepCustody: React.FC = () => {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [ordersRes, repsRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`).then(r => r.json()).catch(() => null)
        ]);

        if (repsRes && repsRes.success) {
          const repsList = Array.isArray(repsRes.data) ? repsRes.data : [];
          setReps(repsList);
        } else if (repsRes && Array.isArray(repsRes)) {
          setReps(repsRes);
        }

        if (ordersRes && ordersRes.success) {
          const allOrders = ordersRes.data || [];
          const closedStatuses = ['delivered', 'completed', 'settled', 'closed', 'returned', 'full_return', 'cancelled'];
          
          const custodyOrders = allOrders.filter((o: any) => {
            const repId = o.rep_id ?? o.representative_id ?? o.repId ?? o.user_id;
            const hasRep = repId !== undefined && repId !== null && String(repId).trim() !== '' && String(repId) !== '0';
            const status = String(o.status || '').toLowerCase();
            const isClosed = closedStatuses.includes(status);
            return hasRep && !isClosed;
          });

          setOrders(custodyOrders);
        }
      } catch (error) {
        console.error("Failed to load rep custody data", error);
        Swal.fire('خطأ', 'فشل تحميل البيانات', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const parseProductDetails = (rawName: string, rawColor?: string, rawSize?: string, rawBarcode?: string) => {
    let name = (rawName || '').trim();
    let color = (rawColor && String(rawColor).trim() !== '' && String(rawColor).trim() !== '—') ? String(rawColor).trim() : '';
    let size = (rawSize && String(rawSize).trim() !== '' && String(rawSize).trim() !== '—') ? String(rawSize).trim() : '';
    let barcode = (rawBarcode && String(rawBarcode).trim() !== '' && String(rawBarcode).trim() !== '—') ? String(rawBarcode).trim() : '';

    // If color is missing, extract it from formatted string like "اسم المنتج - اللون: اسود"
    if (!color && name.includes('اللون:')) {
      const match = name.match(/اللون:\s*([^\-\–\—\n\r]+)/);
      if (match && match[1]) {
        color = match[1].trim();
      }
    }

    // If size is missing, extract it from formatted string like "اسم المنتج - المقاس: 8"
    if (!size && name.includes('المقاس:')) {
      const match = name.match(/المقاس:\s*([^\-\–\—\n\r]+)/);
      if (match && match[1]) {
        size = match[1].trim();
      }
    }

    // Clean product name by removing embedded "- اللون: ..." and "- المقاس: ..."
    if (name.includes('اللون:') || name.includes('المقاس:')) {
      name = name
        .replace(/\s*[\-\–\—]?\s*اللون:\s*([^\-\–\—\n\r]+)/gi, '')
        .replace(/\s*[\-\–\—]?\s*المقاس:\s*([^\-\–\—\n\r]+)/gi, '')
        .replace(/[\-\–\—\s]+$/, '')
        .trim();
    }

    return {
      productName: name || 'منتج غير معروف',
      color: color || '—',
      size: size || '—',
      barcode: barcode || '—'
    };
  };

  const custodyData = useMemo(() => {
    const dataMap: { [key: string]: { productName: string; color: string; size: string; barcode: string; quantity: number; reps: Set<string> } } = {};

    orders.forEach(order => {
      const repIdStr = String(order.rep_id ?? order.representative_id ?? order.repId ?? order.user_id ?? '');
      // If a specific rep is selected, skip orders not matching
      if (selectedRepId && repIdStr !== selectedRepId) return;

      let items: any[] = [];
      if (Array.isArray(order.products)) {
        items = order.products;
      } else if (Array.isArray(order.order_items)) {
        items = order.order_items;
      } else if (Array.isArray(order.items)) {
        items = order.items;
      } else {
        const jsonStr = order.items_json || order.products_json || (typeof order.products === 'string' ? order.products : null) || (typeof order.items === 'string' ? order.items : null);
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) items = parsed;
          } catch (e) {}
        }
      }

      const matchedRep = reps.find(r => String(r.id) === repIdStr);
      const repName = matchedRep?.name || order.rep_name || order.representative_name || (repIdStr ? `مندوب #${repIdStr}` : 'غير محدد');

      items.forEach(item => {
        const rawName = item.name || item.product_name || item.title || item.productName || item.product_title || 'منتج غير معروف';
        const rawColor = item.color || item.product_color || item.variant_color;
        const rawSize = item.size || item.product_size || item.variant_size;
        const rawBarcode = item.barcode || item.sku || item.code || item.product_barcode;
        const qty = Number(item.quantity ?? item.qty ?? item.count ?? item.pieces ?? 0);

        if (qty > 0) {
          const { productName, color, size, barcode } = parseProductDetails(rawName, rawColor, rawSize, rawBarcode);
          const key = `${productName}___${color}___${size}___${barcode}`;

          if (!dataMap[key]) {
            dataMap[key] = { productName, color, size, barcode, quantity: 0, reps: new Set() };
          }
          dataMap[key].quantity += qty;
          dataMap[key].reps.add(repName);
        }
      });
    });

    return Object.values(dataMap).map(data => ({
      ...data,
      repsArr: Array.from(data.reps)
    })).sort((a, b) => b.quantity - a.quantity);

  }, [orders, selectedRepId, reps]);

  const totalItems = custodyData.reduce((sum, item) => sum + item.quantity, 0);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const repLabel = selectedRepId ? (reps.find(r => String(r.id) === selectedRepId)?.name || 'محدد') : 'جميع المناديب';
    const dateStr = new Date().toLocaleString('ar-EG');

    const html = `
      <html dir="rtl">
        <head>
          <title>تقرير بضائع عهدة المندوب</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; color: #1e40af; margin-bottom: 5px; }
            .header-info { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; font-size: 13px; }
            th { background-color: #f3f4f6; color: #1f2937; }
            .totals { margin-top: 20px; font-weight: bold; font-size: 18px; text-align: left; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>تقرير بضائع عهدة المندوب</h1>
          <div class="header-info">المندوب: ${repLabel} | تاريخ الطباعة: ${dateStr}</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم المنتج</th>
                <th>اللون</th>
                <th>المقاس</th>
                <th>الباركود</th>
                <th>إجمالي القطع في العهدة</th>
                ${!selectedRepId ? '<th>المناديب المسند لهم</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${custodyData.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.productName}</td>
                  <td>${item.color}</td>
                  <td>${item.size}</td>
                  <td>${item.barcode}</td>
                  <td>${item.quantity}</td>
                  ${!selectedRepId ? `<td>${item.repsArr.join('، ')}</td>` : ''}
                </tr>
              `).join('')}
              ${custodyData.length === 0 ? `<tr><td colspan="${!selectedRepId ? 7 : 6}" style="text-align: center;">لا توجد بضائع في العهدة</td></tr>` : ''}
            </tbody>
          </table>
          <div class="totals">إجمالي القطع الكلي: ${totalItems}</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const headers = ['اسم المنتج', 'اللون', 'المقاس', 'الباركود', 'إجمالي القطع في العهدة'];
    if (!selectedRepId) headers.push('المناديب المسند لهم');

    const rows = custodyData.map(item => {
      const row = [item.productName, item.color, item.size, item.barcode, String(item.quantity)];
      if (!selectedRepId) row.push(item.repsArr.join(' - '));
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rep_custody_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/30 text-right">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-xl">
              <Package className="text-blue-600 dark:text-blue-400 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">بضائع عهدة المندوب</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">تفاصيل البضائع المتوفرة حالياً في عهدة المناديب (الأصناف، الألوان، المقاسات)</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="min-w-[200px]">
              <CustomSelect
                value={selectedRepId}
                onChange={setSelectedRepId}
                options={[
                  { value: '', label: 'جميع المناديب' },
                  ...reps.map(r => ({ value: String(r.id), label: r.name }))
                ]}
                placeholder="تصفية حسب المندوب"
              />
            </div>
            
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl font-bold shadow-sm hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Download size={16} /> تصدير CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Printer size={16} /> طباعة
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/30 text-right">
              <div className="text-blue-600 dark:text-blue-400 text-sm font-bold mb-2">إجمالي القطع في العهدة</div>
              <div className="text-3xl font-black text-slate-800 dark:text-white">{totalItems.toLocaleString()}</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 text-right">
              <div className="text-emerald-600 dark:text-emerald-400 text-sm font-bold mb-2">أنواع الأصناف والأنواع</div>
              <div className="text-3xl font-black text-slate-800 dark:text-white">{custodyData.length.toLocaleString()}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/30 text-right">
              <div className="text-purple-600 dark:text-purple-400 text-sm font-bold mb-2">المناديب ذوي العهدة</div>
              <div className="text-3xl font-black text-slate-800 dark:text-white">
                {new Set(custodyData.flatMap(c => c.repsArr)).size}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-4 font-bold">#</th>
                  <th className="px-6 py-4 font-bold">اسم المنتج / الصنف</th>
                  <th className="px-4 py-4 font-bold text-center">اللون</th>
                  <th className="px-4 py-4 font-bold text-center">المقاس</th>
                  <th className="px-4 py-4 font-bold text-center">الباركود</th>
                  <th className="px-6 py-4 font-bold text-center">الكمية في العهدة</th>
                  {!selectedRepId && <th className="px-6 py-4 font-bold">موزعة مع (المناديب)</th>}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={!selectedRepId ? 7 : 6} className="px-6 py-10 text-center font-bold text-slate-400">جاري تحميل البيانات...</td>
                  </tr>
                ) : custodyData.length > 0 ? (
                  custodyData.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4 font-black text-slate-800 dark:text-white">{item.productName}</td>
                      <td className="px-4 py-4 text-center text-xs font-bold">
                        {item.color !== '—' ? (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.color}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-bold">
                        {item.size !== '—' ? (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.size}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-mono font-bold text-slate-500">
                        {item.barcode !== '—' ? item.barcode : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-bold">
                          {item.quantity} قطعة
                        </span>
                      </td>
                      {!selectedRepId && (
                        <td className="px-6 py-4 text-xs font-semibold leading-relaxed">
                          {item.repsArr.map((r, i) => (
                            <span key={i} className="inline-block bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mr-1 mb-1 border border-slate-200 dark:border-slate-600">
                              {r}
                            </span>
                          ))}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={!selectedRepId ? 7 : 6} className="px-6 py-10 text-center font-bold text-slate-400">لا توجد بضائع مسجلة في العهدة حالياً.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportRepCustody;
