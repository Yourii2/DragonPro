import React, { useEffect, useState, useRef } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';
import CustomSelect from './CustomSelect';
import { 
  Package, 
  ScanBarcode, 
  User as UserIcon, 
  Warehouse, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  ArrowRight,
  ClipboardList
} from 'lucide-react';

const DeliveryConfirmation: React.FC = () => {
  const [noteId, setNoteId] = useState('');
  const [note, setNote] = useState<any | null>(null);
  const [scanValue, setScanValue] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [reps, setReps] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [notesList, setNotesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersList, setOrdersList] = useState<any[]>([]);

  // فوكس تلقائي على حقل السكان
  useEffect(() => {
    if (note && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [note]);

  const loadOrdersList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getPendingDeliveryNotes`);
      const data = await res.json();
      if (data && data.success) {
        setOrdersList(data.data || []);
        setShowOrdersModal(true);
      } else {
        Swal.fire('خطأ', 'فشل في تحميل قائمة الأذونات', 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'حدث خطأ أثناء تحميل قائمة الأذونات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadNote = async (id?: string) => {
    const useId = id || noteId;
    if (!useId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getDeliveryNoteDetails&id=${encodeURIComponent(useId)}`);
      const data = await res.json();
      if (data && data.success) {
        // دمج بيانات الطلب والبنود في كائن واحد
        const orderData = data.data.order || data.data;
        const itemsData = data.data.items || [];
        
        // تهيئة الكمية الممسوحة بـ 0
        const initializedItems = itemsData.map((it: any) => ({
          ...it,
          scanned_qty: it.scanned_qty || 0
        }));
        
        setNote({ ...orderData, items: initializedItems });
      } else {
        Swal.fire('خطأ', data.message || 'إذن التسليم غير موجود أو تم تسليمه مسبقاً', 'error');
        setNote(null);
      }
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'حدث خطأ أثناء تحميل بيانات الإذن', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanValue) return;

    // إذا لم يكن هناك إذن محمل، ابحث عن الإذن بالباركود
    if (!note) {
      // ابحث في قائمة الأذونات المعلقة عن إذن يحتوي على منتج بهذا الباركود
      if (ordersList.length === 0) {
        // إذا لم تكن قائمة الأذونات محملة، قم بتحميلها أولاً
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getPendingDeliveryNotes`);
          const data = await res.json();
          if (data && data.success && Array.isArray(data.data)) {
            setOrdersList(data.data);
            // ابحث عن الإذن
            const foundOrder = data.data.find((order: any) => {
              if (!order.items || !Array.isArray(order.items)) return false;
              return order.items.some((it: any) => String(it.barcode) === scanValue.trim());
            });
            if (foundOrder) {
              setNoteId(String(foundOrder.note_code || foundOrder.id));
              await loadNote(String(foundOrder.note_code || foundOrder.id));
              setScanValue('');
              // صوت نجاح
              new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
              return;
            }
          }
        } catch (e) {
          // ignore
        } finally {
          setLoading(false);
        }
        // إذا لم يتم العثور على إذن
        new Audio('https://assets.mixkit.co/active_storage/sfx/2873/2873-preview.mp3').play().catch(() => {});
        Swal.fire({
          title: 'إذن غير موجود!',
          text: 'لم يتم العثور على إذن تسليم يحتوي على هذا الباركود',
          icon: 'error',
          timer: 1500,
          showConfirmButton: false
        });
        setScanValue('');
        return;
      } else {
        // ابحث في القائمة الحالية
        const foundOrder = ordersList.find((order: any) => {
          if (!order.items || !Array.isArray(order.items)) return false;
          return order.items.some((it: any) => String(it.barcode) === scanValue.trim());
        });
        if (foundOrder) {
          setNoteId(String(foundOrder.note_code || foundOrder.id));
          await loadNote(String(foundOrder.note_code || foundOrder.id));
          setScanValue('');
          // صوت نجاح
          new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
          return;
        } else {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2873/2873-preview.mp3').play().catch(() => {});
          Swal.fire({
            title: 'إذن غير موجود!',
            text: 'لم يتم العثور على إذن تسليم يحتوي على هذا الباركود',
            icon: 'error',
            timer: 1500,
            showConfirmButton: false
          });
          setScanValue('');
          return;
        }
      }
    }

    // إذا كان هناك إذن محمل، نفذ المنطق القديم لمسح المنتج
    const items = [...note.items];
    const foundIdx = items.findIndex(it => String(it.barcode) === scanValue.trim());

    if (foundIdx !== -1) {
      if (items[foundIdx].scanned_qty < items[foundIdx].qty) {
        items[foundIdx].scanned_qty += 1;
        setNote({ ...note, items });
        setScanValue('');
        // صوت نجاح
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
      } else {
        Swal.fire('اكتمل!', 'لقد قمت بمسح الكمية المطلوبة لهذا المنتج بالفعل', 'info');
        setScanValue('');
      }
    } else {
      // صوت خطأ
      new Audio('https://assets.mixkit.co/active_storage/sfx/2873/2873-preview.mp3').play().catch(() => {});
      Swal.fire({
        title: 'منتج خاطئ!',
        text: 'الباركود الذي قمت بمسحه غير موجود في هذا الإذن',
        icon: 'error',
        timer: 1500,
        showConfirmButton: false
      });
      setScanValue('');
    }
  };

  const saveScans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=confirmDeliveryNote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: note.id })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire('تم التسليم', 'تم مطابقة وتسليم الإذن بنجاح للمخزن', 'success');
        setNote(null);
        setNoteId('');
      } else {
        Swal.fire('خطأ', data.message || 'فشل في حفظ عملية التسليم', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'فشل في حفظ عملية التسليم', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalRequired = note?.items.reduce((s: number, i: any) => s + Number(i.qty), 0) || 0;
  const totalScanned = note?.items.reduce((s: number, i: any) => s + Number(i.scanned_qty), 0) || 0;
  const progressPercent = totalRequired > 0 ? (totalScanned / totalRequired) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                <ScanBarcode className="w-8 h-8" />
              </div>
              تأكيد مطابقة المخزن
            </h1>
            <p className="text-slate-500 mt-2 font-medium">قم بمسح إذن التسليم ثم مطابقة المنتجات بالباركود</p>
          </div>

          {!note && (
            <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              <input
                type="text"
                placeholder="رقم الإذن أو Scan.."
                className="bg-transparent border-none focus:ring-0 px-4 py-2 w-48 font-bold"
                value={noteId}
                onChange={e => setNoteId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadNote()}
              />
              <button 
                onClick={() => loadNote()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl transition-all flex items-center gap-2 font-bold"
              >
                <Search className="w-4 h-4" /> بحث
              </button>
              <button
                onClick={() => loadOrdersList()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl transition-all flex items-center gap-2 font-bold"
              >
                <ClipboardList className="w-4 h-4" /> عرض الأذونات
              </button>
            </div>
          )}
        </div>
      </div>

      {!note ? (
        <div className="max-w-6xl mx-auto grid place-items-center py-20">
          <div className="text-center">
            <div className="bg-slate-100 p-10 rounded-full mb-6 inline-block">
              <ClipboardList className="w-20 h-20 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-600">انتظار مسح إذن التسليم...</h3>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Info & Stats Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 justify-around relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
               
               <div className="relative flex items-center gap-4">
                 <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
                   <UserIcon className="w-6 h-6" />
                 </div>
                 <div>
                   <span className="text-xs text-slate-400 block font-bold">المندوب المستلم</span>
                   <span className="text-lg font-black text-slate-700">{note.rep_name || 'غير محدد'}</span>
                 </div>
               </div>

               <div className="relative flex items-center gap-4">
                 <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                   <Warehouse className="w-6 h-6" />
                 </div>
                 <div>
                   <span className="text-xs text-slate-400 block font-bold">مخزن الصرف</span>
                   <span className="text-lg font-black text-slate-700">{note.warehouse_name || 'الرئيسي'}</span>
                 </div>
               </div>

               <div className="relative flex items-center gap-4">
                 <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
                   <Package className="w-6 h-6" />
                 </div>
                 <div>
                   <span className="text-xs text-slate-400 block font-bold">إجمالي القطع</span>
                   <span className="text-lg font-black text-slate-700">{totalRequired} قطعة</span>
                 </div>
               </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                 <div className="flex justify-between items-end mb-4">
                   <span className="text-indigo-400 font-bold">حالة المطابقة</span>
                   <span className="text-2xl font-black">{Math.round(progressPercent)}%</span>
                 </div>
                 <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mb-4">
                   <div 
                    className="bg-indigo-500 h-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                    style={{ width: `${progressPercent}%` }}
                   ></div>
                 </div>
                 <p className="text-xs text-slate-400 text-center">تم مسح {totalScanned} من أصل {totalRequired} قطعة</p>
               </div>
            </div>
          </div>

          {/* Scanner Input */}
          <div className="bg-white rounded-3xl p-6 shadow-md border-2 border-indigo-100">
            <form onSubmit={handleManualScan} className="flex gap-4">
              <div className="relative flex-1">
                <ScanBarcode className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 w-6 h-6" />
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="ابدأ مسح باركود المنتج الآن..."
                  className="w-full pr-14 pl-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-black text-xl placeholder:text-slate-300"
                  value={scanValue}
                  onChange={e => setScanValue(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                className="bg-indigo-600 text-white px-8 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                تأكيد يدوي
              </button>
            </form>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-5 text-right text-slate-500 font-bold">المنتج</th>
                  <th className="p-5 text-center text-slate-500 font-bold">المواصفات</th>
                  <th className="p-5 text-center text-slate-500 font-bold">الباركود</th>
                  <th className="p-5 text-center text-slate-500 font-bold">الكمية</th>
                  <th className="p-5 text-center text-slate-500 font-bold">الممسوح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {note.items.map((it: any) => {
                  const isDone = it.scanned_qty === it.qty;
                  const isStarted = it.scanned_qty > 0 && !isDone;

                  return (
                    <tr 
                      key={it.id} 
                      className={`transition-colors ${isDone ? 'bg-emerald-50/50' : isStarted ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="p-5">
                        <div className="font-black text-slate-700">{it.product_name}</div>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex gap-2 justify-center">
                          <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold text-slate-600">{it.color || '—'}</span>
                          <span className="bg-indigo-50 px-3 py-1 rounded-lg text-xs font-bold text-indigo-600">{it.size || '—'}</span>
                        </div>
                      </td>
                      <td className="p-5 text-center font-mono text-sm text-slate-400">{it.barcode}</td>
                      <td className="p-5 text-center font-black text-slate-500">{it.qty}</td>
                      <td className="p-5 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-lg ${isDone ? 'text-emerald-600' : isStarted ? 'text-amber-600' : 'text-slate-300'}`}>
                          {isDone ? <CheckCircle2 className="w-6 h-6" /> : <div className="w-6 h-6 border-2 border-dashed rounded-full border-current animate-spin-slow"></div>}
                          {it.scanned_qty}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center py-6">
            <button 
              onClick={() => { setNote(null); setNoteId(''); }}
              className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-100 transition-all flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" /> إلغاء العملية
            </button>
            
            <button 
              onClick={saveScans} 
              disabled={totalScanned < totalRequired || loading}
              className={`px-12 py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center gap-3
                ${totalScanned === totalRequired 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                  : 'bg-slate-300 cursor-not-allowed opacity-70'}
              `}
            >
              {loading ? 'جاري الحفظ...' : 'حفظ وإنهاء التسليم'}
              <CheckCircle2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800">قائمة أذونات التسليم</h2>
              <button
                onClick={() => setShowOrdersModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ArrowRight className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-6">
              {ordersList.length === 0 ? (
                <div className="text-center py-10">
                  <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">لا توجد أذونات تسليم معلقة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ordersList.map((order: any) => (
                    <div
                      key={order.id}
                      className="bg-slate-50 rounded-2xl p-4 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-bold text-sm">
                              #{order.note_code || order.code || order.id}
                            </span>
                            <span className="text-slate-600 font-bold text-sm">
                              {order.note_date ? new Date(order.note_date).toLocaleString('ar-EG') : (order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '—')}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 text-slate-700">
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-4 h-4 text-amber-600" />
                              <span className="font-bold">{order.rep_name || 'مندوب غير محدد'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Warehouse className="w-4 h-4 text-emerald-600" />
                              <span className="font-bold">{order.warehouse_name || order.to_warehouse_name || 'مخزن غير محدد'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-600" />
                              <span className="font-bold">{order.total_items || 0} قطعة</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const val = order.note_code || order.id;
                            setNoteId(String(val));
                            setShowOrdersModal(false);
                            loadNote(String(val));
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold transition-all"
                        >
                          اختيار
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default DeliveryConfirmation;