import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, ArrowDownLeft, ArrowUpRight, History, Box, QrCode, Plus, Edit, Trash2, Eye, MapPin, X, Save, ArrowLeftRight, CheckCircle2, MinusCircle, PlusCircle, FilePlus2, Search, FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';

interface InventoryModuleProps {
  initialView?: string;
}

const InventoryModule: React.FC<InventoryModuleProps> = ({ initialView }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'receiving' | 'returns' | 'warehouses' | 'transfer' | 'audit'>(
    initialView === 'receiving' ? 'receiving' : initialView === 'returns' ? 'returns' : 'stock'
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('كل المستودعات');
  const currencySymbol = 'ج.م';
  const productSource = (localStorage.getItem('Dragon_product_source') || 'both').toString();
  const defaultReceivingItemType = productSource === 'suppliers' ? 'product_new' : 'fabric_new';
  
  // --- Real Data State (Initialized Empty) ---
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [userDefaults, setUserDefaults] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]); 
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [warehouseStockCache, setWarehouseStockCache] = useState<Record<string, any[]>>({});
  const [warehouseFabricCache, setWarehouseFabricCache] = useState<Record<string, any[]>>({});
  const [warehouseAccessoryCache, setWarehouseAccessoryCache] = useState<Record<string, any[]>>({});
  const [movements, setMovements] = useState<any[]>([]); 

  const [isStockBarcodeModalOpen, setIsStockBarcodeModalOpen] = useState(false);
  const [stockBarcodeProduct, setStockBarcodeProduct] = useState<any>(null);

  const lastMissingSalePriceAlertKeyRef = useRef<string>('');

  const [warehouseFormData, setWarehouseFormData] = useState({ name: '', location: '' });
  const [transferData, setTransferData] = useState({ from: '', to: '', items: [{ productId: '', qty: 1 }] });
  const [transferSuccess, setTransferSuccess] = useState(false);

  // --- Inventory Audit State ---
  const [audits, setAudits] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStatusFilter, setAuditStatusFilter] = useState('all');
  const [auditWarehouseFilter, setAuditWarehouseFilter] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<any>(null);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [auditWarehouseId, setAuditWarehouseId] = useState('');
  const [auditNotes, setAuditNotes] = useState('');

  // --- Product Modals State ---
  const [isProductEditModalOpen, setIsProductEditModalOpen] = useState(false);
  const [isProductHistoryModalOpen, setIsProductHistoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProductHistory, setSelectedProductHistory] = useState<any>(null);

  const [productFormData, setProductFormData] = useState({ 
    id: null, 
    name: '', 
    barcode: '', 
    color: '', 
    size: '', 
    cost: 0, 
    price: 0, 
    quantity: 0, 
    reorderLevel: 5,
    warehouseId: '' // مهم: تحديد المخزن للكمية الافتتاحية
  });

  // Helper to fetch warehouses and apply user scoping
  const refreshWarehouses = async () => {
    try {
      const [wRes, dRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`).then(r=>r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r=>r.json()).catch(()=>({success:false}))
      ]);
      const list = (wRes && wRes.success) ? (wRes.data || []) : [];
      const defaults = (dRes && dRes.success) ? (dRes.data || null) : null;
      if (defaults && defaults.default_warehouse_id && !defaults.can_change_warehouse) {
        const filtered = list.filter((wh:any) => Number(wh.id) === Number(defaults.default_warehouse_id));
        setWarehouses(filtered);
        if (filtered.length > 0) setSelectedWarehouseFilter(filtered[0].name || '');
      } else {
        setWarehouses(list);
      }
      if (defaults) {
        setUserDefaults(defaults);
        if (defaults.default_warehouse_id) {
          const defW = defaults.default_warehouse_id;
          if (!receivingData.warehouseId) setReceivingData(prev => ({...prev, warehouseId: String(defW)}));
          if (!returnsData.warehouseId) setReturnsData(prev => ({...prev, warehouseId: String(defW)}));
        }
      }
      return { list, defaults };
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
      return { list: [], defaults: null };
    }
  };

  // --- Receiving & Returns State ---
  const [returnsData, setReturnsData] = useState({
    supplierId: '',
    warehouseId: '',
    items: [{ id: Date.now(), productId: '', qty: 1, costPrice: 0, name: '' }],
    receivedAmount: 0,
    treasuryId: '',
  });
  
  const [receivingData, setReceivingData] = useState({
    supplierId: '',
    warehouseId: '',
    items: [{ id: Date.now(), itemType: ((localStorage.getItem('Dragon_product_source') || 'both').toString() === 'suppliers') ? 'product_new' : 'fabric_new', isNew: true, name: '', color: '', size: '', costPrice: 0, sellingPrice: 0, qty: 1, barcode: '', productId: '' }],
    paidAmount: 0,
    treasuryId: '',
  });

  // Computed Values
  const currentSupplier = useMemo(() => suppliers.find(s => s.id === parseInt(receivingData.supplierId)) || null, [receivingData.supplierId, suppliers]);
  const invoiceTotal = useMemo(() => receivingData.items.reduce((sum, item) => sum + (Number(item.costPrice) * Number(item.qty)), 0), [receivingData.items]);
  const currentSupplierForReturn = useMemo(() => suppliers.find(s => s.id === parseInt(returnsData.supplierId)) || null, [returnsData.supplierId, suppliers]);
  const returnInvoiceTotal = useMemo(() => returnsData.items.reduce((sum, item) => sum + (Number(item.costPrice) * Number(item.qty)), 0), [returnsData.items]);

  useEffect(() => {
    if (['stock', 'receiving', 'returns', 'warehouses', 'transfer', 'audit'].includes(initialView || '')) {
      setActiveTab(initialView as any);
    }

    

    // Fetch suppliers from API
    const fetchSuppliers = async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=getAll`);
        const result = await response.json();
        if (result.success) {
          setSuppliers(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch suppliers:', error);
      }
    };

    // Fetch treasuries from API so selects can show available treasuries
    const fetchTreasuries = async () => {
      try {
        const [tRes, dRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r=>r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r=>r.json()).catch(()=>({success:false}))
        ]);
        const list = (tRes && tRes.success) ? (tRes.data || []) : [];
        const defaults = (dRes && dRes.success) ? (dRes.data || null) : null;
        if (defaults && defaults.default_treasury_id && !defaults.can_change_treasury) {
          const filtered = list.filter((tr:any) => Number(tr.id) === Number(defaults.default_treasury_id));
          setTreasuries(filtered);
        } else {
          setTreasuries(list);
        }
        if (defaults && defaults.default_treasury_id) {
          const defT = defaults.default_treasury_id || null;
          if (defT && !receivingData.treasuryId) setReceivingData(prev => ({...prev, treasuryId: String(defT)}));
          if (defT && !returnsData.treasuryId) setReturnsData(prev => ({...prev, treasuryId: String(defT)}));
          setUserDefaults(defaults);
        }
      } catch (err) { console.error('Failed to fetch treasuries:', err); }
    };

    const fetchUserDefaults = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`);
        const jr = await res.json();
        if (jr.success) {
          setUserDefaults(jr.data || null);
          // apply defaults to forms if not set
          if (jr.data) {
            const defW = jr.data.default_warehouse_id || null;
            const defT = jr.data.default_treasury_id || null;
            if (defW && !receivingData.warehouseId) setReceivingData(prev => ({...prev, warehouseId: String(defW)}));
            if (defW && !returnsData.warehouseId) setReturnsData(prev => ({...prev, warehouseId: String(defW)}));
            if (defT && !receivingData.treasuryId) setReceivingData(prev => ({...prev, treasuryId: String(defT)}));
            if (defT && !returnsData.treasuryId) setReturnsData(prev => ({...prev, treasuryId: String(defT)}));
          }
        }
      } catch (e) { console.error('Failed to fetch user defaults', e); }
    };

    refreshWarehouses();
    fetchSuppliers();
    fetchTreasuries();
    fetchUserDefaults();

    // Fetch products from API (defined below so handlers can reuse it)
    fetchProducts();

    // Fetch fabrics/accessories for receiving existing lists
    (async () => {
      try {
        const [fRes, aRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=getAll`).then(r => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE_PATH}/api.php?module=accessories&action=getAll`).then(r => r.json()).catch(() => ({ success: false })),
        ]);
        if (fRes && fRes.success) setFabrics(fRes.data || []);
        if (aRes && aRes.success) setAccessories(aRes.data || []);
      } catch (e) {
        console.error('Failed to fetch fabrics/accessories:', e);
      }
    })();
  }, [initialView]);

  // Products fetcher (shared so handlers can refresh list)
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getAll`);
      const result = await response.json();
      if (result.success) {
        setProducts(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchStockRows = async () => {
    try {
      if (!selectedWarehouseFilter || selectedWarehouseFilter === 'كل المستودعات') {
        const storeResp = await fetch(`${API_BASE_PATH}/api.php?module=stock&action=getAllSummary`).then(r => r.json()).catch(() => ({ success: false }));

        const storeMapped = (storeResp && storeResp.success ? (storeResp.data || []) : []).map((r: any) => ({
          id: r.product_id,
          name: r.name,
          barcode: r.barcode,
          color: r.color,
          size: r.size,
          cost: Number(r.cost || 0),
          price: Number(r.price || 0),
          stock: Number(r.quantity || 0),
          reorderLevel: Number(r.reorderLevel || 0),
          itemType: 'store',
        }));

        setStockRows(storeMapped);
        return;
      }

      const wh = warehouses.find(w => w.name === selectedWarehouseFilter);
      const wid = wh ? Number(wh.id) : 0;
      if (!wid) {
        setStockRows([]);
        return;
      }

      const storeResp = await fetch(`${API_BASE_PATH}/api.php?module=stock&action=getByWarehouse&warehouse_id=${wid}`).then(r => r.json()).catch(() => ({ success: false }));

      const storeMapped = (storeResp && storeResp.success ? (storeResp.data || []) : []).map((r: any) => ({
        id: r.product_id,
        name: r.name,
        barcode: r.barcode,
        color: r.color,
        size: r.size,
        cost: Number(r.cost || 0),
        price: Number(r.price || 0),
        stock: Number(r.quantity || 0),
        reorderLevel: Number(r.reorderLevel || 0),
        itemType: 'store',
      }));

      setStockRows(storeMapped);
    } catch (e) {
      console.error('Failed to fetch stock rows:', e);
      setStockRows([]);
    }
  };

  const fetchWarehouseStock = async (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    if (!wid) return;
    if (warehouseStockCache[wid]) return;
    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=stock&action=getByWarehouse&warehouse_id=${encodeURIComponent(wid)}`);
      const jr = await resp.json();
      if (jr && jr.success) {
        setWarehouseStockCache(prev => ({ ...prev, [wid]: jr.data || [] }));
      }
    } catch (e) {
      console.error('Failed to fetch warehouse stock:', e);
    }
  };

  const fetchWarehouseFabrics = async (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    if (!wid) return;
    if (warehouseFabricCache[wid]) return;
    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=getByWarehouse&warehouse_id=${encodeURIComponent(wid)}`);
      const jr = await resp.json();
      if (jr && jr.success) {
        setWarehouseFabricCache(prev => ({ ...prev, [wid]: jr.data || [] }));
      }
    } catch (e) {
      console.error('Failed to fetch warehouse fabrics:', e);
    }
  };

  const fetchWarehouseAccessories = async (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    if (!wid) return;
    if (warehouseAccessoryCache[wid]) return;
    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=accessories&action=getByWarehouse&warehouse_id=${encodeURIComponent(wid)}`);
      const jr = await resp.json();
      if (jr && jr.success) {
        setWarehouseAccessoryCache(prev => ({ ...prev, [wid]: jr.data || [] }));
      }
    } catch (e) {
      console.error('Failed to fetch warehouse accessories:', e);
    }
  };

  const invalidateWarehouseStock = (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    if (!wid) return;
    setWarehouseStockCache(prev => {
      if (!prev[wid]) return prev;
      const next = { ...prev };
      delete next[wid];
      return next;
    });
  };

  const invalidateWarehouseFabrics = (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    if (!wid) return;
    setWarehouseFabricCache(prev => {
      if (!prev[wid]) return prev;
      const next = { ...prev };
      delete next[wid];
      return next;
    });
  };

  const invalidateWarehouseAccessories = (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    if (!wid) return;
    setWarehouseAccessoryCache(prev => {
      if (!prev[wid]) return prev;
      const next = { ...prev };
      delete next[wid];
      return next;
    });
  };

  const getWarehouseStock = (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    return (wid && warehouseStockCache[wid]) ? warehouseStockCache[wid] : [];
  };

  const getWarehouseFabrics = (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    return (wid && warehouseFabricCache[wid]) ? warehouseFabricCache[wid] : [];
  };

  const getWarehouseAccessories = (warehouseId: string) => {
    const wid = String(warehouseId || '').trim();
    return (wid && warehouseAccessoryCache[wid]) ? warehouseAccessoryCache[wid] : [];
  };

  const readJsonSafely = async (response: Response) => {
    const text = await response.text();
    if (!text) return { success: false, message: `HTTP ${response.status}` };
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: text };
    }
  };

  useEffect(() => {
    if (returnsData.warehouseId) {
      fetchWarehouseStock(String(returnsData.warehouseId));
      fetchWarehouseFabrics(String(returnsData.warehouseId));
      fetchWarehouseAccessories(String(returnsData.warehouseId));
    }
  }, [returnsData.warehouseId]);

  useEffect(() => {
    if (transferData.from) {
      fetchWarehouseStock(String(transferData.from));
      fetchWarehouseFabrics(String(transferData.from));
      fetchWarehouseAccessories(String(transferData.from));
    }
  }, [transferData.from]);

  const openStockBarcodes = (p: any) => {
    const qty = Number(p?.stock || 0);
    const code = String(p?.barcode || '').trim();
    if (!qty || qty <= 0) {
      Swal.fire({ icon: 'warning', title: 'لا توجد كمية', text: 'لا توجد كمية متاحة لعرض باركوداتها.' });
      return;
    }
    if (!code || code === '-') {
      Swal.fire({ icon: 'warning', title: 'لا يوجد باركود', text: 'هذا الصنف لا يحتوي على باركود للطباعة.' });
      return;
    }
    setStockBarcodeProduct(p);
    setIsStockBarcodeModalOpen(true);
  };

  const printStockBarcodes = () => {
    const p = stockBarcodeProduct;
    if (!p) return;
    const qty = Number(p?.stock || 0);
    const code = String(p?.barcode || '').trim();
    if (!qty || qty <= 0 || !code || code === '-') return;

    const title = `${String(p?.name || '')} - ${String(p?.color || '-')}` + ` - ${String(p?.size || '-')}`;
    try {
      localStorage.setItem('Nexus_barcode_print_prefill_v1', JSON.stringify({
        items: [{ code, title, qty }]
      }));
    } catch {
      // ignore
    }
    try {
      window.dispatchEvent(new CustomEvent('nexus:navigate', { detail: { slug: 'barcode-print', subSlug: '' } }));
    } catch {
      // ignore
    }
    setIsStockBarcodeModalOpen(false);
  };

  // Refetch products when warehouse filter or warehouses list changes
  useEffect(() => {
    fetchProducts();
  }, [selectedWarehouseFilter, warehouses]);

  // Refetch stock view rows when selection changes
  useEffect(() => {
    fetchStockRows();
  }, [selectedWarehouseFilter, warehouses, products]);

  // Prefetch stock for returns/transfer source warehouse
  useEffect(() => {
    if (activeTab === 'returns' && returnsData.warehouseId) {
      fetchWarehouseStock(String(returnsData.warehouseId));
    }
  }, [activeTab, returnsData.warehouseId]);

  useEffect(() => {
    if (activeTab === 'transfer' && transferData.from) {
      fetchWarehouseStock(String(transferData.from));
    }
  }, [activeTab, transferData.from]);

  // --- Warehouse Handlers ---
  const handleOpenWarehouseModal = (warehouse: any = null) => {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      setWarehouseFormData({ name: warehouse.name, location: warehouse.location });
    } else {
      setEditingWarehouse(null);
      setWarehouseFormData({ name: '', location: '' });
    }
    setIsModalOpen(true);
  };

  const handleWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseFormData.name) return;

    try {
      const url = editingWarehouse 
        ? `${API_BASE_PATH}/api.php?module=warehouses&action=update`
        : `${API_BASE_PATH}/api.php?module=warehouses&action=create`;
      
      const body = editingWarehouse
        ? JSON.stringify({ ...warehouseFormData, id: editingWarehouse.id })
        : JSON.stringify(warehouseFormData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh warehouses list
        await refreshWarehouses();
        setIsModalOpen(false);
        Swal.fire('تم الحفظ', 'تم حفظ بيانات المستودع بنجاح', 'success');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'فشل الحفظ',
          text: result.message || 'حدث خطأ أثناء حفظ المستودع',
          confirmButtonText: 'حسناً'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ في الاتصال',
        text: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
        confirmButtonText: 'حسناً'
      });
    }
  };

  const deleteWarehouse = async (id: number) => {
    const warehouse = warehouses.find(w => w.id === id);
    if (!warehouse) return;

    if (warehouse.stockCount > 0) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف المستودع "${warehouse.name}" لأنه يحتوي على مخزون. يرجى تصفية أو نقل المخزون أولا.`,
        confirmButtonText: 'موافق',
      });
      return;
    }

    Swal.fire({
      title: 'تأكيد الحذف',
      text: `هل أنت متأكد من حذف المستودع "${warehouse.name}"؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفه',
      cancelButtonText: 'إلغاء'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          
          const deleteResult = await response.json();
          
          if (deleteResult.success) {
            // Refresh warehouses list
            await refreshWarehouses();
            Swal.fire('تم الحذف!', `تم حذف المستودع "${warehouse.name}" بنجاح.`, 'success');
          } else {
            Swal.fire({
              icon: 'error',
              title: 'فشل الحذف',
              text: deleteResult.message || 'حدث خطأ أثناء حذف المستودع',
              confirmButtonText: 'حسناً'
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'خطأ في الاتصال',
            text: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
            confirmButtonText: 'حسناً'
          });
        }
      }
    });
  };

  const handleViewStockInWarehouse = (warehouseName: string) => {
    setSelectedWarehouseFilter(warehouseName);
    setActiveTab('stock');
  };

  // --- Product Handlers ---
  const handleOpenProductModal = (product: any = null) => {
    if (product) {
      // Edit Mode
      setEditingProduct(product);
      setProductFormData({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        color: product.color,
        size: product.size,
        cost: product.cost,
        price: product.price,
        quantity: product.stock, 
        reorderLevel: product.reorderLevel,
        warehouseId: '' // No need to change warehouse in edit
      });
    } else {
      // Add Mode
      setEditingProduct(null);
      setProductFormData({
        id: null,
        name: '',
        barcode: '',
        color: '',
        size: '',
        cost: 0,
        price: 0,
        quantity: 0,
        reorderLevel: 5,
        warehouseId: warehouses.length > 0 ? warehouses[0].id : '' // Default to first warehouse
      });
    }
    setIsProductEditModalOpen(true);
  };

  const generateRandomBarcode = () => {
    const randomCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setProductFormData(prev => ({ ...prev, barcode: randomCode }));
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.name) return;

    try {
      const url = editingProduct 
        ? `${API_BASE_PATH}/api.php?module=products&action=update`
        : `${API_BASE_PATH}/api.php?module=products&action=create`;
      
      const body = editingProduct
        ? JSON.stringify({ ...productFormData, id: editingProduct.id })
        : JSON.stringify(productFormData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh products list
        await fetchProducts();
        setIsProductEditModalOpen(false);
        Swal.fire('تم الحفظ', 'تم حفظ بيانات المنتج بنجاح', 'success');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'فشل الحفظ',
          text: result.message || 'حدث خطأ أثناء حفظ المنتج',
          confirmButtonText: 'حسناً'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ في الاتصال',
        text: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
        confirmButtonText: 'حسناً'
      });
    }
  };

  const handleDeleteProduct = (product: any) => {
    if (product.stock > 0) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف المنتج "${product.name}" لأن الكمية الحالية (${product.stock}) أكبر من صفر.`,
      });
      return;
    }
    Swal.fire({
      title: 'تأكيد الحذف',
      text: `هل أنت متأكد من حذف المنتج "${product.name} - ${product.color} - ${product.size}" نهائياً؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذفه',
      cancelButtonText: 'إلغاء'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=products&action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: product.id })
          });
          
          const deleteResult = await response.json();
          
          if (deleteResult.success) {
            // Refresh products list
            await fetchProducts();
            Swal.fire('تم الحذف!', `تم حذف المنتج "${product.name}" بنجاح.`, 'success');
          } else {
            Swal.fire({
              icon: 'error',
              title: 'فشل الحذف',
              text: deleteResult.message || 'حدث خطأ أثناء حذف المنتج',
              confirmButtonText: 'حسناً'
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'خطأ في الاتصال',
            text: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
            confirmButtonText: 'حسناً'
          });
        }
      }
    });
  };

  const handleViewProductHistory = (product: any) => {
    setSelectedProductHistory(product);
    setMovements([]);
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=product_movements&action=getByProduct&product_id=${product.id}`);
        const j = await resp.json();
        if (j.success) {
          const mapped = (j.data || []).map((r:any) => ({
            id: r.id,
            date: r.created_at || r.date || '',
            type: r.movement_type,
            details: r.notes || r.reference_type || '',
            qty: Number(r.quantity_change || 0),
            balance: Number(r.new_quantity || 0)
          }));
          setMovements(mapped);
        }
      } catch (e) { console.error('Failed to fetch product movements', e); }
    })();
    setIsProductHistoryModalOpen(true);
  };

  // --- Receiving & Returns & Transfer Logic ---
  const handleReceivingItemChange = (id: number, field: string, value: any) => {
    const newItems = receivingData.items.map(item => {
      if (item.id === id) {
        let updatedItem = { ...item, [field]: value };
        if (field === 'itemType') {
          // Reset fields based on item type
          if (value.endsWith('_new')) {
            updatedItem.isNew = true;
            updatedItem.productId = '';
            updatedItem.barcode = '';
            updatedItem.name = '';
            updatedItem.color = '';
            updatedItem.size = '';
            updatedItem.costPrice = 0;
            updatedItem.sellingPrice = 0;
            updatedItem.qty = 1;
            // Auto-generate barcode for new
            updatedItem.barcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          } else {
            updatedItem.isNew = false;
            updatedItem.name = '';
            updatedItem.costPrice = 0;
            updatedItem.sellingPrice = 0;
            updatedItem.color = '';
            updatedItem.size = '';
            updatedItem.qty = 1;
            updatedItem.barcode = '';
            updatedItem.productId = '';
          }
        }
        if (field === 'isNew') {
          if (value === true) {
            updatedItem.productId = '';
            updatedItem.barcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          } else {
            updatedItem.name = '';
            updatedItem.costPrice = 0;
            updatedItem.sellingPrice = 0;
            updatedItem.barcode = '';
          }
        }
        return updatedItem;
      }
      return item;
    });
    setReceivingData({ ...receivingData, items: newItems });
  };

  const addReceivingItem = () => {
    setReceivingData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), itemType: defaultReceivingItemType, isNew: true, name: '', color: '', size: '', costPrice: 0, sellingPrice: 0, qty: 1, barcode: '', productId: '' }]
    }));
  };

  const removeReceivingItem = (id: number) => {
    setReceivingData(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
  };

  const handleSelectExistingProduct = (itemId: number, productId: string) => {
    const item = receivingData.items.find(it => it.id === itemId);
    const type = String(item?.itemType || '').trim();
    const pid = parseInt(productId);

    let resolved: any = null;
    if (type === 'fabric_existing') {
      const f = fabrics.find(ff => Number(ff.id) === pid);
      if (f) {
        resolved = {
          productId,
          name: f.name,
          costPrice: Number(f.cost_price ?? f.costPrice ?? 0),
          sellingPrice: 0,
          color: f.color || '',
          size: f.size || '',
          barcode: f.code || f.barcode || ''
        };
      }
    } else if (type === 'accessory_existing') {
      const a = accessories.find(aa => Number(aa.id) === pid);
      if (a) {
        resolved = {
          productId,
          name: a.name,
          costPrice: Number(a.cost_price ?? a.costPrice ?? 0),
          sellingPrice: 0,
          color: a.color || '',
          size: a.size || '',
          barcode: a.code || a.barcode || ''
        };
      }
    } else {
      const p = products.find(pp => Number(pp.id) === pid);
      if (p) {
        resolved = {
          productId,
          name: p.name,
          costPrice: Number(p.cost ?? 0),
          sellingPrice: Number(p.price ?? 0),
          color: p.color || '',
          size: p.size || '',
          barcode: p.barcode || ''
        };
      }
    }

    if (!resolved) return;
    const newItems = receivingData.items.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          ...resolved,
          isNew: false,
        };
      }
      return it;
    });
    setReceivingData({ ...receivingData, items: newItems });
  };

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=receivings&action=create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(receivingData)
        });
        const result = await readJsonSafely(response);
        if (result.success) {
          // If purchase_id returned, fetch the transaction to show printable invoice
          if (result.purchase_id) {
            try {
              const txRes = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getById&id=${result.purchase_id}`);
              const txJson = await txRes.json();
              if (txJson.success && txJson.data) {
                // normalize invoice object for printing (accept multiple field name variants)
                const tx = txJson.data;
                let itemsRaw: any[] = [];
                try { itemsRaw = JSON.parse(tx.details || '[]'); } catch(e) { itemsRaw = []; }
                const items = (itemsRaw || []).map((it:any) => {
                  const qty = Number(it.qty ?? it.quantity ?? it.qtyOrdered ?? 0);
                  const costPrice = Number(it.costPrice ?? it.cost ?? it.cost_price ?? it.unitPrice ?? it.purchasePrice ?? it.price ?? 0);
                  const price = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.sale_price ?? costPrice);
                  return { ...it, qty, costPrice, price };
                });
                setReceivedInvoice({
                  id: tx.id,
                  number: tx.reference_id || `INV-${tx.id}`,
                  date: tx.transaction_date || tx.date,
                  items: items,
                  total: Number(tx.amount || 0),
                  supplierName: currentSupplier?.name || '',
                  supplierPhone: currentSupplier?.phone || '',
                  supplierAddress: currentSupplier?.address || '',
                  type: tx.type || 'purchase',
                  userName: tx.created_by || '-'
                });
                setIsReceivedInvoiceModalOpen(true);
              }
            } catch (e) { console.error('Failed to fetch created transaction', e); }
          }
          // Refresh relevant lists
          await fetchProducts();
          invalidateWarehouseStock(String(receivingData.warehouseId || ''));
          invalidateWarehouseFabrics(String(receivingData.warehouseId || ''));
          invalidateWarehouseAccessories(String(receivingData.warehouseId || ''));
          try {
            const r1 = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=getAll`);
            const jr1 = await r1.json(); if (jr1.success) setSuppliers(jr1.data || []);
          } catch(e) { console.error('Failed refresh suppliers', e); }
          try {
            await refreshWarehouses();
          } catch(e) { console.error('Failed refresh warehouses', e); }

          setReceivingData({ supplierId: '', warehouseId: '', items: [{ id: Date.now(), itemType: defaultReceivingItemType, isNew: true, name: '', color: '', size: '', costPrice: 0, sellingPrice: 0, qty: 1, barcode: '', productId: '' }], paidAmount: 0, treasuryId: '' });
          Swal.fire('تم بنجاح', 'تم استلام البضاعة وتحديث الأرصدة.', 'success');
        } else {
          Swal.fire('فشل', result.message || 'فشل معالجة الاستلام', 'error');
        }
      } catch (err) {
        console.error('Receive error', err);
        Swal.fire('خطأ في الاتصال', (err as any)?.message || 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.', 'error');
      }
    })();
  };

  // Modal state for recently received invoice
  const [receivedInvoice, setReceivedInvoice] = useState<any>(null);
  const [isReceivedInvoiceModalOpen, setIsReceivedInvoiceModalOpen] = useState(false);
  const [showInvoiceItems, setShowInvoiceItems] = useState(true);

  const handlePrintReceivedInvoice = (printItems: boolean = true) => {
    if (!receivedInvoice) return;
    const items = receivedInvoice.items || [];
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>فاتورة شراء</title>
    <style>@media print{@page{size:A4;margin:18mm}} body{font-family:Arial,Helvetica,sans-serif;color:#111}</style>
    </head><body>
    <div style="text-align:center;margin-bottom:8px">
      <h2 style="margin:0">اسم الشركة التجارية</h2>
      <div style="font-size:12px">العنوان - الهاتف</div>
    </div>
    <h3>فاتورة شراء رقم ${receivedInvoice.number || receivedInvoice.id}</h3>
    <div>التاريخ: ${receivedInvoice.date}</div>
    <div>المورد: ${receivedInvoice.supplierName || ''}</div>`;
    if (printItems) {
      html += `<table style="width:100%;border-collapse:collapse;margin-top:10px" border="1">
      <thead><tr style="background:#f3f4f6"><th>م</th><th>الصنف</th><th>اللون</th><th>المقاس</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
      <tbody>${items.map((it:any,i:number)=>`<tr><td style="text-align:center">${i+1}</td><td>${it.name||''}</td><td style="text-align:center">${it.color||''}</td><td style="text-align:center">${it.size||''}</td><td style="text-align:center">${it.qty||''}</td><td style="text-align:right">${Number(it.costPrice||it.price||0).toLocaleString()}</td><td style="text-align:right">${Number((it.qty||0)*(it.costPrice||it.price||0)).toLocaleString()}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="6" style="text-align:left;font-weight:800">الإجمالي</td><td style="text-align:right;font-weight:800">${Number(receivedInvoice.total||receivedInvoice.amount||0).toLocaleString()}</td></tr></tfoot>
      </table>`;
    } else {
      html += `<div style="margin-top:20px;font-size:18px;font-weight:800;text-align:right">الإجمالي: ${Number(receivedInvoice.total||receivedInvoice.amount||0).toLocaleString()} ${currencySymbol}</div>`;
    }
    html += `<div style="margin-top:30px;display:flex;justify-content:space-between;font-size:12px"><div>توقيع المستلم: __________</div><div>توقيع المورد: __________</div></div>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleReturnItemChange = (id: number, field: string, value: any) => {
    const newItems = returnsData.items.map(item => {
      if (item.id === id) return { ...item, [field]: value };
      return item;
    });
    setReturnsData({ ...returnsData, items: newItems });
  };

  const addReturnItem = () => {
    setReturnsData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), productId: '', qty: 1, costPrice: 0, name: '' }]
    }));
  };

  const removeReturnItem = (id: number) => {
    setReturnsData(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
  };

  const handleSelectProductForReturn = (itemId: number, productId: string) => {
    const pid = parseInt(productId);
    const current = returnsData.items.find(it => it.id === itemId);
    const t = String((current as any)?.returnType || '').trim();
    let resolved: any = null;

    if (t === 'fabric') {
      const row = getWarehouseFabrics(String(returnsData.warehouseId || '')).find((r: any) => Number(r.id) === pid || Number(r.fabric_id) === pid);
      if (row) {
        resolved = {
          id: row.id ?? row.fabric_id,
          name: row.name,
          color: row.color,
          size: row.size,
          cost: Number(row.cost_price ?? row.costPrice ?? 0),
          barcode: row.code || row.barcode || ''
        };
      }
    } else if (t === 'accessory') {
      const row = getWarehouseAccessories(String(returnsData.warehouseId || '')).find((r: any) => Number(r.id) === pid || Number(r.accessory_id) === pid);
      if (row) {
        resolved = {
          id: row.id ?? row.accessory_id,
          name: row.name,
          color: row.color,
          size: row.size,
          cost: Number(row.cost_price ?? row.costPrice ?? 0),
          barcode: row.code || row.barcode || ''
        };
      }
    } else {
      const product = products.find(p => Number(p.id) === pid);
      const stockRow = getWarehouseStock(String(returnsData.warehouseId || '')).find((r: any) => Number(r.product_id) === pid);
      resolved = product || (stockRow ? {
        id: stockRow.product_id,
        name: stockRow.name,
        color: stockRow.color,
        size: stockRow.size,
        cost: Number(stockRow.cost || 0),
      } : null);
    }
    if (resolved) {
      const newItems = returnsData.items.map(item => {
        if (item.id === itemId) {
          const qty = item.qty || 1;
          return {
            ...item,
            productId,
            name: `${resolved.name} (${resolved.color || '-'}-${resolved.size || '-'})`,
            costPrice: Number((resolved as any).cost || 0),
            total: Number((resolved as any).cost || 0) * qty
          };
        }
        return item;
      });
      setReturnsData({ ...returnsData, items: newItems });
    }
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=returns&action=create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(returnsData)
        });
        const result = await readJsonSafely(response);
        if (result.success) {
          // If return_id returned, fetch the transaction to show printable invoice
          if (result.return_id) {
            try {
              const txRes = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getById&id=${result.return_id}`);
              const txJson = await txRes.json();
              if (txJson.success && txJson.data) {
                const tx = txJson.data;
                let itemsRaw: any[] = [];
                try { itemsRaw = JSON.parse(tx.details || '[]'); } catch(e) { itemsRaw = []; }
                const items = (itemsRaw || []).map((it:any) => {
                  const qty = Number(it.qty ?? it.quantity ?? it.qtyOrdered ?? it.quantity_returned ?? 0);
                  const costPrice = Number(it.costPrice ?? it.cost ?? it.cost_price ?? it.unitPrice ?? it.purchasePrice ?? it.price ?? 0);
                  const price = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.sale_price ?? costPrice);
                  return { ...it, qty, costPrice, price };
                });
                setReceivedInvoice({
                  id: tx.id,
                  number: tx.reference_id || `INV-${tx.id}`,
                  date: tx.transaction_date || tx.date,
                  items: items,
                  total: Number(tx.amount || 0),
                  supplierName: currentSupplierForReturn?.name || '',
                  supplierPhone: currentSupplierForReturn?.phone || '',
                  supplierAddress: currentSupplierForReturn?.address || '',
                  type: tx.type || 'return_out',
                  userName: tx.created_by || '-'
                });
                setIsReceivedInvoiceModalOpen(true);
              }
            } catch (e) { console.error('Failed to fetch created return transaction', e); }
          }
          // Refresh relevant lists
          await fetchProducts();
          invalidateWarehouseStock(String(returnsData.warehouseId || ''));
          invalidateWarehouseFabrics(String(returnsData.warehouseId || ''));
          invalidateWarehouseAccessories(String(returnsData.warehouseId || ''));
          try {
            const r1 = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=getAll`);
            const jr1 = await r1.json(); if (jr1.success) setSuppliers(jr1.data || []);
          } catch(e) { console.error('Failed refresh suppliers', e); }
          try {
            await refreshWarehouses();
          } catch(e) { console.error('Failed refresh warehouses', e); }

          setReturnsData({ supplierId: '', warehouseId: '', items: [{ id: Date.now(), productId: '', qty: 1, costPrice: 0, name: '' }], receivedAmount: 0, treasuryId: '' });
          Swal.fire('تم بنجاح', 'تم تسجيل المرتجع وتحديث الأرصدة.', 'success');
        } else {
          Swal.fire('فشل', result.message || 'فشل معالجة المرتجع', 'error');
        }
      } catch (err) {
        console.error('Return error', err);
        Swal.fire('خطأ في الاتصال', (err as any)?.message || 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.', 'error');
      }
    })();
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=transfers&action=create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(transferData)
        });
        const result = await readJsonSafely(response);
        if (result.success) {
          // fetch created transaction for printing
          if (result.transfer_id) {
            try {
              const txRes = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getById&id=${result.transfer_id}`);
              const txJson = await txRes.json();
              if (txJson.success && txJson.data) {
                const tx = txJson.data;
                let itemsRaw: any[] = [];
                try { itemsRaw = JSON.parse(tx.details || '[]'); } catch(e) { itemsRaw = []; }
                const itemsFromTx = (itemsRaw || []).map((it:any) => {
                  const qty = Number(it.qty ?? it.quantity ?? it.qtyOrdered ?? 0);
                  const costPrice = Number(it.costPrice ?? it.cost ?? it.cost_price ?? it.unitPrice ?? it.purchasePrice ?? it.price ?? 0);
                  const price = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.sale_price ?? costPrice);
                  return { ...it, qty, costPrice, price };
                });
                // Normalize transferData.items if present
                const itemsInput = (transferData.items || []).map((it:any) => {
                  const qty = Number(it.qty ?? it.quantity ?? it.qtyOrdered ?? 0);
                  const costPrice = Number(it.costPrice ?? it.cost ?? it.cost_price ?? it.unitPrice ?? it.purchasePrice ?? it.price ?? 0);
                  const price = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.sale_price ?? costPrice);
                  return { ...it, qty, costPrice, price };
                });
                const finalItems = (itemsInput && itemsInput.length) ? itemsInput : itemsFromTx;
                const fromName = (warehouses.find(w => String(w.id) === transferData.from) || { name: transferData.from }).name;
                const toName = (warehouses.find(w => String(w.id) === transferData.to) || { name: transferData.to }).name;
                setReceivedInvoice({
                  id: tx.id,
                  number: tx.reference_id || `INV-${tx.id}`,
                  date: tx.transaction_date || tx.date,
                  items: finalItems,
                  total: Number(tx.amount || 0),
                  supplierName: `من: ${fromName} → إلى: ${toName}`,
                  supplierPhone: '',
                  supplierAddress: '',
                  type: 'transfer',
                  userName: tx.created_by || '-'
                });
                setIsReceivedInvoiceModalOpen(true);
              }
            } catch (e) { console.error('Failed to fetch created transfer transaction', e); }
          }

          // Refresh data
          await fetchProducts();
          invalidateWarehouseStock(String(transferData.from || ''));
          invalidateWarehouseStock(String(transferData.to || ''));
          invalidateWarehouseFabrics(String(transferData.from || ''));
          invalidateWarehouseAccessories(String(transferData.from || ''));
          invalidateWarehouseFabrics(String(transferData.to || ''));
          invalidateWarehouseAccessories(String(transferData.to || ''));
          try {
            await refreshWarehouses();
          } catch(e) { console.error('Failed refresh warehouses', e); }

          setTransferSuccess(true);
          setTimeout(() => setTransferSuccess(false), 3000);
          setTransferData({ from: '', to: '', items: [{ productId: '', qty: 1 }] });
          Swal.fire('تم بنجاح', 'تم تنفيذ التحويل وتحديث الأرصدة.', 'success');
        } else {
          Swal.fire('فشل', result.message || 'فشل تنفيذ التحويل', 'error');
        }
      } catch (err) {
        console.error('Transfer error', err);
        Swal.fire('خطأ في الاتصال', (err as any)?.message || 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.', 'error');
      }
    })();
  };

  const handleTransferItemChange = (index: number, field: string, value: any) => {
    const newItems = [...transferData.items];
    let next = { ...newItems[index], [field]: value };
    if (field === 'productId') {
      const pid = parseInt(String(value || '0'));
      const t = String((next as any)?.transferType || '').trim();
      let resolved: any = null;
      if (t === 'fabric') {
        const rows = getWarehouseFabrics(String(transferData.from || ''));
        resolved = rows.find((r: any) => Number(r.id) === pid || Number(r.fabric_id) === pid) || null;
      } else if (t === 'accessory') {
        const rows = getWarehouseAccessories(String(transferData.from || ''));
        resolved = rows.find((r: any) => Number(r.id) === pid || Number(r.accessory_id) === pid) || null;
      } else {
        const fromRows = getWarehouseStock(String(transferData.from || ''));
        const row = fromRows.find((r: any) => Number(r.product_id) === pid);
        const prod = products.find(p => Number(p.id) === pid);
        resolved = row || prod || null;
      }
      if (resolved) {
        next = {
          ...next,
          name: resolved.name,
          barcode: (resolved as any).barcode || (resolved as any).code || '',
          color: (resolved as any).color,
          size: (resolved as any).size,
          costPrice: Number((resolved as any).cost || (resolved as any).cost_price || (resolved as any).costPrice || 0),
          sellingPrice: Number((resolved as any).price || (resolved as any).sellingPrice || 0),
        };
      }
    }
    newItems[index] = next;
    setTransferData({ ...transferData, items: newItems });
  };

  const addTransferItem = () => {
    setTransferData(prev => ({ ...prev, items: [...prev.items, { productId: '', qty: 1 }] }));
  };

  const removeTransferItem = (index: number) => {
    setTransferData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  // --- Inventory Audit Handlers ---
  const fetchAudits = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditStatusFilter && auditStatusFilter !== 'all') params.append('status', auditStatusFilter);
      if (auditWarehouseFilter) params.append('warehouse_id', auditWarehouseFilter);
      const qs = params.toString();
      const res = await fetch(`${API_BASE_PATH}/api.php?module=inventory&action=getAudits${qs ? `&${qs}` : ''}`);
      const jr = await res.json();
      if (jr.success) {
        setAudits(jr.data || []);
      } else {
        console.error('Failed to fetch audits:', jr.message);
      }
    } catch (err) {
      console.error('Fetch audits error:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchAuditDetails = async (auditId: number) => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=inventory&action=getAudit&id=${auditId}`);
      const jr = await res.json();
      if (jr.success) {
        setSelectedAudit(jr.data?.audit || null);
        setAuditItems(jr.data?.items || []);
      } else {
        Swal.fire('تعذر التحميل', jr.message || 'فشل تحميل الجرد.', 'error');
      }
    } catch (err) {
      console.error('Fetch audit details error:', err);
    }
  };

  const handleCreateAudit = async () => {
    if (!auditWarehouseId) {
      Swal.fire('بيانات ناقصة', 'يرجى اختيار المستودع.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=inventory&action=createAudit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: Number(auditWarehouseId), notes: auditNotes })
      });
      const jr = await res.json();
      if (jr.success && jr.data?.id) {
        setAuditNotes('');
        await fetchAudits();
        await fetchAuditDetails(jr.data.id);
      } else {
        Swal.fire('فشل الإنشاء', jr.message || 'تعذر إنشاء الجرد.', 'error');
      }
    } catch (err) {
      console.error('Create audit error:', err);
    }
  };

  const updateAuditItem = (index: number, changes: any) => {
    setAuditItems(prev => prev.map((it, i) => i === index ? { ...it, ...changes } : it));
  };

  const addAuditItem = () => {
    setAuditItems(prev => ([...prev, { product_id: '', counted_qty: 0, notes: '' }]));
  };

  const removeAuditItem = (index: number) => {
    setAuditItems(prev => prev.filter((_, i) => i !== index));
  };

  const saveAuditItems = async () => {
    if (!selectedAudit) return;
    try {
      const payloadItems = auditItems
        .filter(it => it.product_id)
        .map(it => ({
          product_id: Number(it.product_id),
          counted_qty: Number(it.counted_qty || 0),
          notes: it.notes || ''
        }));

      const res = await fetch(`${API_BASE_PATH}/api.php?module=inventory&action=saveItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: Number(selectedAudit.id), items: payloadItems })
      });
      const jr = await res.json();
      if (jr.success) {
        setAuditItems(jr.data?.items || []);
        Swal.fire('تم الحفظ', 'تم حفظ بنود الجرد.', 'success');
      } else {
        Swal.fire('فشل الحفظ', jr.message || 'تعذر حفظ بنود الجرد.', 'error');
      }
    } catch (err) {
      console.error('Save audit items error:', err);
    }
  };

  const submitAudit = async () => {
    if (!selectedAudit) return;
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=inventory&action=submitAudit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(selectedAudit.id) })
      });
      const jr = await res.json();
      if (jr.success) {
        await fetchAuditDetails(selectedAudit.id);
        await fetchAudits();
        Swal.fire('تم الإرسال', 'تم إرسال الجرد للمراجعة.', 'success');
      } else {
        Swal.fire('فشل الإرسال', jr.message || 'تعذر إرسال الجرد.', 'error');
      }
    } catch (err) {
      console.error('Submit audit error:', err);
    }
  };

  const approveAudit = async () => {
    if (!selectedAudit) return;
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=inventory&action=approveAudit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(selectedAudit.id) })
      });
      const jr = await res.json();
      if (jr.success) {
        await fetchAuditDetails(selectedAudit.id);
        await fetchAudits();
        await fetchProducts();
        Swal.fire('تم الاعتماد', 'تم اعتماد الجرد وتحديث المخزون.', 'success');
      } else {
        Swal.fire('فشل الاعتماد', jr.message || 'تعذر اعتماد الجرد.', 'error');
      }
    } catch (err) {
      console.error('Approve audit error:', err);
    }
  };

  const rejectAudit = async () => {
    if (!selectedAudit) return;
    const result = await Swal.fire({
      title: 'رفض الجرد',
      input: 'text',
      inputLabel: 'سبب الرفض',
      inputPlaceholder: 'أدخل السبب',
      showCancelButton: true,
      confirmButtonText: 'رفض',
      cancelButtonText: 'إلغاء'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=inventory&action=rejectAudit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(selectedAudit.id), reason: result.value || '' })
      });
      const jr = await res.json();
      if (jr.success) {
        await fetchAuditDetails(selectedAudit.id);
        await fetchAudits();
        Swal.fire('تم الرفض', 'تم رفض الجرد.', 'success');
      } else {
        Swal.fire('فشل الرفض', jr.message || 'تعذر رفض الجرد.', 'error');
      }
    } catch (err) {
      console.error('Reject audit error:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAudits();
    }
  }, [activeTab, auditStatusFilter, auditWarehouseFilter]);


  return (
    <div className="space-y-6 transition-colors duration-300">
      
      {/* Top Navigation */}

      {/* Received Invoice Modal */}
      {isReceivedInvoiceModalOpen && receivedInvoice && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60">
          <div className="w-full max-w-2xl rounded-2xl p-6 card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black">فاتورة الشراء #{receivedInvoice.id}</h3>
              <div>
                <button onClick={() => { handlePrintReceivedInvoice(showInvoiceItems); }} className="mr-2 px-4 py-2 bg-blue-600 text-white rounded-xl">طباعة</button>
                <button onClick={() => setShowInvoiceItems(prev => !prev)} className="mr-2 px-4 py-2 bg-amber-500 text-white rounded-xl">{showInvoiceItems ? 'عرض الإجمالي فقط' : 'عرض الأصناف'}</button>
                <button onClick={() => setIsReceivedInvoiceModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-xl">إغلاق</button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left"><th>الصنف</th><th>اللون</th><th>المقاس</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
                </thead>
                <tbody>
                  {(() => {
                    let items: any[] = [];
                    // prefer normalized items array if present
                    if (receivedInvoice.items && Array.isArray(receivedInvoice.items)) {
                      items = receivedInvoice.items;
                    } else {
                      try { items = JSON.parse(receivedInvoice.details || '[]'); } catch(e) { items = []; }
                    }
                    return items.map((it:any, i:number) => {
                      const qty = Number(it.qty || it.quantity || 0);
                      const unit = Number(it.costPrice ?? it.cost ?? it.price ?? 0);
                      const lineTotal = qty * unit;
                      return (
                        <tr key={i}>
                          <td>{it.name || ''}</td>
                          <td>{it.color || ''}</td>
                          <td>{it.size || ''}</td>
                          <td>{qty}</td>
                          <td>{unit.toLocaleString()}</td>
                          <td>{lineTotal.toLocaleString()}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              <div className="mt-4 font-bold">الإجمالي: {(receivedInvoice.total || receivedInvoice.amount || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">المخزون والمستودعات</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">إدارة حركة الأصناف وتوزيع الكميات</p>
        </div>
        <div className="flex p-1.5 rounded-2xl border border-card shadow-sm overflow-x-auto max-w-full card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <button onClick={() => setActiveTab('stock')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeTab === 'stock' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Box size={16}/> حالة المخزون</button>
          <button onClick={() => setActiveTab('warehouses')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeTab === 'warehouses' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><MapPin size={16}/> المستودعات</button>
          <button onClick={() => setActiveTab('transfer')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeTab === 'transfer' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ArrowLeftRight size={16}/> تحويل</button>
          <button onClick={() => setActiveTab('receiving')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeTab === 'receiving' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ArrowDownLeft size={16}/> استلام</button>
          <button onClick={() => setActiveTab('returns')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeTab === 'returns' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ArrowUpRight size={16}/> مرتجع</button>
          <button onClick={() => setActiveTab('audit')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeTab === 'audit' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><CheckCircle2 size={16}/> جرد</button>
        </div>
      </div>

      {/* --- Stock Tab (Products Table) --- */}
      {activeTab === 'stock' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
           <div className="lg:col-span-4 rounded-3xl border border-card overflow-hidden shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
             <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-2">
                   <Box className="text-blue-600"/>
                   <span className="font-black text-sm text-slate-800 dark:text-slate-100">سجل الأصناف</span>
               </div>
               <div className="flex items-center gap-2 w-full md:w-auto">
                   <select 
                    value={selectedWarehouseFilter}
                    onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                    className="text-xs rounded-xl px-3 py-2 outline-none card"
                    style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                   >
                     <option value="كل المستودعات">كل المستودعات</option>
                     {warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                   </select>
                   <button 
                    onClick={() => handleOpenProductModal()}
                    className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                   >
                    <Plus size={16} /> إضافة منتج
                   </button>
               </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-right text-sm">
                  <thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                    <tr>
                      <th className="px-6 py-4 font-bold">اسم المنتج</th>
                      <th className="px-6 py-4 font-bold">الباركود</th>
                      <th className="px-6 py-4 font-bold">اللون</th>
                      <th className="px-6 py-4 font-bold">المقاس</th>
                      <th className="px-6 py-4 font-bold">الكمية</th>
                      <th className="px-6 py-4 font-bold">الشراء</th>
                      <th className="px-6 py-4 font-bold">البيع</th>
                      <th className="px-6 py-4 font-bold text-center">تحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {stockRows.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-10 text-muted">لا توجد منتجات مسجلة.</td></tr>
                    ) : stockRows.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-muted">{p.barcode || '-'}</td>
                        <td className="px-6 py-4 text-xs">{p.color || '-'}</td>
                        <td className="px-6 py-4 text-xs font-mono">{p.size || '-'}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-black ${p.stock <= p.reorderLevel ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {p.stock}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-xs">{p.cost} {currencySymbol}</td>
                        <td className="px-6 py-4 text-xs font-bold">
                          {p.price} {currencySymbol}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openStockBarcodes(p)} className="p-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" title="عرض باركودات الكمية"><QrCode size={14} /></button>
                            <button onClick={() => handleViewProductHistory(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="سجل الحركات"><Eye size={14} /></button>
                            <button onClick={() => handleOpenProductModal(p)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors" title="تعديل"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteProduct(p)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="حذف"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>

          {isStockBarcodeModalOpen && stockBarcodeProduct && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">باركودات الكمية</h3>
                  <button onClick={() => setIsStockBarcodeModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق"><X size={24} /></button>
                </div>
                <div className="p-6 text-right">
                  <div className="text-sm font-black text-slate-900 dark:text-white">{stockBarcodeProduct.name}</div>
                  <div className="mt-1 text-xs text-muted">اللون: {stockBarcodeProduct.color || '-'} — المقاس: {stockBarcodeProduct.size || '-'} — الكمية: {Number(stockBarcodeProduct.stock || 0)}</div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[55vh] overflow-auto">
                    {Array.from({ length: Math.max(0, Number(stockBarcodeProduct.stock || 0)) }).map((_, idx) => (
                      <div key={idx} className="p-3 rounded-2xl border border-card bg-slate-50 dark:bg-slate-900/30">
                        <div className="text-[11px] text-muted">#{idx + 1}</div>
                        <div className="text-xs font-mono text-slate-800 dark:text-slate-100">{stockBarcodeProduct.barcode || '-'}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-2">
                    <button onClick={printStockBarcodes} className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-black">طباعة</button>
                    <button onClick={() => setIsStockBarcodeModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-xl text-xs font-black">إغلاق</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Inventory Audit Tab --- */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 space-y-6">
              <div className="rounded-3xl border border-card p-6 shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="text-emerald-600" />
                  <h3 className="font-black text-sm">بدء جرد جديد</h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted">المستودع</label>
                    <select value={auditWarehouseId} onChange={e => setAuditWarehouseId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm">
                      <option value="">اختر المستودع</option>
                      {warehouses.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted">ملاحظات</label>
                    <textarea value={auditNotes} onChange={e => setAuditNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" rows={3} />
                  </div>
                  <button onClick={handleCreateAudit} className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-black">إنشاء الجرد</button>
                </div>
              </div>

              <div className="rounded-3xl border border-card p-6 shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-sm">سجلات الجرد</h3>
                  <button onClick={fetchAudits} className="text-xs text-blue-600">تحديث</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <select value={auditStatusFilter} onChange={e => setAuditStatusFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-lg px-2 py-2 text-xs">
                    <option value="all">كل الحالات</option>
                    <option value="draft">مسودة</option>
                    <option value="pending">قيد المراجعة</option>
                    <option value="approved">معتمد</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                  <select value={auditWarehouseFilter} onChange={e => setAuditWarehouseFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-lg px-2 py-2 text-xs">
                    <option value="">كل المستودعات</option>
                    {warehouses.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                  </select>
                </div>
                {auditLoading ? (
                  <div className="text-xs text-muted">جاري التحميل...</div>
                ) : audits.length === 0 ? (
                  <div className="text-xs text-muted">لا توجد سجلات جرد.</div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {audits.map(a => (
                      <button key={a.id} onClick={() => fetchAuditDetails(a.id)} className={`w-full text-right p-3 rounded-xl border ${selectedAudit?.id === a.id ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 dark:border-slate-700'}`}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-black">#{a.id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.status === 'pending' ? 'bg-amber-100 text-amber-700' : a.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                            {a.status === 'approved' ? 'معتمد' : a.status === 'pending' ? 'قيد المراجعة' : a.status === 'rejected' ? 'مرفوض' : 'مسودة'}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted mt-1">{a.warehouse_name || '-'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="xl:col-span-2 space-y-6">
              {!selectedAudit ? (
                <div className="rounded-3xl border border-dashed border-card p-10 text-center text-muted card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                  اختر جرداً من القائمة لعرض التفاصيل.
                </div>
              ) : (
                <div className="rounded-3xl border border-card p-6 shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-black text-sm">جرد #{selectedAudit.id}</h3>
                      <p className="text-xs text-muted">المستودع: {selectedAudit.warehouse_name || '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAudit.status === 'draft' && (
                        <>
                          <button onClick={saveAuditItems} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">حفظ البنود</button>
                          <button onClick={submitAudit} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold">إرسال للمراجعة</button>
                        </>
                      )}
                      {selectedAudit.status === 'pending' && (
                        <>
                          <button onClick={approveAudit} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">اعتماد</button>
                          <button onClick={rejectAudit} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold">رفض</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                        <tr>
                          <th className="px-3 py-2">الصنف</th>
                          <th className="px-3 py-2 text-center">الرصيد الدفتري</th>
                          <th className="px-3 py-2 text-center">الكمية الفعلية</th>
                          <th className="px-3 py-2 text-center">الفرق</th>
                          <th className="px-3 py-2">ملاحظات</th>
                          {selectedAudit.status === 'draft' && (<th className="px-3 py-2"></th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                        {auditItems.length === 0 ? (
                          <tr><td colSpan={selectedAudit.status === 'draft' ? 6 : 5} className="text-center py-8 text-muted">لا توجد بنود.</td></tr>
                        ) : auditItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              {selectedAudit.status === 'draft' ? (
                                <select value={item.product_id || ''} onChange={e => {
                                  const pid = e.target.value;
                                  const product = products.find(p => String(p.id) === String(pid));
                                  updateAuditItem(idx, { product_id: pid, product_name: product?.name || '' });
                                }} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg px-2 py-1 text-xs">
                                  <option value="">اختر الصنف</option>
                                  {products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                </select>
                              ) : (
                                <span className="text-xs font-bold">{item.product_name || item.name || '-'}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-mono">{Number(item.system_qty ?? 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-center">
                              {selectedAudit.status === 'draft' ? (
                                <input type="number" min="0" value={item.counted_qty ?? 0} onChange={e => updateAuditItem(idx, { counted_qty: e.target.value })} className="w-24 bg-slate-50 dark:bg-slate-900 border-none rounded-lg px-2 py-1 text-xs text-center" />
                              ) : (
                                <span className="text-xs font-mono">{Number(item.counted_qty ?? 0).toLocaleString()}</span>
                              )}
                            </td>
                            <td className={`px-3 py-2 text-center text-xs font-black ${Number(item.diff_qty || 0) === 0 ? 'text-emerald-600' : Number(item.diff_qty || 0) > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {Number(item.diff_qty || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              {selectedAudit.status === 'draft' ? (
                                <input type="text" value={item.notes || ''} onChange={e => updateAuditItem(idx, { notes: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg px-2 py-1 text-xs" />
                              ) : (
                                <span className="text-xs text-muted">{item.notes || '-'}</span>
                              )}
                            </td>
                            {selectedAudit.status === 'draft' && (
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => removeAuditItem(idx)} className="text-rose-500 text-xs">حذف</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedAudit.status === 'draft' && (
                    <div className="mt-4">
                      <button onClick={addAuditItem} className="text-sm font-bold text-blue-600">+ إضافة بند</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Add/Edit Product Modal (UPDATED) --- */}
      {isProductEditModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}</h3>
              <button onClick={() => setIsProductEditModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="p-8 space-y-4 text-right">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">اسم المنتج</label>
                    <input type="text" required value={productFormData.name} onChange={e => setProductFormData({...productFormData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 dark:text-white"/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">الباركود</label>
                    <div className="flex gap-2">
                        <input type="text" value={productFormData.barcode} onChange={e => setProductFormData({...productFormData, barcode: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm font-mono focus:ring-2 ring-blue-500/20 dark:text-white" placeholder="اتركه فارغاً للتوليد"/>
                        <button type="button" onClick={generateRandomBarcode} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-xl hover:bg-slate-300 transition-colors" title="توليد عشوائي"><RefreshCw size={18}/></button>
                    </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">اللون</label>
                    <input type="text" value={productFormData.color} onChange={e => setProductFormData({...productFormData, color: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 dark:text-white"/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">المقاس</label>
                    <input type="text" value={productFormData.size} onChange={e => setProductFormData({...productFormData, size: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 dark:text-white"/>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">سعر الشراء (التكلفة)</label>
                    <input type="number" required disabled={!!editingProduct} value={productFormData.cost} onChange={e => setProductFormData({...productFormData, cost: parseFloat(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 disabled:opacity-50 dark:text-white"/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">سعر البيع</label>
                    <input type="number" required value={productFormData.price} onChange={e => setProductFormData({...productFormData, price: parseFloat(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 dark:text-white"/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">الكمية الافتتاحية</label>
                    <input type="number" required disabled={!!editingProduct} value={productFormData.quantity} onChange={e => setProductFormData({...productFormData, quantity: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 disabled:opacity-50 dark:text-white"/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">حد إعادة الطلب</label>
                    <input type="number" required value={productFormData.reorderLevel} onChange={e => setProductFormData({...productFormData, reorderLevel: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 dark:text-white"/>
                  </div>
              </div>

              {/* NEW: Warehouse Selection for Initial Stock */}
              {!editingProduct && productFormData.quantity > 0 && (
                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border dark:border-slate-700 animate-in fade-in">
                      <label className="text-xs font-bold text-blue-600">تخزين الكمية الافتتاحية في:</label>
                      <select 
                        required
                        value={productFormData.warehouseId}
                        onChange={e => setProductFormData({...productFormData, warehouseId: e.target.value})}
                        className="w-full bg-white dark:bg-slate-800 border-none rounded-xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 dark:text-white"
                      >
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                  </div>
              )}

              <div className="pt-4 border-t dark:border-slate-700">
                  <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                    <Save size={18} /> {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Movement History Modal (NEW) --- */}
      {isProductHistoryModalOpen && selectedProductHistory && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700 h-[80vh] flex flex-col">
             <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><History className="text-blue-500" /> سجل حركات الصنف</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedProductHistory.name} ({selectedProductHistory.color || 'بدون لون'} - {selectedProductHistory.size || 'بدون مقاس'})</p>
              </div>
              <button onClick={() => setIsProductHistoryModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full text-right text-sm">
                    <thead className="text-slate-500 dark:text-slate-400 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 sticky top-0">
                        <tr>
                            <th className="px-4 py-2">التاريخ</th>
                            <th className="px-4 py-2">نوع الحركة</th>
                            <th className="px-4 py-2">البيان</th>
                            <th className="px-4 py-2 text-center">الكمية</th>
                            <th className="px-4 py-2 text-center">الرصيد</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                        {movements.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-400">لا توجد حركات مسجلة لهذا المنتج.</td></tr>
                        ) : movements.map(m => (
                            <tr key={m.id}>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{m.date}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                        m.type === 'purchase' || m.type === 'return_in' || m.type === 'initial_balance' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                    }`}>
                                        {m.type === 'purchase' ? 'استلام' : m.type === 'sale' ? 'بيع' : m.type === 'return_in' ? 'مرتجع عميل' : m.type === 'initial_balance' ? 'رصيد افتتاحي' : 'صرف/مرتجع'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs">{m.details}</td>
                                <td className="px-4 py-3 text-center font-bold dir-ltr">
                                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                                </td>
                                <td className="px-4 py-3 text-center font-black">{m.balance}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

      {/* --- Warehouses Tab (Existing) --- */}
      {activeTab === 'warehouses' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm">
            <div className="text-right">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">قائمة المستودعات</h3>
              <p className="text-xs text-slate-500 font-bold">إدارة مساحات التخزين والمواقع الجغرافية</p>
            </div>
            <button 
              onClick={() => handleOpenWarehouseModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              <Plus size={18} /> إضافة مستودع جديد
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {warehouses.map(w => (
              <div key={w.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-6">
                   <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600">
                      <MapPin size={24} />
                   </div>
                   <div className="flex gap-1">
                      <button onClick={() => deleteWarehouse(w.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all" title="حذف المستودع"><Trash2 size={16} /></button>
                      <button onClick={() => handleOpenWarehouseModal(w)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all" title="تعديل البيانات"><Edit size={16} /></button>
                      <button onClick={() => handleViewStockInWarehouse(w.name)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="عرض محتويات المخزن"><Eye size={16} /></button>
                   </div>
                </div>
                <div className="text-right space-y-2">
                  <h4 className="font-black text-slate-900 dark:text-white text-lg">{w.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 justify-end">
                    {w.location}
                  </p>
                </div>
                <div className="mt-6 pt-6 border-t dark:border-slate-700">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase mb-2">
                    <span>السعة المستخدمة</span>
                    <span>{w.capacity}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: w.capacity }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warehouse Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingWarehouse ? 'تعديل بيانات المستودع' : 'إضافة مستودع جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleWarehouseSubmit} className="p-8 space-y-6 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">اسم المستودع</label>
                <input 
                  type="text" 
                  required
                  value={warehouseFormData.name}
                  onChange={e => setWarehouseFormData({...warehouseFormData, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">الموقع الجغرافي</label>
                <input 
                  type="text" 
                  value={warehouseFormData.location}
                  onChange={e => setWarehouseFormData({...warehouseFormData, location: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} /> {editingWarehouse ? 'حفظ التعديلات' : 'إنشاء المستودع'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Transfer Tab (Existing Logic) --- */}
      {activeTab === 'transfer' && (
        <div className="max-w-3xl mx-auto animate-in slide-in-from-top duration-500">
          <div className="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm text-right relative overflow-hidden">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl text-indigo-600">
                <ArrowLeftRight size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">تحويل مخزون بين المستودعات</h3>
                <p className="text-sm text-slate-500">نقل الأصناف مع تحديث سجلات الجرد آلياً</p>
              </div>
            </div>
            {transferSuccess ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-12 rounded-3xl border border-emerald-100 dark:border-emerald-800/50 text-center animate-in zoom-in">
                <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4" />
                <h4 className="text-xl font-black text-emerald-700 dark:text-emerald-400 mb-2">تم التحويل بنجاح!</h4>
                <p className="text-sm text-emerald-600 opacity-80">تم تحديث كميات المخزون في المستودعين فوراً.</p>
              </div>
            ) : (
              <form onSubmit={handleTransferSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-2">من مستودع</label>
                    <select required value={transferData.from} onChange={e => setTransferData({ ...transferData, from: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 ring-indigo-500/20">
                      <option value="">اختر مصدر النقل...</option>
                      {warehouses.map(w => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-2">إلى مستودع</label>
                    <select required value={transferData.to} onChange={e => setTransferData({ ...transferData, to: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 ring-indigo-500/20">
                      <option value="">اختر الوجهة...</option>
                      {warehouses.filter(w => String(w.id) !== transferData.from).map(w => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 mr-2">الأصناف المحولة</label>
                  {transferData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <select required value={item.transferType || ''} onChange={e => handleTransferItemChange(index, 'transferType', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm mb-1">
                          <option value="">اختر النوع...</option>
                          {productSource !== 'suppliers' && <option value="fabric">قماش</option>}
                          {productSource !== 'suppliers' && <option value="accessory">اكسسوار</option>}
                          <option value="product">منتج</option>
                        </select>
                      </div>
                      <div className="col-span-4">
                        <select required value={item.productId} onChange={e => handleTransferItemChange(index, 'productId', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm">
                          <option value="">اختر الصنف...</option>
                          {(() => {
                            const t = String(item.transferType || '').trim();
                            if (t === 'fabric') {
                              const rows = getWarehouseFabrics(String(transferData.from || ''));
                              return rows.map((r: any) => (
                                <option key={r.id ?? r.fabric_id} value={r.id ?? r.fabric_id}>
                                  {r.name} ({r.color || '-'}-{r.size || '-'}) — {Number(r.quantity || 0)}
                                </option>
                              ));
                            }
                            if (t === 'accessory') {
                              const rows = getWarehouseAccessories(String(transferData.from || ''));
                              return rows.map((r: any) => (
                                <option key={r.id ?? r.accessory_id} value={r.id ?? r.accessory_id}>
                                  {r.name} ({r.color || '-'}-{r.size || '-'}) — {Number(r.quantity || 0)}
                                </option>
                              ));
                            }
                            if (t === 'product') {
                              const rows = getWarehouseStock(String(transferData.from || ''));
                              const filtered = rows.filter((r: any) => {
                                const cat = String(r.category || '').trim();
                                return !cat || cat === 'product';
                              });
                              return filtered.map((r: any) => (
                                <option key={r.product_id} value={r.product_id}>
                                  {r.name} ({r.color || '-'}-{r.size || '-'}) — {Number(r.quantity || 0)}
                                </option>
                              ));
                            }
                            return null;
                          })()}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="number" placeholder="الكمية" min="1" required value={item.qty} onChange={e => handleTransferItemChange(index, 'qty', (String(item.transferType || '').trim() === 'fabric') ? parseFloat(e.target.value) : parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" />
                      </div>
                      <div className="col-span-1">
                        {transferData.items.length > 1 && (
                          <button type="button" onClick={() => removeTransferItem(index)} className="text-rose-500 hover:text-rose-700"><MinusCircle size={16} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addTransferItem} className="text-sm font-bold text-indigo-600 flex items-center gap-2"><PlusCircle size={16} /> إضافة صنف آخر</button>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                  <ArrowLeftRight size={18} /> ترحيل التحويل المخزني
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- Receiving Tab (Existing Logic) --- */}
      {activeTab === 'receiving' && (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 max-w-5xl mx-auto shadow-sm animate-in zoom-in duration-300">
          <form onSubmit={handleReceiveSubmit}>
            <h3 className="text-xl font-black mb-6 text-slate-900 dark:text-white flex items-center gap-3"><FilePlus2 size={24} className="text-blue-500"/> إنشاء إذن استلام بضاعة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">المورد</label>
                <select required value={receivingData.supplierId} onChange={e => setReceivingData({...receivingData, supplierId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 ring-blue-500/20">
                  <option value="">اختر المورد...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">المستودع الهدف</label>
                <select required value={receivingData.warehouseId} onChange={e => setReceivingData({...receivingData, warehouseId: e.target.value})} disabled={userDefaults && userDefaults.default_warehouse_id && !userDefaults.can_change_warehouse} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 ring-blue-500/20">
                  <option value="">اختر المستودع...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-right text-sm min-w-[1000px]">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-2 py-3 font-bold w-40">نوع الصنف</th>
                    <th className="px-2 py-3 font-bold">اسم الصنف/باركود</th>
                    <th className="px-2 py-3 font-bold">اللون</th>
                    <th className="px-2 py-3 font-bold">سعر التكلفة</th>
                    <th className="px-2 py-3 font-bold">الكمية</th>
                    <th className="px-2 py-3 font-bold">الإجمالي</th>
                    <th className="px-2 py-3 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {receivingData.items.map((item) => (
                    <tr key={item.id} className="border-b dark:border-slate-700">
                      <td className="px-2 py-2">
                        <select value={item.itemType || 'fabric_new'} onChange={e => handleReceivingItemChange(item.id, 'itemType', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs">
                          {productSource !== 'suppliers' && <option value="fabric_new">قماش جديد</option>}
                          {productSource !== 'suppliers' && <option value="fabric_existing">قماش حالى</option>}
                          {productSource !== 'suppliers' && <option value="accessory_new">اكسسوار جديد</option>}
                          {productSource !== 'suppliers' && <option value="accessory_existing">اكسسوار حالى</option>}
                          {productSource !== 'factory' && <option value="product_new">منتج جديد</option>}
                          {productSource !== 'factory' && <option value="product_existing">منتج حالى</option>}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        {item.itemType && item.itemType.endsWith('_new') ? (
                          <>
                            <input type="text" placeholder="اسم الصنف الجديد" value={item.name} onChange={e => handleReceivingItemChange(item.id, 'name', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs mb-1" />
                            <input type="text" placeholder="باركود تلقائي" value={item.barcode} readOnly className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs font-mono" />
                          </>
                        ) : (
                          <select required value={item.productId} onChange={e => handleSelectExistingProduct(item.id, e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs">
                            <option value="">اختر صنف موجود...</option>
                            {(() => {
                              if (item.itemType === 'fabric_existing') {
                                return fabrics.map((f:any) => <option key={f.id} value={f.id}>{f.name} - {f.code || f.barcode || ''}</option>);
                              } else if (item.itemType === 'accessory_existing') {
                                return accessories.map((a:any) => <option key={a.id} value={a.id}>{a.name} - {a.code || a.barcode || ''}</option>);
                              } else if (item.itemType === 'product_existing') {
                                return products.filter(p => {
                                  const cat = String(p.category || '').trim();
                                  return !cat || cat === 'product';
                                }).map(p => <option key={p.id} value={p.id}>{p.name} - {p.barcode}</option>);
                              } else {
                                return products.map(p => <option key={p.id} value={p.id}>{p.name} - {p.barcode}</option>);
                              }
                            })()}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {item.itemType === 'product_new' ? (
                          <>
                            <input type="text" placeholder="اللون" value={item.color} onChange={e => handleReceivingItemChange(item.id, 'color', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs mb-1" />
                            <input type="text" placeholder="المقاس" value={item.size} onChange={e => handleReceivingItemChange(item.id, 'size', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs" />
                          </>
                        ) : (
                          <input type="text" placeholder="-" value={item.color} onChange={e => handleReceivingItemChange(item.id, 'color', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs" />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {item.itemType === 'product_new' ? (
                          <>
                            <input type="number" placeholder="سعر التكلفة" value={item.costPrice} onChange={e => handleReceivingItemChange(item.id, 'costPrice', parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs mb-1" />
                            <input type="number" placeholder="سعر البيع" value={item.sellingPrice} onChange={e => handleReceivingItemChange(item.id, 'sellingPrice', parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs" />
                          </>
                        ) : (
                          <input type="number" placeholder="0" value={item.costPrice} onChange={e => handleReceivingItemChange(item.id, 'costPrice', parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs" />
                        )}
                      </td>
                      <td className="px-2 py-2"><input type="number" placeholder="0" min="1" value={item.qty} onChange={e => handleReceivingItemChange(item.id, 'qty', parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs" /></td>
                      <td className="px-2 py-2 font-bold text-xs">{(item.costPrice * item.qty).toLocaleString()} {currencySymbol}</td>
                      <td className="px-2 py-2 text-center"><button type="button" onClick={() => removeReceivingItem(item.id)} className="text-rose-500 hover:text-rose-700"><MinusCircle size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addReceivingItem} className="mt-4 text-sm font-bold text-blue-600 flex items-center gap-2"><PlusCircle size={16} /> إضافة بند جديد للفاتورة</button>

            <div className="mt-8 pt-6 border-t dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400">حساب المورد الحالي</p>
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{currentSupplier?.balance?.toLocaleString() || 0} {currencySymbol}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400">حساب الفاتورة</p>
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{invoiceTotal.toLocaleString()} {currencySymbol}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">تم دفع</label>
                    <input type="number" value={receivingData.paidAmount} onChange={e => setReceivingData({...receivingData, paidAmount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">من خزينة</label>
                    <select required={receivingData.paidAmount > 0} value={receivingData.treasuryId} onChange={e => setReceivingData({...receivingData, treasuryId: e.target.value})} disabled={userDefaults && userDefaults.default_treasury_id && !userDefaults.can_change_treasury} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm">
                      <option value="">اختر خزينة...</option>
                      {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all">تأكيد الاستلام وترحيل المخزون</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --- Returns Tab (Existing Logic) --- */}
      {activeTab === 'returns' && (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 max-w-5xl mx-auto shadow-sm animate-in zoom-in duration-300">
          <form onSubmit={handleReturnSubmit}>
            <h3 className="text-xl font-black mb-6 text-slate-900 dark:text-white flex items-center gap-3"><ArrowUpRight size={24} className="text-rose-500"/> إنشاء إذن مرتجع بضاعة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">مرتجع إلى مورد</label>
                <select required value={returnsData.supplierId} onChange={e => setReturnsData({...returnsData, supplierId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 ring-rose-500/20">
                  <option value="">اختر المورد...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">من مستودع</label>
                <select required value={returnsData.warehouseId} onChange={e => setReturnsData({...returnsData, warehouseId: e.target.value})} disabled={userDefaults && userDefaults.default_warehouse_id && !userDefaults.can_change_warehouse} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 ring-rose-500/20">
                  <option value="">اختر المستودع...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-right text-sm min-w-[700px]">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-2 py-3 font-bold w-2/5">الصنف المرتجع</th>
                    <th className="px-2 py-3 font-bold">الكمية</th>
                    <th className="px-2 py-3 font-bold">سعر التكلفة</th>
                    <th className="px-2 py-3 font-bold">الإجمالي</th>
                    <th className="px-2 py-3 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {returnsData.items.map((item) => (
                    <tr key={item.id} className="border-b dark:border-slate-700">
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          <select required value={item.returnType || ''} onChange={e => handleReturnItemChange(item.id, 'returnType', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs mb-1">
                            <option value="">اختر النوع...</option>
                            {productSource !== 'suppliers' && <option value="fabric">قماش</option>}
                            {productSource !== 'suppliers' && <option value="accessory">اكسسوار</option>}
                            <option value="product">منتج</option>
                          </select>
                          <select required value={item.productId} onChange={e => handleSelectProductForReturn(item.id, e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs">
                            <option value="">اختر اسم {item.returnType === 'fabric' ? 'القماش' : item.returnType === 'accessory' ? 'الاكسسوار' : 'المنتج'}...</option>
                            {(() => {
                              const t = String(item.returnType || '').trim();
                              if (t === 'fabric') {
                                const rows = getWarehouseFabrics(String(returnsData.warehouseId || ''));
                                return rows.map((r: any) => (
                                  <option key={r.id ?? r.fabric_id} value={r.id ?? r.fabric_id}>
                                    {r.name} ({r.color || '-'}-{r.size || '-'}) — {Number(r.quantity || 0)}
                                  </option>
                                ));
                              }
                              if (t === 'accessory') {
                                const rows = getWarehouseAccessories(String(returnsData.warehouseId || ''));
                                return rows.map((r: any) => (
                                  <option key={r.id ?? r.accessory_id} value={r.id ?? r.accessory_id}>
                                    {r.name} ({r.color || '-'}-{r.size || '-'}) — {Number(r.quantity || 0)}
                                  </option>
                                ));
                              }
                              if (t === 'product') {
                                const rows = getWarehouseStock(String(returnsData.warehouseId || ''));
                                const filtered = rows.filter((r: any) => {
                                  const cat = String(r.category || '').trim();
                                  return !cat || cat === 'product';
                                });
                                return filtered.map((r: any) => (
                                  <option key={r.product_id} value={r.product_id}>
                                    {r.name} ({r.color || '-'}-{r.size || '-'}) — {Number(r.quantity || 0)}
                                  </option>
                                ));
                              }
                              return null;
                            })()}
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-2"><input type="number" placeholder="0" min="1" value={item.qty} onChange={e => handleReturnItemChange(item.id, 'qty', (String(item.returnType || '').trim() === 'fabric') ? parseFloat(e.target.value) : parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 px-2 text-xs" /></td>
                      <td className="px-2 py-2 font-bold text-xs">{item.costPrice.toLocaleString()} {currencySymbol}</td>
                      <td className="px-2 py-2 font-bold text-xs">{(item.costPrice * item.qty).toLocaleString()} {currencySymbol}</td>
                      <td className="px-2 py-2 text-center"><button type="button" onClick={() => removeReturnItem(item.id)} className="text-rose-500 hover:text-rose-700"><MinusCircle size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addReturnItem} className="mt-4 text-sm font-bold text-rose-600 flex items-center gap-2"><PlusCircle size={16} /> إضافة بند مرتجع آخر</button>

            <div className="mt-8 pt-6 border-t dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400">حساب المورد الحالي</p>
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{currentSupplierForReturn?.balance?.toLocaleString() || 0} {currencySymbol}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400">قيمة المرتجع</p>
                  <p className="font-bold text-sm text-rose-500 dark:text-rose-400">-{returnInvoiceTotal.toLocaleString()} {currencySymbol}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">تم استرداد</label>
                    <input type="number" value={returnsData.receivedAmount} onChange={e => setReturnsData({...returnsData, receivedAmount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">إلى خزينة</label>
                    <select required={returnsData.receivedAmount > 0} value={returnsData.treasuryId} onChange={e => setReturnsData({...returnsData, treasuryId: e.target.value})} disabled={userDefaults && userDefaults.default_treasury_id && !userDefaults.can_change_treasury} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm">
                      <option value="">اختر خزينة...</option>
                      {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-rose-600 text-white py-3 rounded-2xl font-black shadow-xl shadow-rose-500/30 hover:bg-rose-700 active:scale-95 transition-all">تأكيد المرتجع وتحديث الأرصدة</button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default InventoryModule;