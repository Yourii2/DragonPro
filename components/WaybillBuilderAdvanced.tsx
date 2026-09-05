import React, { useState, useCallback, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Rnd } from 'react-rnd';
import html2canvas from 'html2canvas';
import QRCode from 'react-qr-code';
import {
  Palette, Type, Layout, Save, Trash2, Copy, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Square, Circle, Minus, Barcode as BarcodeIcon, Undo2, Redo2,
  ArrowUpToLine, ArrowDownToLine, Lock, Unlock, MousePointer2, Image as ImageIcon,
  Download, QrCode, AlignVerticalSpaceAround, AlignHorizontalSpaceAround
} from 'lucide-react';
import Barcode from './Barcode';
import { getOrderData } from './UniversalWaybillRenderer';
import { assetUrl } from '../services/assetUrl';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CanvasItemType = 'text' | 'barcode' | 'qr' | 'logo' | 'image' | 'table' | 'rect' | 'circle' | 'line' | 'dynamic';

export interface CanvasItem {
  id: string;
  type: CanvasItemType;
  dynamicKey?: string;
  x: number;
  y: number;
  width: number | string;
  height: number | string;
  content?: string;
  src?: string; // For images
  isLocked?: boolean;
  style: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: 'left' | 'center' | 'right';
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    padding?: number;
    opacity?: number;
    zIndex?: number;
  };
}

const MOCK_ORDER = {
  orderNumber: '2024-001',
  customerName: 'أحمد محمد علي',
  phone1: '01012345678',
  phone2: '01198765432',
  governorate: 'القاهرة',
  address: 'شارع التحرير، الدقي، الجيزة',
  notes: 'يرجى التأكد من المعاينة قبل الاستلام',
  date: new Date().toISOString().slice(0, 10),
  products: [
    { name: 'قميص قطن', color: 'أبيض', size: 'XL', quantity: 2, price: 250, total: 500 },
    { name: 'بنطلون جينز', color: 'أزرق', size: '34', quantity: 1, price: 350, total: 350 },
  ],
  shipping: 50,
  total: 900,
  employee: 'محمد أحمد',
  page: 'متجر درايجون',
};

const DYNAMIC_FIELDS = [
  { key: 'companyName', label: 'اسم الشركة', sample: 'شركة دراجون' },
  { key: 'companyPhone', label: 'هاتف الشركة', sample: '01000000000' },
  { key: 'companyTerms', label: 'سياسة الشركة / الشروط', sample: 'تعتبر هذه البوليصة مستند استلام رسمي. المعاينة حق للعميل قبل الاستلام.' },
  { key: 'date', label: 'التاريخ', sample: new Date().toISOString().slice(0, 10) },
  { key: 'orderNumber', label: 'رقم الأوردر', sample: '2024-001' },
  { key: 'customerName', label: 'اسم العميل', sample: 'أحمد محمد علي' },
  { key: 'phone1', label: 'الهاتف الأول', sample: '01012345678' },
  { key: 'phone2', label: 'الهاتف الثاني', sample: '01198765432' },
  { key: 'governorate', label: 'المحافظة', sample: 'القاهرة' },
  { key: 'address', label: 'العنوان', sample: 'شارع التحرير، الدقي' },
  { key: 'shipping', label: 'الشحن', sample: '50 ج.م' },
  { key: 'total', label: 'الإجمالي', sample: '900 ج.م' },
  { key: 'notes', label: 'الملاحظات', sample: 'معاينة قبل الاستلام' },
  { key: 'employee', label: 'الموظف', sample: 'محمد أحمد' },
  { key: 'page', label: 'البيدج', sample: 'متجر درايجون' },
];

const CANVAS_WIDTH = 380;
const CANVAS_HEIGHT = 530;

// ─── Main Component ───────────────────────────────────────────────────────────

const WaybillBuilderAdvanced: React.FC = () => {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [history, setHistory] = useState<CanvasItem[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('القالب المتقدم الاحترافي');
  
  // Smart Guides State
  const [guideLines, setGuideLines] = useState<{ axis: 'x'|'y', pos: number }[]>([]);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipboardRef = useRef<CanvasItem[]>([]);
  
  const companyLogo = localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo') || assetUrl('Dragon.png');
  const d = getOrderData(MOCK_ORDER);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('Dragon_advanced_waybill_template');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.items && Array.isArray(parsed.items)) {
          setItems(parsed.items);
          setHistory([parsed.items]);
          setHistoryIndex(0);
          if (parsed.name) setTemplateName(parsed.name);
        }
      }
    } catch (e) { }
  }, []);

  // --- History & State Management ---
  const pushState = (newItems: CanvasItem[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newItems);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setItems(newItems);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setItems(history[historyIndex - 1]);
      setSelectedIds([]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setItems(history[historyIndex + 1]);
      setSelectedIds([]);
    }
  };

  // --- Actions ---
  const addItem = (type: CanvasItemType, dynamicKey?: string, src?: string) => {
    const newItem: CanvasItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      dynamicKey,
      src,
      x: 20,
      y: 20,
      width: type === 'line' ? 200 : type === 'rect' ? 100 : type === 'table' ? 340 : 150,
      height: type === 'line' ? 2 : type === 'rect' ? 50 : 30,
      content: type === 'text' ? 'نص جديد' : '',
      isLocked: false,
      style: {
        color: '#000000',
        backgroundColor: type === 'rect' || type === 'circle' ? '#e2e8f0' : 'transparent',
        fontSize: 14,
        fontWeight: 'normal',
        textAlign: 'right',
        borderWidth: 0,
        borderColor: '#000000',
        borderRadius: type === 'circle' ? 9999 : 0,
        borderStyle: 'solid',
        padding: 0,
        opacity: 1,
        zIndex: items.length + 1
      }
    };
    
    if (type === 'barcode') {
      newItem.width = 150;
      newItem.height = 40;
    } else if (type === 'qr') {
      newItem.width = 80;
      newItem.height = 80;
    } else if (type === 'logo' || type === 'image') {
      newItem.width = 100;
      newItem.height = 100;
    } else if (type === 'line') {
      newItem.style.backgroundColor = '#000000';
    }

    pushState([...items, newItem]);
    setSelectedIds([newItem.id]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        addItem('image', undefined, ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateItems = (ids: string[], changes: Partial<CanvasItem>, saveHistory = true) => {
    const newItems = items.map(item => ids.includes(item.id) ? { ...item, ...changes } : item);
    if (saveHistory) pushState(newItems);
    else setItems(newItems);
  };

  const updateItemsStyle = (ids: string[], styleChanges: Partial<CanvasItem['style']>) => {
    const newItems = items.map(item => ids.includes(item.id) ? { ...item, style: { ...item.style, ...styleChanges } } : item);
    pushState(newItems);
  };

  const deleteItems = (ids: string[]) => {
    pushState(items.filter(item => !ids.includes(item.id)));
    setSelectedIds([]);
  };

  const duplicateItems = (ids: string[]) => {
    const newItems = items.filter(i => ids.includes(i.id)).map((itemToCopy, idx) => ({
      ...itemToCopy,
      id: `item_${Date.now()}_${idx}`,
      x: (itemToCopy.x as number) + 20,
      y: (itemToCopy.y as number) + 20,
      style: { ...itemToCopy.style, zIndex: items.length + 1 + idx }
    }));
    pushState([...items, ...newItems]);
    setSelectedIds(newItems.map(i => i.id));
  };

  const copyToClipboard = () => {
    clipboardRef.current = items.filter(i => selectedIds.includes(i.id));
  };

  const pasteFromClipboard = () => {
    if (clipboardRef.current.length === 0) return;
    const newItems = clipboardRef.current.map((itemToCopy, idx) => ({
      ...itemToCopy,
      id: `item_${Date.now()}_${idx}`,
      x: (itemToCopy.x as number) + 20,
      y: (itemToCopy.y as number) + 20,
      style: { ...itemToCopy.style, zIndex: items.length + 1 + idx }
    }));
    pushState([...items, ...newItems]);
    setSelectedIds(newItems.map(i => i.id));
  };

  const bringToFront = (ids: string[]) => {
    const maxZ = Math.max(...items.map(i => i.style.zIndex || 0), 0);
    updateItemsStyle(ids, { zIndex: maxZ + 1 });
  };

  const sendToBack = (ids: string[]) => {
    const minZ = Math.min(...items.map(i => i.style.zIndex || 0), 0);
    updateItemsStyle(ids, { zIndex: minZ - 1 });
  };

  // Keyboard Shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if user is typing in an input field
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedIds.length > 0) {
        const unprotected = selectedIds.filter(id => !items.find(i => i.id === id)?.isLocked);
        if (unprotected.length > 0) deleteItems(unprotected);
      }
    }
    if (e.ctrlKey && e.key === 'c') copyToClipboard();
    if (e.ctrlKey && e.key === 'v') pasteFromClipboard();
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }

    // Arrow keys for 1px precise movement
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
      e.preventDefault();
      const unprotected = selectedIds.filter(id => !items.find(i => i.id === id)?.isLocked);
      if (unprotected.length === 0) return;
      
      const newItems = items.map(item => {
        if (unprotected.includes(item.id)) {
          let dx = 0, dy = 0;
          if (e.key === 'ArrowUp') dy = -1;
          if (e.key === 'ArrowDown') dy = 1;
          if (e.key === 'ArrowLeft') dx = -1; // Assuming RTL, left is -X (or +X depending on how you view it, usually standard X/Y applies)
          if (e.key === 'ArrowRight') dx = 1;
          return { ...item, x: (item.x as number) + dx, y: (item.y as number) + dy };
        }
        return item;
      });
      // Do not push to history immediately to avoid spam, just set items
      // A better way is debouncing history, but for now we just update state
      setItems(newItems);
    }
  }, [selectedIds, items, historyIndex, history]);

  // Push to history on key up if arrow keys were used
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
       // Only push if there's a difference. Simple way: just push state.
       pushState(items);
    }
  }, [items, selectedIds]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    }
  }, [handleKeyDown, handleKeyUp]);

  // Export to PNG
  const exportToPNG = async () => {
    if (!canvasRef.current) return;
    
    // Briefly hide selection rings
    const prevSelected = [...selectedIds];
    setSelectedIds([]);
    
    // Give react time to render without rings
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(canvasRef.current!, {
          scale: 2, // High resolution
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        const link = document.createElement('a');
        link.download = `waybill_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Failed to export image', err);
      } finally {
        setSelectedIds(prevSelected);
      }
    }, 100);
  };

  const saveTemplate = () => {
    const templateData = { name: templateName, items, savedAt: new Date().toISOString() };
    localStorage.setItem('Dragon_advanced_waybill_template', JSON.stringify(templateData));
    localStorage.setItem('Dragon_waybill_template', '51');
    
    Swal.fire({
      title: '✅ تم الحفظ',
      text: `تم حفظ القالب المخصص وجعله القالب الافتراضي برقم 51`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // --- Render Item Content ---
  const renderItemContent = (item: CanvasItem) => {
    const { type, dynamicKey, content, style, height, src } = item;
    
    if (type === 'barcode') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none">
          <Barcode value={d.orderNumber} height={Math.max(20, (parseInt(height as string) || 40) - 15)} width={1.5} />
          {style.fontSize && style.fontSize > 0 && <span style={{ fontSize: style.fontSize, marginTop: 2 }}>{d.orderNumber}</span>}
        </div>
      );
    }

    if (type === 'qr') {
      return (
        <div className="w-full h-full flex items-center justify-center pointer-events-none p-1">
          <QRCode value={`https://track.dragon.com/${d.orderNumber}`} size={Math.min(parseInt(item.width as string) || 80, parseInt(height as string) || 80) - 10} />
        </div>
      );
    }
    
    if (type === 'logo') {
      return <img src={companyLogo} alt="Logo" className="w-full h-full object-contain pointer-events-none" />;
    }

    if (type === 'image' && src) {
      return <img src={src} alt="Uploaded" className="w-full h-full object-contain pointer-events-none" />;
    }
    
    if (type === 'table') {
      return (
        <table className="w-full h-full border-collapse pointer-events-none" style={{ fontSize: style.fontSize }}>
          <thead>
            <tr style={{ backgroundColor: style.backgroundColor || '#f1f5f9' }}>
              <th className="p-1 border text-right" style={{ borderColor: style.borderColor }}>المنتج</th>
              <th className="p-1 border text-center w-[30px]" style={{ borderColor: style.borderColor }}>الكمية</th>
              <th className="p-1 border text-center w-[50px]" style={{ borderColor: style.borderColor }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-1 border" style={{ borderColor: style.borderColor }}>قميص قطن</td>
              <td className="p-1 border text-center" style={{ borderColor: style.borderColor }}>2</td>
              <td className="p-1 border text-center" style={{ borderColor: style.borderColor }}>500</td>
            </tr>
            <tr>
              <td className="p-1 border" style={{ borderColor: style.borderColor }}>بنطلون جينز</td>
              <td className="p-1 border text-center" style={{ borderColor: style.borderColor }}>1</td>
              <td className="p-1 border text-center" style={{ borderColor: style.borderColor }}>350</td>
            </tr>
          </tbody>
        </table>
      );
    }
    
    if (type === 'rect' || type === 'circle' || type === 'line') {
      return <div className="w-full h-full pointer-events-none"></div>;
    }

    let displayContent = content;
    if (type === 'dynamic' && dynamicKey) {
      const field = DYNAMIC_FIELDS.find(f => f.key === dynamicKey);
      displayContent = field ? field.sample : '';
    }

    return (
      <div className="w-full h-full pointer-events-none whitespace-pre-wrap flex items-center" style={{ 
        lineHeight: 1.2, 
        justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'left' ? 'flex-start' : 'flex-end'
      }}>
        {displayContent}
      </div>
    );
  };

  const selectedItem = selectedIds.length === 1 ? items.find(i => i.id === selectedIds[0]) : null;

  // Render Rulers
  const renderRuler = (type: 'horizontal' | 'vertical') => {
    const size = type === 'horizontal' ? CANVAS_WIDTH : CANVAS_HEIGHT;
    const ticks = [];
    for (let i = 0; i <= size; i += 10) {
      const isMajor = i % 50 === 0;
      ticks.push(
        <div key={i} className={`absolute ${type === 'horizontal' ? 'bottom-0 border-l' : 'right-0 border-t'} border-slate-400`}
             style={{ 
               [type === 'horizontal' ? 'left' : 'top']: i,
               [type === 'horizontal' ? 'height' : 'width']: isMajor ? '8px' : '4px',
               borderLeftWidth: type === 'horizontal' ? '1px' : '0',
               borderTopWidth: type === 'vertical' ? '1px' : '0'
             }}>
          {isMajor && i !== 0 && (
            <span className={`absolute text-[8px] text-slate-500 font-mono ${type === 'horizontal' ? '-top-4 -left-3' : '-left-6 -top-2'}`}>
              {i}
            </span>
          )}
        </div>
      );
    }
    return ticks;
  };

  // Drag Handlers for Smart Guides
  const onDrag = (e: any, d: any, itemId: string) => {
    const threshold = 5;
    let newGuides: { axis: 'x'|'y', pos: number }[] = [];
    
    const currX = d.x;
    const currY = d.y;
    
    items.forEach(item => {
      if (item.id === itemId) return; // Skip self
      // Check X alignment
      if (Math.abs((item.x as number) - currX) < threshold) newGuides.push({ axis: 'x', pos: item.x as number });
      // Check Y alignment
      if (Math.abs((item.y as number) - currY) < threshold) newGuides.push({ axis: 'y', pos: item.y as number });
    });
    
    setGuideLines(newGuides);
  };

  const onDragStop = (e: any, d: any, itemId: string) => {
    setGuideLines([]);
    
    // Find item original pos
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Calculate delta for multi-select
    const dx = d.x - (item.x as number);
    const dy = d.y - (item.y as number);

    if (selectedIds.length > 1 && selectedIds.includes(itemId)) {
      const newItems = items.map(it => {
        if (selectedIds.includes(it.id)) {
          return { ...it, x: (it.x as number) + dx, y: (it.y as number) + dy };
        }
        return it;
      });
      pushState(newItems);
    } else {
      updateItems([itemId], { x: d.x, y: d.y });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
      
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={historyIndex === 0} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors" title="تراجع (Ctrl+Z)"><Undo2 size={18} /></button>
          <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors" title="إعادة (Ctrl+Y)"><Redo2 size={18} /></button>
          
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2"></div>
          
          <button onClick={exportToPNG} className="p-2 rounded-lg hover:bg-green-100 text-green-600 transition-colors flex items-center gap-1 text-xs font-bold" title="تصدير صورة">
            <Download size={16} /> تصدير
          </button>

          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2"></div>
          
          {selectedIds.length > 0 && (
            <>
              <button onClick={() => bringToFront(selectedIds)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-xs font-bold" title="إرسال للأمام">
                <ArrowUpToLine size={16} /> للأمام
              </button>
              <button onClick={() => sendToBack(selectedIds)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-xs font-bold" title="إرسال للخلف">
                <ArrowDownToLine size={16} /> للخلف
              </button>
              <button onClick={() => duplicateItems(selectedIds)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-xs font-bold">
                <Copy size={16} /> تكرار
              </button>
              <button onClick={() => deleteItems(selectedIds)} className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors flex items-center gap-1 text-xs font-bold">
                <Trash2 size={16} /> حذف
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 flex-1 max-w-sm ml-4">
          <input
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-purple-400"
            placeholder="اسم القالب المتقدم..."
          />
          <button onClick={saveTemplate} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
            <Save size={16} /> حفظ (قالب 51)
          </button>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        
        {/* Right Toolbox */}
        <div className="w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 custom-scrollbar">
          <h3 className="font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">عناصر التصميم</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">الأساسيات</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => addItem('text')} className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-700 dark:text-slate-200 border dark:border-slate-600 rounded-xl transition-all"><Type size={18} className="text-purple-500"/><span className="text-[10px] font-bold">نص حر</span></button>
                <button onClick={() => addItem('table')} className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-700 dark:text-slate-200 border dark:border-slate-600 rounded-xl transition-all"><Layout size={18} className="text-purple-500"/><span className="text-[10px] font-bold">جدول منتجات</span></button>
                <button onClick={() => addItem('barcode')} className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-700 dark:text-slate-200 border dark:border-slate-600 rounded-xl transition-all"><BarcodeIcon size={18} className="text-purple-500"/><span className="text-[10px] font-bold">باركود</span></button>
                <button onClick={() => addItem('qr')} className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-700 dark:text-slate-200 border dark:border-slate-600 rounded-xl transition-all"><QrCode size={18} className="text-purple-500"/><span className="text-[10px] font-bold">QR كود</span></button>
                <button onClick={() => addItem('logo')} className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-700 dark:text-slate-200 border dark:border-slate-600 rounded-xl transition-all"><Palette size={18} className="text-purple-500"/><span className="text-[10px] font-bold">لوجو الشركة</span></button>
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-700 dark:text-slate-200 border dark:border-slate-600 rounded-xl transition-all"><ImageIcon size={18} className="text-purple-500"/><span className="text-[10px] font-bold">إدراج صورة</span></button>
              </div>
            </div>
            
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">الأشكال</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => addItem('rect')} className="flex flex-col items-center justify-center p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 text-slate-700 border dark:border-slate-600 rounded-xl transition-all"><Square size={16} /></button>
                <button onClick={() => addItem('circle')} className="flex flex-col items-center justify-center p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 text-slate-700 border dark:border-slate-600 rounded-xl transition-all"><Circle size={16} /></button>
                <button onClick={() => addItem('line')} className="flex flex-col items-center justify-center p-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 text-slate-700 border dark:border-slate-600 rounded-xl transition-all"><Minus size={16} /></button>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">البيانات الديناميكية (متغيرة)</p>
              <div className="flex flex-wrap gap-1.5">
                {DYNAMIC_FIELDS.map(f => (
                  <button 
                    key={f.key} 
                    onClick={() => addItem('dynamic', f.key)} 
                    className="px-2 py-1 text-[10px] bg-slate-100 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-purple-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded font-bold transition-colors"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-2xl shadow-inner overflow-auto flex items-center justify-center p-12 relative border border-slate-200 dark:border-slate-800"
             onClick={(e) => {
               if (e.target === e.currentTarget) setSelectedIds([]);
             }}>
          
          {/* Canvas Wrapper with Rulers */}
          <div className="relative">
            {/* Top Ruler */}
            <div className="absolute -top-6 left-0 right-0 h-5 bg-white border border-slate-300 pointer-events-none">
              {renderRuler('horizontal')}
            </div>
            {/* Left Ruler */}
            <div className="absolute -left-6 top-0 bottom-0 w-5 bg-white border border-slate-300 pointer-events-none">
              {renderRuler('vertical')}
            </div>
            
            {/* Actual Canvas */}
            <div 
              ref={canvasRef}
              className="bg-white shadow-xl relative"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            >
              {/* Grid Pattern */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              
              {/* Smart Guides */}
              {guideLines.map((g, idx) => (
                <div key={idx} className="absolute bg-red-500 z-[9999] pointer-events-none" 
                     style={g.axis === 'x' ? { left: g.pos, top: 0, bottom: 0, width: '1px' } : { top: g.pos, left: 0, right: 0, height: '1px' }} />
              ))}

              {items.map(item => (
                <Rnd
                  key={item.id}
                  size={{ width: item.width, height: item.height }}
                  position={{ x: item.x, y: item.y }}
                  onDrag={(e, d) => onDrag(e, d, item.id)}
                  onDragStop={(e, d) => onDragStop(e, d, item.id)}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    updateItems([item.id], {
                      width: ref.style.width,
                      height: ref.style.height,
                      ...position,
                    });
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      if (selectedIds.includes(item.id)) setSelectedIds(selectedIds.filter(id => id !== item.id));
                      else setSelectedIds([...selectedIds, item.id]);
                    } else {
                      setSelectedIds([item.id]);
                    }
                  }}
                  disableDragging={item.isLocked}
                  enableResizing={!item.isLocked}
                  bounds="parent"
                  dragGrid={[1, 1]} 
                  resizeGrid={[1, 1]}
                  className={`group absolute ${selectedIds.includes(item.id) ? 'ring-2 ring-purple-500 shadow-xl z-[999]' : 'hover:ring-1 hover:ring-purple-300'}`}
                  style={{
                    ...item.style,
                    borderWidth: item.style.borderWidth,
                    borderColor: item.style.borderColor,
                    borderStyle: item.style.borderStyle,
                    borderRadius: item.style.borderRadius,
                    backgroundColor: item.style.backgroundColor,
                    color: item.style.color,
                    padding: item.style.padding,
                    opacity: item.style.opacity,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: item.isLocked ? 'default' : 'move',
                    overflow: 'hidden'
                  }}
                >
                  {renderItemContent(item)}
                </Rnd>
              ))}
            </div>
          </div>
        </div>

        {/* Left Properties Panel */}
        <div className="w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 custom-scrollbar">
          <h3 className="font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">الخصائص المتقدمة</h3>
          
          {selectedIds.length === 0 ? (
            <div className="text-center text-slate-400 py-10 flex flex-col items-center gap-3 mt-10">
              <MousePointer2 size={40} className="opacity-20 text-purple-500" />
              <p className="text-sm font-bold">حدد عنصراً أو أكثر (Shift) للبدء بتعديله</p>
            </div>
          ) : (
            <div className="space-y-5 pb-8">
              
              {selectedIds.length > 1 && (
                <div className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between">
                  <span>تم تحديد {selectedIds.length} عناصر</span>
                </div>
              )}

              {/* Coordinates & Size (Only if single selection) */}
              {selectedItem && selectedIds.length === 1 && (
                <>
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded text-xs font-mono text-slate-500 mb-2">
                    <span>{selectedItem.type.toUpperCase()}</span>
                    <span>Z: {selectedItem.style.zIndex}</span>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-2">الأبعاد والموقع</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex border dark:border-slate-600 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-700">
                        <span className="bg-slate-100 dark:bg-slate-600 px-2 py-1 text-xs text-slate-500 flex items-center border-l dark:border-slate-500">X</span>
                        <input type="number" value={Math.round(selectedItem.x)} onChange={e => updateItems([selectedItem.id], { x: Number(e.target.value) })} className="w-full text-sm bg-transparent px-2 outline-none dark:text-white" disabled={selectedItem.isLocked}/>
                      </div>
                      <div className="flex border dark:border-slate-600 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-700">
                        <span className="bg-slate-100 dark:bg-slate-600 px-2 py-1 text-xs text-slate-500 flex items-center border-l dark:border-slate-500">Y</span>
                        <input type="number" value={Math.round(selectedItem.y)} onChange={e => updateItems([selectedItem.id], { y: Number(e.target.value) })} className="w-full text-sm bg-transparent px-2 outline-none dark:text-white" disabled={selectedItem.isLocked}/>
                      </div>
                    </div>
                  </div>

                  {(selectedItem.type === 'text') && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-2">النص</p>
                      <textarea 
                        value={selectedItem.content}
                        onChange={e => updateItems([selectedItem.id], { content: e.target.value })}
                        className="w-full text-sm border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2 min-h-[60px] outline-none focus:border-purple-400"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Typography (Applies to multi-select if they have text) */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">تنسيق النص والألوان</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="flex items-center border dark:border-slate-600 rounded-lg px-2 bg-slate-50 dark:bg-slate-700">
                    <span className="text-xs text-slate-400 w-8">حجم</span>
                    <input type="number" value={selectedItem?.style.fontSize || 14} onChange={e => updateItemsStyle(selectedIds, { fontSize: Number(e.target.value) })} className="w-full text-sm bg-transparent outline-none dark:text-white" />
                  </div>
                  <div className="flex items-center border dark:border-slate-600 rounded-lg px-2 bg-slate-50 dark:bg-slate-700">
                    <span className="text-xs text-slate-400 w-8">لون</span>
                    <input type="color" value={selectedItem?.style.color || '#000000'} onChange={e => updateItemsStyle(selectedIds, { color: e.target.value })} className="w-full h-6 bg-transparent cursor-pointer border-none p-0" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex border dark:border-slate-600 rounded-lg overflow-hidden flex-1">
                    <button onClick={() => updateItemsStyle(selectedIds, { textAlign: 'right' })} className={`flex-1 p-1 flex justify-center ${selectedItem?.style.textAlign === 'right' ? 'bg-purple-100 text-purple-600' : 'bg-slate-50 dark:bg-slate-700'}`}><AlignRight size={14} /></button>
                    <button onClick={() => updateItemsStyle(selectedIds, { textAlign: 'center' })} className={`flex-1 p-1 flex justify-center border-x dark:border-slate-600 ${selectedItem?.style.textAlign === 'center' ? 'bg-purple-100 text-purple-600' : 'bg-slate-50 dark:bg-slate-700'}`}><AlignCenter size={14} /></button>
                    <button onClick={() => updateItemsStyle(selectedIds, { textAlign: 'left' })} className={`flex-1 p-1 flex justify-center ${selectedItem?.style.textAlign === 'left' ? 'bg-purple-100 text-purple-600' : 'bg-slate-50 dark:bg-slate-700'}`}><AlignLeft size={14} /></button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => updateItemsStyle(selectedIds, { fontWeight: selectedItem?.style.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`p-1.5 border dark:border-slate-600 rounded-lg ${selectedItem?.style.fontWeight === 'bold' ? 'bg-purple-100 border-purple-400 text-purple-600' : 'bg-slate-50 dark:bg-slate-700'}`}><Bold size={14} /></button>
                    <button onClick={() => updateItemsStyle(selectedIds, { fontStyle: selectedItem?.style.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`p-1.5 border dark:border-slate-600 rounded-lg ${selectedItem?.style.fontStyle === 'italic' ? 'bg-purple-100 border-purple-400 text-purple-600' : 'bg-slate-50 dark:bg-slate-700'}`}><Italic size={14} /></button>
                  </div>
                </div>
              </div>

              {/* Appearance */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">المظهر والإطارات</p>
                <div className="space-y-2">
                  <div className="flex items-center border dark:border-slate-600 rounded-lg px-2 bg-slate-50 dark:bg-slate-700">
                    <span className="text-xs text-slate-500 w-16">الخلفية</span>
                    <input type="color" value={selectedItem?.style.backgroundColor === 'transparent' ? '#ffffff' : (selectedItem?.style.backgroundColor || '#ffffff')} onChange={e => updateItemsStyle(selectedIds, { backgroundColor: e.target.value })} className="w-full h-6 bg-transparent cursor-pointer p-0 border-none" />
                    <button onClick={() => updateItemsStyle(selectedIds, { backgroundColor: 'transparent' })} className="text-[10px] bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded mr-2">شفاف</button>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex items-center border dark:border-slate-600 rounded-lg px-2 bg-slate-50 dark:bg-slate-700 flex-1">
                      <span className="text-xs text-slate-500 w-8">حدود</span>
                      <input type="number" value={selectedItem?.style.borderWidth || 0} onChange={e => updateItemsStyle(selectedIds, { borderWidth: Number(e.target.value) })} className="w-full text-sm bg-transparent outline-none dark:text-white" />
                    </div>
                    <div className="flex items-center border dark:border-slate-600 rounded-lg px-2 bg-slate-50 dark:bg-slate-700 flex-1">
                      <input type="color" value={selectedItem?.style.borderColor || '#000000'} onChange={e => updateItemsStyle(selectedIds, { borderColor: e.target.value })} className="w-full h-6 bg-transparent cursor-pointer p-0 border-none" />
                    </div>
                  </div>

                  <select value={selectedItem?.style.borderStyle || 'solid'} onChange={e => updateItemsStyle(selectedIds, { borderStyle: e.target.value as any })} className="w-full text-xs border dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white rounded-lg p-2 outline-none">
                    <option value="solid">متصل (Solid)</option>
                    <option value="dashed">متقطع (Dashed)</option>
                    <option value="dotted">منقط (Dotted)</option>
                  </select>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-slate-500">استدارة الزوايا</span>
                    <input type="range" min="0" max="100" value={selectedItem?.style.borderRadius || 0} onChange={e => updateItemsStyle(selectedIds, { borderRadius: Number(e.target.value) })} className="w-32" />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-slate-500">الشفافية</span>
                    <input type="range" min="0" max="1" step="0.1" value={selectedItem?.style.opacity ?? 1} onChange={e => updateItemsStyle(selectedIds, { opacity: Number(e.target.value) })} className="w-32" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default WaybillBuilderAdvanced;
