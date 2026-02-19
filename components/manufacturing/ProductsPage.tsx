import React, { useEffect, useState } from 'react';

import { Plus, Edit, Trash2, X, Save, Eye, History, Printer, Layers, QrCode } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../../services/apiConfig';
import { openPrintWindow } from '../../services/printUtils';
import CustomSelect from '../CustomSelect';

type Warehouse = { id: number; name: string };
type SizeRow = { id: number; name: string; code?: string | null };
type ColorRow = { id: number; name: string; code?: string | null };
type StageRow = { id: number; name: string; order_num?: number | null; description?: string | null };
type AccessoryRow = { id: number; name: string; code?: string | null };
type FactoryProductRow = {
	id: number;
	name: string;
	code?: string | null;
	type: 'individual' | 'composite';
	description?: string | null;
	sale_price?: number | null;
	min_stock?: number | null;
	quantity?: number | null;
	warehouse_count?: number | null;
	one_warehouse_id?: number | null;
	warehouse_names?: string | null;
};

type ComponentRow = { product_id: '' | number; quantity: number };
type StageAccessoryInput = { accessory_id: '' | number; quantity: number };

type AssemblyComponentInfo = {
	product_id: number;
	name?: string | null;
	code?: string | null;
	per_unit: number;
	available_quantity: number;
	unit_cost?: number;
};

type AssemblyInfo = {
	composite: any;
	warehouse_id: number;
	size_id?: number;
	allowed_sizes?: Array<{ id: number; name: string; code?: string | null }>;
	current_quantity: number;
	max_quantity: number;
	unit_cost: number;
	components: AssemblyComponentInfo[];
};

const ProductsPage = () => {
	const [allProducts, setAllProducts] = useState<FactoryProductRow[]>([]);
	const [products, setProducts] = useState<FactoryProductRow[]>([]);
	const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
	const [warehouseFilterId, setWarehouseFilterId] = useState<number>(0);
	const [sizes, setSizes] = useState<SizeRow[]>([]);
	const [colors, setColors] = useState<ColorRow[]>([]);
	const [stages, setStages] = useState<StageRow[]>([]);
	const [accessories, setAccessories] = useState<AccessoryRow[]>([]);
	const [individualProducts, setIndividualProducts] = useState<{ id: number; name: string; code?: string | null }[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [form, setForm] = useState({
		name: '',
		code: '',
		type: 'individual' as 'individual' | 'composite',
		description: '',
		sale_price: 0,
		min_stock: 0,
		quantity: 0,
		warehouse_id: '' as '' | number
	});
	const [selectedSizeIds, setSelectedSizeIds] = useState<number[]>([]);
	const [selectedStageIds, setSelectedStageIds] = useState<number[]>([]);
	const [stageAccessories, setStageAccessories] = useState<Record<number, StageAccessoryInput[]>>({});
	const [components, setComponents] = useState<ComponentRow[]>([{ product_id: '', quantity: 1 }]);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<FactoryProductRow | null>(null);
	const [historyRows, setHistoryRows] = useState<any[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);

	const [isBarcodesOpen, setIsBarcodesOpen] = useState(false);
	const [barcodesProduct, setBarcodesProduct] = useState<FactoryProductRow | null>(null);
	const [barcodesSizeId, setBarcodesSizeId] = useState<number>(0);
	const [barcodesColorId, setBarcodesColorId] = useState<number>(0);
	const [barcodesAllowedSizeIds, setBarcodesAllowedSizeIds] = useState<number[] | null>(null);

	const [isAssembleOpen, setIsAssembleOpen] = useState(false);
	const [assembleWarehouseId, setAssembleWarehouseId] = useState<number>(0);
	const [assembleCompositeId, setAssembleCompositeId] = useState<number>(0);
	const [assembleSizeId, setAssembleSizeId] = useState<number>(0);
	const [assembleQty, setAssembleQty] = useState<number>(1);
	const [assembleInfo, setAssembleInfo] = useState<AssemblyInfo | null>(null);
	const [assembleLoading, setAssembleLoading] = useState(false);

	const generateProductCode = () => {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
		const rnd = Math.floor(100 + Math.random() * 900);
		return `PRD-${ts}-${rnd}`;
	};

	const fetchAllProducts = async () => {
		try {
			const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getAll`);
			const data = await res.json();
			const rows: FactoryProductRow[] = (data && data.success !== false && Array.isArray(data.data)) ? data.data : [];
			setAllProducts(rows);
			return rows;
		} catch {
			setAllProducts([]);
			return [] as FactoryProductRow[];
		}
	};

	const applyWarehouseFilter = async (warehouseId: number, baseList?: FactoryProductRow[]) => {
		const wid = Number(warehouseId || 0);
		if (!wid) {
			setProducts(baseList ?? allProducts);
			return;
		}
		const list = baseList ?? allProducts;
		const byId = new Map<number, FactoryProductRow>();
		list.forEach(p => byId.set(Number(p.id), p));
		const whName = warehouses.find(w => Number(w.id) === wid)?.name || String(wid);

		try {
			const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getByWarehouse&warehouse_id=${encodeURIComponent(String(wid))}`);
			const js = await res.json();
			const rows: any[] = (js && js.success && Array.isArray(js.data)) ? js.data : [];
			const mapped: FactoryProductRow[] = rows.map(r => {
				const pid = Number(r.product_id || r.id || 0);
				const base = byId.get(pid);
				const qty = Number(r.quantity || 0);
				return {
					...(base || {
						id: pid,
						name: String(r.name || ''),
						code: r.code || null,
						type: 'individual' as any,
					}),
					quantity: qty,
					warehouse_count: 1,
					one_warehouse_id: wid,
					warehouse_names: whName,
				};
			});
			setProducts(mapped);
		} catch {
			setProducts([]);
		}
	};

	const fetchMeta = () => {
		fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getMeta`)
			.then(res => res.json())
			.then(r => {
				const d = r && r.success ? (r.data || {}) : {};
				setSizes(d.sizes || []);
				setColors(d.colors || []);
				setStages(d.stages || []);
				setAccessories(d.accessories || []);
				setWarehouses(d.warehouses || []);
				setIndividualProducts(d.individual_products || []);
			})
			.catch(() => {
				setSizes([]);
				setColors([]);
				setStages([]);
				setAccessories([]);
				setWarehouses([]);
				setIndividualProducts([]);
			});
	};

	useEffect(() => {
		fetchAllProducts().then(rows => {
			setProducts(rows);
		});
		fetchMeta();
	}, []);

	useEffect(() => {
		applyWarehouseFilter(warehouseFilterId).catch(() => null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [warehouseFilterId]);

	const openAssembleModal = () => {
		const defaultWarehouseId = Number(warehouseFilterId || 0) || Number(warehouses?.[0]?.id || 0);
		const compositeList = (allProducts || []).filter(p => p.type === 'composite');
		const defaultCompositeId = Number(compositeList?.[0]?.id || 0);
		setAssembleWarehouseId(defaultWarehouseId);
		setAssembleCompositeId(defaultCompositeId);
		setAssembleSizeId(0);
		setAssembleQty(1);
		setAssembleInfo(null);
		setIsAssembleOpen(true);
	};

	const closeAssembleModal = () => {
		setIsAssembleOpen(false);
		setAssembleWarehouseId(0);
		setAssembleCompositeId(0);
		setAssembleSizeId(0);
		setAssembleQty(1);
		setAssembleInfo(null);
		setAssembleLoading(false);
	};

	const openBarcodesModal = async (product: FactoryProductRow) => {
		const qty = Math.max(0, Math.floor(Number(product.quantity || 0)));
		if (qty <= 0) {
			Swal.fire({ icon: 'info', title: 'لا توجد كمية', text: 'لا توجد كمية لهذا المنتج في المخزون حالياً' });
			return;
		}
		setBarcodesProduct(product);
		setBarcodesAllowedSizeIds(null);
		setBarcodesSizeId(0);
		setBarcodesColorId(0);
		setIsBarcodesOpen(true);
		try {
			// Load product allowed sizes (if configured)
			const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getDetails&id=${encodeURIComponent(String(product.id))}`);
			const js = await res.json();
			const ids = Array.isArray(js?.data?.size_ids) ? js.data.size_ids.map((x: any) => Number(x)).filter((n: any) => Number(n) > 0) : [];
			setBarcodesAllowedSizeIds(ids.length > 0 ? ids : null);
		} catch {
			setBarcodesAllowedSizeIds(null);
		}
	};

	const closeBarcodesModal = () => {
		setIsBarcodesOpen(false);
		setBarcodesProduct(null);
		setBarcodesSizeId(0);
		setBarcodesColorId(0);
		setBarcodesAllowedSizeIds(null);
	};

	useEffect(() => {
		if (!isBarcodesOpen || !barcodesProduct) return;
		const allowedSizes = (barcodesAllowedSizeIds && barcodesAllowedSizeIds.length > 0)
			? sizes.filter(s => barcodesAllowedSizeIds.includes(Number(s.id)))
			: sizes;
		if (!barcodesSizeId && allowedSizes.length > 0) setBarcodesSizeId(Number(allowedSizes[0].id));
		if (!barcodesColorId && colors.length > 0) setBarcodesColorId(Number(colors[0].id));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isBarcodesOpen, barcodesProduct, barcodesAllowedSizeIds, sizes, colors]);

	const getTrackingBarcode = () => {
		if (!barcodesProduct) return '';
		const pid = Number(barcodesProduct.id || 0);
		const sid = Number(barcodesSizeId || 0);
		const cid = Number(barcodesColorId || 0);
		if (!pid || !sid || !cid) return '';
		return `FPV2-${pid}-${sid}-${cid}`;
	};

	const prefillAndGoPrint = (code: string, title: string, qty: number) => {
		try {
			localStorage.setItem('Nexus_barcode_print_prefill_v1', JSON.stringify({
				items: [{ code, title, qty }]
			}));
		} catch {
			// ignore
		}
		window.dispatchEvent(new CustomEvent('nexus:navigate', { detail: { slug: 'barcode-print' } }));
	};

	const fetchAssemblyInfo = async (compositeId: number, warehouseId: number, sizeId?: number) => {
		if (!compositeId || !warehouseId) {
			setAssembleInfo(null);
			return;
		}
		setAssembleLoading(true);
		try {
			const qsSize = sizeId ? `&size_id=${encodeURIComponent(String(sizeId))}` : '';
			const res = await fetch(
				`${API_BASE_PATH}/api.php?module=factory_products&action=getAssemblyInfo&composite_id=${encodeURIComponent(String(compositeId))}&warehouse_id=${encodeURIComponent(String(warehouseId))}${qsSize}`
			);
			const js = await res.json();
			if (!js?.success) throw new Error(js?.message || 'فشل تحميل بيانات التجميع');
			setAssembleInfo(js.data as AssemblyInfo);
		} catch (e: any) {
			setAssembleInfo(null);
			Swal.fire({ icon: 'error', title: 'خطأ', text: e?.message || 'حدث خطأ أثناء تحميل بيانات التجميع' });
		} finally {
			setAssembleLoading(false);
		}
	};

	useEffect(() => {
		if (!isAssembleOpen) return;
		fetchAssemblyInfo(assembleCompositeId, assembleWarehouseId, assembleSizeId || undefined).catch(() => null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAssembleOpen, assembleCompositeId, assembleWarehouseId, assembleSizeId]);

	useEffect(() => {
		if (!isAssembleOpen) return;
		const allowed = (assembleInfo?.allowed_sizes || []) as Array<{ id: number; name: string }>;
		if (!allowed || allowed.length === 0) return;
		const cur = Number(assembleSizeId || 0);
		const exists = cur && allowed.some(s => Number(s.id) === cur);
		if (!exists) {
			setAssembleSizeId(Number(allowed[0].id));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [assembleInfo, isAssembleOpen]);

	const handleAssemble = async () => {
		if (!assembleCompositeId || !assembleWarehouseId) {
			Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اختر المخزن والمنتج المجمع أولاً' });
			return;
		}
		if (!assembleSizeId) {
			Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اختر المقاس أولاً (التجميع لابد أن يكون بنفس المقاس)' });
			return;
		}
		const maxQty = Number(assembleInfo?.max_quantity ?? 0);
		const qty = Math.floor(Number(assembleQty || 0));
		if (!qty || qty <= 0) {
			Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'أدخل كمية صحيحة' });
			return;
		}
		if (maxQty > 0 && qty > maxQty) {
			Swal.fire({ icon: 'warning', title: 'تنبيه', text: `أقصى كمية يمكن تجميعها الآن: ${maxQty}` });
			return;
		}

		const compositeName = String((allProducts.find(p => Number(p.id) === Number(assembleCompositeId))?.name) || assembleInfo?.composite?.name || '');
		const whName = String(warehouses.find(w => Number(w.id) === Number(assembleWarehouseId))?.name || '');
		const sizeName = String(sizes.find(s => Number(s.id) === Number(assembleSizeId))?.name || assembleSizeId);

		const ok = await Swal.fire({
			icon: 'question',
			title: 'تأكيد التجميع',
			html: `<div style="text-align:right; direction:rtl; font-size:13px">
				<div><b>المنتج:</b> ${compositeName || assembleCompositeId}</div>
				<div><b>المخزن:</b> ${whName || assembleWarehouseId}</div>
				<div><b>المقاس:</b> ${sizeName}</div>
				<div><b>الكمية:</b> ${qty}</div>
			</div>`,
			showCancelButton: true,
			confirmButtonText: 'تنفيذ التجميع',
			cancelButtonText: 'إلغاء',
		});
		if (!ok.isConfirmed) return;

		setAssembleLoading(true);
		try {
			const res = await fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=assembleComposite`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ composite_id: assembleCompositeId, warehouse_id: assembleWarehouseId, size_id: assembleSizeId, quantity: qty }),
			});
			const js = await res.json();
			if (!js?.success) throw new Error(js?.message || 'فشل تنفيذ التجميع');

			const code = String(js?.data?.code || assembleInfo?.composite?.code || '');
			const unitCost = Number(js?.data?.unit_cost || 0);
			const totalCost = Number(js?.data?.total_cost || 0);

			// refresh list + current assembly info
			const rows = await fetchAllProducts();
			setProducts(rows);
			await applyWarehouseFilter(warehouseFilterId, rows);
			await fetchAssemblyInfo(assembleCompositeId, assembleWarehouseId, assembleSizeId);

			const r = await Swal.fire({
				icon: 'success',
				title: 'تم التجميع بنجاح',
				html: `<div style="text-align:right; direction:rtl; font-size:13px">
					<div><b>باركود المنتج المجمع:</b> ${code || '-'}</div>
					<div><b>تكلفة الوحدة (تقديري):</b> ${unitCost.toFixed(2)}</div>
					<div><b>إجمالي التكلفة:</b> ${totalCost.toFixed(2)}</div>
				</div>`,
				showCancelButton: true,
				confirmButtonText: 'طباعة الباركود',
				cancelButtonText: 'تم',
			});
			if (r.isConfirmed && code) {
				prefillAndGoPrint(code, `${compositeName || code} - ${sizeName}`, qty);
			}
		} catch (e: any) {
			Swal.fire({ icon: 'error', title: 'خطأ', text: e?.message || 'فشل تنفيذ التجميع' });
		} finally {
			setAssembleLoading(false);
		}
	};

	const openModal = (product: FactoryProductRow | null = null) => {
		if (product) {
			setEditingId(product.id);
			// Load full details
			fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getDetails&id=${product.id}`)
				.then(r => r.json())
				.then(js => {
					if (!js || !js.success) return;
					const p = js.data?.product || {};
					const oneWarehouseId = (product.one_warehouse_id === null || product.one_warehouse_id === undefined || product.one_warehouse_id === 0)
						? ''
						: Number(product.one_warehouse_id);
					setForm({
						name: p.name || '',
						code: p.code || '',
						type: (p.type === 'composite' ? 'composite' : 'individual'),
						description: p.description || '',
						sale_price: Number(p.sale_price || 0),
						min_stock: Number(p.min_stock || 0),
						warehouse_id: oneWarehouseId,
						quantity: oneWarehouseId ? Number(product.quantity || 0) : 0,
					});
					setSelectedSizeIds((js.data?.size_ids || []).map((x: any) => Number(x)));
					setSelectedStageIds((js.data?.stage_ids || []).map((x: any) => Number(x)));
					const map: Record<number, StageAccessoryInput[]> = {};
					const sa = js.data?.stage_accessories || {};
					Object.keys(sa).forEach(k => {
						map[Number(k)] = (sa[k] || []).map((x: any) => {
							if (typeof x === 'number' || typeof x === 'string') {
								return { accessory_id: Number(x), quantity: 1 };
							}
							return {
								accessory_id: (x && (x.accessory_id !== undefined)) ? Number(x.accessory_id) : '',
								quantity: (x && x.quantity !== undefined) ? Number(x.quantity) : 1,
							};
						});
					});
					setStageAccessories(map);
					const comps = (js.data?.components || []).map((c: any) => ({
						product_id: c.product_id ? Number(c.product_id) : '',
						quantity: Number(c.quantity || 1),
					}));
					setComponents(comps.length > 0 ? comps : [{ product_id: '', quantity: 1 }]);
				})
				.catch(() => {
					// fallback to basic
					setForm({
						name: product.name || '',
						code: product.code || '',
						type: product.type,
						description: product.description || '',
						sale_price: Number(product.sale_price || 0),
						min_stock: Number(product.min_stock || 0),
						quantity: 0,
						warehouse_id: '',
					});
				});
		} else {
			setEditingId(null);
			setForm({
				name: '',
				code: generateProductCode(),
				type: 'individual',
				description: '',
				sale_price: 0,
				min_stock: 0,
				quantity: 0,
				warehouse_id: ''
			});
			setSelectedSizeIds([]);
			setSelectedStageIds([]);
			setStageAccessories({});
			setComponents([{ product_id: '', quantity: 1 }]);
		}
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setForm({ name: '', code: '', type: 'individual', description: '', sale_price: 0, min_stock: 0, quantity: 0, warehouse_id: '' });
		setSelectedSizeIds([]);
		setSelectedStageIds([]);
		setStageAccessories({});
		setComponents([{ product_id: '', quantity: 1 }]);
		setEditingId(null);
	};

	const toggleIdInList = (ids: number[], id: number) => {
		return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
	};

	const handleChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = e => {
		const { name, value } = e.target as any;
		if (name === 'type') {
			const nextType = (value === 'composite' ? 'composite' : 'individual') as 'individual' | 'composite';
			setForm(f => ({ ...f, type: nextType }));
			// reset irrelevant state
			if (nextType === 'individual') {
				setComponents([{ product_id: '', quantity: 1 }]);
			} else {
				setSelectedSizeIds([]);
				setSelectedStageIds([]);
				setStageAccessories({});
			}
			return;
		}
		if (name === 'warehouse_id') {
			const nextWarehouseId = value === '' ? '' : Number(value);
			setForm(f => ({ ...f, warehouse_id: nextWarehouseId }));
			// When editing: load quantity for the selected warehouse
			if (editingId && nextWarehouseId) {
				fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getStockQty&factory_product_id=${editingId}&warehouse_id=${nextWarehouseId}`)
					.then(r => r.json())
					.then(js => {
						const q = js && js.success && js.data ? Number(js.data.quantity || 0) : 0;
						setForm(prev => ({ ...prev, quantity: q }));
					})
					.catch(() => setForm(prev => ({ ...prev, quantity: 0 })));
			}
			return;
		}
		if (name === 'quantity' || name === 'sale_price' || name === 'min_stock') {
			setForm(f => ({ ...f, [name]: value === '' ? 0 : Number(value) }));
			return;
		}
		setForm(f => ({ ...f, [name]: value }));
	};

	const validateForm = () => {
		if (!form.name.trim()) {
			Swal.fire('تنبيه', 'اسم المنتج مطلوب.', 'warning');
			return false;
		}
		if (!form.warehouse_id) {
			Swal.fire('تنبيه', 'يجب اختيار المخزن للكمية الحالية.', 'warning');
			return false;
		}
		if (form.type === 'individual') {
			if (selectedSizeIds.length === 0) {
				Swal.fire('تنبيه', 'يجب اختيار المقاسات المتاحة للمنتج.', 'warning');
				return false;
			}
			if (selectedStageIds.length === 0) {
				Swal.fire('تنبيه', 'يجب اختيار مراحل التصنيع.', 'warning');
				return false;
			}
		} else {
			const valid = components.filter(c => c.product_id !== '' && Number(c.quantity) > 0);
			if (valid.length === 0) {
				Swal.fire('تنبيه', 'يجب اختيار المنتجات المكونة للمنتج المجمع مع الكميات.', 'warning');
				return false;
			}
		}
		return true;
	};

	const handleSubmit: React.FormEventHandler<HTMLFormElement> = e => {
		e.preventDefault();
		if (!validateForm()) return;
		const action = editingId ? 'update' : 'add';
		const payload: any = {
			name: form.name,
			code: form.code,
			type: form.type,
			description: form.description,
			sale_price: Number(form.sale_price || 0),
			min_stock: Number(form.min_stock || 0),
			warehouse_id: Number(form.warehouse_id),
			quantity: Number(form.quantity || 0),
		};
		if (form.type === 'individual') {
			payload.size_ids = selectedSizeIds;
			payload.stage_ids = selectedStageIds;
			const saPayload: Record<number, { accessory_id: number; quantity: number }[]> = {};
			Object.keys(stageAccessories).forEach(k => {
				const sid = Number(k);
				const rows = (stageAccessories[sid] || [])
					.filter(r => r.accessory_id !== '' && Number(r.accessory_id) > 0 && Number(r.quantity) > 0)
					.map(r => ({ accessory_id: Number(r.accessory_id), quantity: Number(r.quantity) }));
				if (rows.length > 0) saPayload[sid] = rows;
			});
			payload.stage_accessories = saPayload;
		} else {
			payload.components = components
				.filter(c => c.product_id !== '' && Number(c.quantity) > 0)
				.map(c => ({ product_id: Number(c.product_id), quantity: Number(c.quantity) }));
		}
		if (editingId) payload.id = editingId;

		fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
			.then(res => res.json())
			.then((jr) => {
				if (!jr || jr.success === false) {
					Swal.fire('خطأ', jr?.message || 'حدث خطأ أثناء الحفظ.', 'error');
					return;
				}
				closeModal();
				fetchAllProducts().then(rows => {
					if (!warehouseFilterId) {
						setProducts(rows);
					} else {
						applyWarehouseFilter(warehouseFilterId, rows).catch(() => null);
					}
				});
				fetchMeta();
			});
	};

	const handleDelete = id => {
		Swal.fire({
			title: 'تأكيد الحذف',
			text: 'هل أنت متأكد من حذف هذا المنتج؟',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'نعم',
			cancelButtonText: 'إلغاء'
		}).then(result => {
			if (!result.isConfirmed) return;
			fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=delete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			})
				.then(res => res.json())
				.then(() => {
					fetchAllProducts().then(rows => {
						if (!warehouseFilterId) {
							setProducts(rows);
						} else {
							applyWarehouseFilter(warehouseFilterId, rows).catch(() => null);
						}
					});
				});
		});
	};

	const openHistory = (product: FactoryProductRow) => {
		setSelectedProduct(product);
		setIsHistoryOpen(true);
		setHistoryRows([]);
		setHistoryLoading(true);
		fetch(`${API_BASE_PATH}/api.php?module=factory_products&action=getMovements&factory_product_id=${product.id}`)
			.then(r => r.json())
			.then(js => {
				setHistoryRows((js && js.success && Array.isArray(js.data)) ? js.data : []);
			})
			.catch(() => setHistoryRows([]))
			.finally(() => setHistoryLoading(false));
	};

	const closeHistory = () => {
		setIsHistoryOpen(false);
		setSelectedProduct(null);
		setHistoryRows([]);
		setHistoryLoading(false);
	};

	const printHistory = () => {
		if (!selectedProduct) return;
		const title = 'سجل حركة المنتجات';
		const subtitle = `${selectedProduct.name || ''}${selectedProduct.code ? ` (${selectedProduct.code})` : ''}`;
		const body = `
			<div style="text-align:center">
				<h2 style="margin:0">${title}</h2>
				<div class="small">${subtitle}</div>
			</div>
			<table>
				<thead>
					<tr>
						<th>التاريخ</th>
						<th>المخزن</th>
						<th>نوع الحركة</th>
						<th>رقم المرجع</th>
						<th>المستخدم</th>
						<th>التغير</th>
						<th>قبل</th>
						<th>بعد</th>
						<th>تفاصيل</th>
					</tr>
				</thead>
				<tbody>
					${historyRows.map((m:any) => {
						const mt = formatMovementType(String(m.movement_type || ''));
						const ch = Number(m.quantity_change || 0);
						const prev = (m.previous_quantity == null) ? '-' : String(m.previous_quantity);
						const next = (m.new_quantity == null) ? '-' : String(m.new_quantity);
						const wh = (m.warehouse_name || m.warehouse_id || '-');
						const ref = formatReference(m.reference_type, m.reference_id);
						const user = (m.created_by_name || '-');
						const det = safeDetails(m.notes);
						const date = (m.created_at || '-');
						const delta = (ch > 0 ? `+${ch}` : String(ch));
						return `<tr>
							<td class="mono">${date}</td>
							<td>${wh}</td>
							<td>${mt.label}</td>
							<td>${ref}</td>
							<td>${user}</td>
							<td class="mono">${delta}</td>
							<td class="mono">${prev}</td>
							<td class="mono">${next}</td>
							<td>${det}</td>
						</tr>`;
					}).join('')}
				</tbody>
			</table>
		`;
		openPrintWindow(title, body);
	};

	const formatMovementType = (t: string) => {
		const v = (t || '').trim();
		if (v === 'purchase') return { label: 'شراء', cls: 'bg-emerald-100 text-emerald-700' };
		if (v === 'sale' || v === 'order') return { label: 'مبيعات / طلبية', cls: 'bg-rose-100 text-rose-700' };
		if (v === 'return_in') return { label: 'مرتجع من عميل', cls: 'bg-blue-100 text-blue-700' };
		if (v === 'return_out') return { label: 'مرتجع لمورد', cls: 'bg-blue-100 text-blue-700' };
		if (v === 'initial_balance') return { label: 'رصيد افتتاحي', cls: 'bg-blue-100 text-blue-700' };
		if (v === 'adjustment') return { label: 'تسوية', cls: 'bg-amber-100 text-amber-700' };
		if (v === 'manufacturing') return { label: 'تصنيع', cls: 'bg-emerald-100 text-emerald-700' };
		if (v === 'manufacturing_finish') return { label: 'انتهاء تصنيع', cls: 'bg-emerald-100 text-emerald-700' };
		if (v === 'manufacturing_consume') return { label: 'استهلاك للتصنيع', cls: 'bg-amber-100 text-amber-700' };
		if (v === 'transfer') return { label: 'نقل الى مخزن', cls: 'bg-indigo-100 text-indigo-700' };
		if (v === 'return') return { label: 'مرتجع', cls: 'bg-blue-100 text-blue-700' };
		if (v === 'send_to_sales') return { label: 'إرسال للمبيعات', cls: 'bg-rose-100 text-rose-700' };
		if (v === 'receive_from_factory') return { label: 'استلام من المصنع', cls: 'bg-emerald-100 text-emerald-700' };
		if (v === 'send_to_sales_return') return { label: 'مرتجع من الإرسال', cls: 'bg-blue-100 text-blue-700' };
		return { label: v ? 'غير معروف' : '-', cls: 'bg-slate-100 text-slate-700' };
	};

	const formatReference = (referenceType: any, referenceId: any) => {
		const id = referenceId === null || referenceId === undefined || referenceId === '' ? null : String(referenceId);
		if (!id) return '-';
		const t = String(referenceType || '').trim();
		if (!t) return `رقم ${id}`;
		if (t === 'cutting_order') return `أمر قص رقم ${id}`;
		if (t === 'manufacturing_stage') return `مرحلة تصنيع رقم ${id}`;
		if (t === 'dispatch') return `إرسال رقم ${id}`;
		if (t === 'dispatch_order') return `إرسال للمبيعات رقم ${id}`;
		if (t === 'invoice') return `فاتورة رقم ${id}`;
		return `رقم ${id}`;
	};

	const formatDetailsFromObject = (obj: any) => {
		if (!obj || typeof obj !== 'object') return '-';
		if (obj.notes) return String(obj.notes);
		if (obj.name && !obj.itemType) return String(obj.name);
		// Handle product/item payloads
		if (obj.itemType || obj.productId || obj.qty || obj.quantity) {
			const parts: string[] = [];
			if (obj.name) parts.push(`المنتج: ${obj.name}`);
			if (obj.color) parts.push(`اللون: ${obj.color}`);
			if (obj.size) parts.push(`المقاس: ${obj.size}`);
			if (obj.qty || obj.quantity) parts.push(`الكمية: ${Number(obj.qty||obj.quantity||0)}`);
			if (obj.costPrice || obj.cost_price) parts.push(`سعر التكلفة: ${Number(obj.costPrice||obj.cost_price||0)}`);
			if (obj.sellingPrice || obj.selling_price) parts.push(`سعر البيع: ${Number(obj.sellingPrice||obj.selling_price||0)}`);
			if (obj.barcode) parts.push(`الباركود: ${obj.barcode}`);
			if (obj.productId) parts.push(`معرّف المنتج: ${obj.productId}`);
			return parts.length ? parts.join(' | ') : '-';
		}

		const parts: string[] = [];
		const pushNum = (label: string, value: any) => {
			if (value === null || value === undefined || value === '') return;
			const n = Number(value);
			parts.push(Number.isFinite(n) ? `${label}: ${n}` : `${label}: ${String(value)}`);
		};
		const pushText = (label: string, value: any) => {
			if (value === null || value === undefined || value === '') return;
			parts.push(`${label}: ${String(value)}`);
		};

		pushNum('أمر قص', obj.cutting_order_id);
		pushNum('مرحلة', obj.stage_id);
		pushNum('الكمية', obj.qty ?? obj.quantity);
		pushNum('تكلفة الوحدة', obj.unit_cost);
		pushNum('تكلفة القماش', obj.fabric_unit_cost);
		pushNum('تكلفة الإكسسوارات', obj.accessories_unit_cost);
		pushNum('الأجرة', obj.wage_unit_cost);
		pushNum('من مخزن', obj.from_warehouse_id);
		pushNum('إلى مخزن', obj.to_warehouse_id);
		pushText('السبب', obj.reason);

		return parts.length ? parts.join(' | ') : '—';
	};

	const safeDetails = (notes: any) => {
		if (!notes) return '-';
		if (typeof notes !== 'string') return formatDetailsFromObject(notes);
		const s = notes.trim();
		if (!s) return '-';
		try {
			const obj = JSON.parse(s);
			return formatDetailsFromObject(obj);
		} catch {
			return s;
		}
	};

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-black">إدارة المنتجات</h2>
				<div className="flex items-center gap-2">
					<CustomSelect
						value={String(warehouseFilterId || 0)}
						onChange={v => setWarehouseFilterId(Number(v) || 0)}
						options={[{ value: '0', label: 'كل المخازن' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
						className="text-xs"
						/>
					<button onClick={() => openModal()} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
						<Plus size={16} /> إضافة منتج
					</button>
					{(allProducts || []).some(p => p.type === 'composite') && (
						<button
							onClick={openAssembleModal}
							className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
							title="تجميع المنتج المجمع من مكوناته"
						>
							<Layers size={16} /> تجميع المنتجات
						</button>
					)}
				</div>
			</div>

			<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
				<table className="w-full text-right text-sm">
					<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
						<tr>
							<th className="px-6 py-4 font-bold">الاسم</th>
							<th className="px-6 py-4 font-bold">الكود</th>
							<th className="px-6 py-4 font-bold">النوع</th>
							<th className="px-6 py-4 font-bold">المخزن</th>
							<th className="px-6 py-4 font-bold">الكمية الحالية</th>
							<th className="px-6 py-4 font-bold">سعر البيع</th>
							<th className="px-6 py-4 font-bold">الحد الأدنى</th>
							<th className="px-6 py-4 font-bold">الوصف</th>
							<th className="px-6 py-4 font-bold text-center">تحكم</th>
						</tr>
					</thead>
					<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
						{products.length === 0 ? (
								<tr><td colSpan={9} className="text-center py-10 text-muted">لا توجد منتجات مسجلة.</td></tr>
						) : products.map(product => (
							<tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
								<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{product.name}</td>
								<td className="px-6 py-4 text-xs font-mono text-muted">{product.code || '-'}</td>
								<td className="px-6 py-4 text-xs">{product.type === 'individual' ? 'فردي' : 'مجمع'}</td>
								<td className="px-6 py-4 text-xs">{(() => {
									const count = Number(product.warehouse_count || 0);
									const names = (product.warehouse_names || '').toString().trim();
									if (!count) return '-';
									if (names) return names;
									return count === 1 ? String(product.one_warehouse_id || '-') : 'متعدد';
								})()}</td>
								<td className="px-6 py-4 text-xs font-mono">{Number(product.quantity || 0)}</td>
								<td className="px-6 py-4 text-xs font-mono">{Number(product.sale_price || 0)}</td>
								<td className="px-6 py-4 text-xs font-mono">{Number(product.min_stock || 0)}</td>
								<td className="px-6 py-4 text-xs">{product.description || '-'}</td>
								<td className="px-6 py-4">
									<div className="flex items-center justify-center gap-1">
										<button onClick={() => openBarcodesModal(product)} className="p-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors" title="عرض الباركودات (حسب الكمية الحالية)"><QrCode size={14} /></button>
										<button onClick={() => openHistory(product)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="عرض حركة المخزون"><Eye size={14} /></button>
										<button onClick={() => openModal(product)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors" title="تعديل"><Edit size={14} /></button>
										<button onClick={() => handleDelete(product.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="حذف"><Trash2 size={14} /></button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Barcodes Modal */}
			{isBarcodesOpen && barcodesProduct && (
				<div className="fixed inset-0 z-[128] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700 h-[80vh] flex flex-col">
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><QrCode className="text-emerald-600" /> باركودات المنتج</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400">
									{barcodesProduct.name} — الكمية الحالية: {Math.max(0, Math.floor(Number(barcodesProduct.quantity || 0)))}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<button
									onClick={() => {
										const qty = Math.max(0, Math.floor(Number(barcodesProduct.quantity || 0)));
										const bc = getTrackingBarcode();
										if (!bc || qty <= 0) return;
										const sizeName = String(sizes.find(s => Number(s.id) === Number(barcodesSizeId))?.name || barcodesSizeId);
										const colorName = String(colors.find(c => Number(c.id) === Number(barcodesColorId))?.name || barcodesColorId);
										prefillAndGoPrint(bc, `${String(barcodesProduct.name || '')} - ${sizeName} - ${colorName}`, qty);
									}}
									className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
									title="طباعة حسب الكمية الحالية"
								>
									<Printer size={16} /> طباعة
								</button>
								<button onClick={closeBarcodesModal} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق"><X size={24} /></button>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto p-6">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المقاس</label>
									<CustomSelect
										value={barcodesSizeId ? String(barcodesSizeId) : ''}
										onChange={v => setBarcodesSizeId(Number(v) || 0)}
										options={[{ value: '', label: 'اختر المقاس' }, ...(((barcodesAllowedSizeIds && barcodesAllowedSizeIds.length > 0)
											? sizes.filter(s => barcodesAllowedSizeIds.includes(Number(s.id)))
											: sizes
										).map(s => ({ value: String(s.id), label: `${s.name}${s.code ? ` (${s.code})` : ''}` })))]}
										className="w-full"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">اللون</label>
									<CustomSelect
										value={barcodesColorId ? String(barcodesColorId) : ''}
										onChange={v => setBarcodesColorId(Number(v) || 0)}
										options={[{ value: '', label: 'اختر اللون' }, ...colors.map(c => ({ value: String(c.id), label: `${c.name}${c.code ? ` (${c.code})` : ''}` }))]}
										className="w-full"
									/>
								</div>
								<div className="rounded-3xl border border-card card p-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
									<div className="text-xs text-slate-500 dark:text-slate-400 font-bold">باركود التتبع (لإرسال للمبيعات)</div>
									<div className="mt-1 text-sm font-mono font-black dir-ltr break-all">{getTrackingBarcode() || '—'}</div>
								</div>
							</div>
							<div className="rounded-3xl border border-card shadow-sm card overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
								<table className="w-full text-right text-sm">
									<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 sticky top-0">
										<tr>
											<th className="px-6 py-4 font-bold">#</th>
											<th className="px-6 py-4 font-bold">الباركود</th>
											<th className="px-6 py-4 font-bold">المقاس</th>
											<th className="px-6 py-4 font-bold">اللون</th>
											<th className="px-6 py-4 font-bold">المخزن</th>
										</tr>
									</thead>
									<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
										{(() => {
											const qty = Math.max(0, Math.floor(Number(barcodesProduct.quantity || 0)));
											const code = getTrackingBarcode();
											const sizeName = String(sizes.find(s => Number(s.id) === Number(barcodesSizeId))?.name || '');
											const colorName = String(colors.find(c => Number(c.id) === Number(barcodesColorId))?.name || '');
											const whLabel = warehouseFilterId ? (warehouses.find(w => Number(w.id) === Number(warehouseFilterId))?.name || String(warehouseFilterId)) : 'كل المخازن';
											if (!code || !sizeName || !colorName || qty <= 0) {
												return (<tr><td colSpan={5} className="text-center py-10 text-muted">اختر المقاس واللون لعرض الباركودات.</td></tr>);
											}
											const limit = Math.min(qty, 500);
											const rows = Array.from({ length: limit }, (_, i) => i + 1);
											return (
												<>
													{rows.map(i => (
														<tr key={i}>
															<td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{i}</td>
															<td className="px-6 py-3 font-mono text-xs">{code}</td>
															<td className="px-6 py-3 text-xs">{sizeName}</td>
															<td className="px-6 py-3 text-xs">{colorName}</td>
															<td className="px-6 py-3 text-xs">{whLabel}</td>
														</tr>
													))}
													{qty > 500 && (
														<tr>
															<td colSpan={5} className="px-6 py-4 text-xs text-muted">تم عرض أول 500 فقط. للطباعة استخدم زر (طباعة) وسيتم الطباعة بالكمية الكاملة.</td>
														</tr>
													)}
												</>
											);
										})()}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Movement History Modal */}
			{isHistoryOpen && selectedProduct && (
				<div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700 h-[80vh] flex flex-col">
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><History className="text-blue-500" /> سجل حركة المخزون</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400">{selectedProduct.name} ({selectedProduct.code || '-'})</p>
							</div>
							<div className="flex items-center gap-2">
								<button onClick={printHistory} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all" title="طباعة">
									<Printer size={16} /> طباعة
								</button>
								<button onClick={closeHistory} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق"><X size={24} /></button>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto p-6">
							<table className="w-full text-right text-sm">
								<thead className="text-slate-500 dark:text-slate-400 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 sticky top-0">
									<tr>
										<th className="px-4 py-2">التاريخ</th>
										<th className="px-4 py-2">المخزن</th>
										<th className="px-4 py-2">نوع الحركة</th>
										<th className="px-4 py-2">رقم المرجع</th>
										<th className="px-4 py-2">المستخدم</th>
										<th className="px-4 py-2 text-center">التغير</th>
										<th className="px-4 py-2 text-center">قبل</th>
										<th className="px-4 py-2 text-center">بعد</th>
										<th className="px-4 py-2">تفاصيل</th>
									</tr>
								</thead>
								<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
									{historyLoading ? (
										<tr><td colSpan={9} className="text-center py-8 text-slate-400">جارٍ التحميل...</td></tr>
									) : historyRows.length === 0 ? (
										<tr><td colSpan={9} className="text-center py-8 text-slate-400">لا توجد حركات مسجلة.</td></tr>
									) : historyRows.map(m => {
										const mt = formatMovementType(String(m.movement_type || ''));
										const ch = Number(m.quantity_change || 0);
										return (
											<tr key={m.id}>
												<td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{m.created_at || '-'}</td>
												<td className="px-4 py-3 text-xs">{m.warehouse_name || m.warehouse_id || '-'}</td>
												<td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${mt.cls}`}>{mt.label}</span></td>
												<td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">{formatReference(m.reference_type, m.reference_id)}</td>
												<td className="px-4 py-3 text-xs">{m.created_by_name || '-'}</td>
												<td className="px-4 py-3 text-center font-bold dir-ltr">{ch > 0 ? `+${ch}` : ch}</td>
												<td className="px-4 py-3 text-center font-mono text-xs">{m.previous_quantity == null ? '-' : Number(m.previous_quantity || 0)}</td>
												<td className="px-4 py-3 text-center font-mono text-xs">{m.new_quantity == null ? '-' : Number(m.new_quantity || 0)}</td>
												<td className="px-4 py-3 text-xs max-w-[360px] truncate" title={safeDetails(m.notes)}>{safeDetails(m.notes)}</td>
										</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* Modal for Add/Edit */}
			{isModalOpen && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-5xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card flex flex-col" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">{editingId ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
							<button onClick={closeModal} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={handleSubmit} className="p-8 text-right overflow-y-auto flex-1 min-h-0">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">اسم المنتج</label>
									<input name="name" value={form.name} onChange={handleChange} placeholder="اسم المنتج" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" required />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكود (تلقائي)</label>
									<input name="code" value={form.code} readOnly placeholder="PRD-..." className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm font-mono focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">نوع المنتج</label>
									<CustomSelect
										value={String(form.type)}
										onChange={v => setForm({ ...form, type: v as any })}
										options={[{ value: 'individual', label: 'فردي' }, { value: 'composite', label: 'مجمع' }]}
										className="w-full"
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">المخزن (للكمية الحالية)</label>
									<CustomSelect
										value={form.warehouse_id === '' ? '' : String(form.warehouse_id)}
										onChange={v => setForm({ ...form, warehouse_id: v === '' ? '' : Number(v) })}
										options={[{ value: '', label: 'اختر المخزن' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
										className="w-full"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">سعر البيع</label>
									<input name="sale_price" type="number" min="0" value={form.sale_price} onChange={handleChange} placeholder="سعر البيع" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية الحالية</label>
									<input name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange} placeholder="الكمية الحالية" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">الحد الأدنى للمخزون (للتنبيه)</label>
									<input name="min_stock" type="number" min="0" value={form.min_stock} onChange={handleChange} placeholder="الحد الأدنى" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>

								{form.type === 'individual' ? (
									<>
										<div className="space-y-2 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 mr-2">المقاسات المتاحة (اختيار إجباري)</label>
											<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
												{sizes.map(sz => (
													<label key={sz.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-2xl px-3 py-2 text-sm">
														<input
															type="checkbox"
															checked={selectedSizeIds.includes(sz.id)}
															onChange={() => setSelectedSizeIds(prev => toggleIdInList(prev, sz.id))}
														/>
														<span>{sz.name}</span>
													</label>
												))}
											</div>
										</div>
										<div className="space-y-2 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 mr-2">مراحل التصنيع (اختيار إجباري)</label>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
												{stages.map(st => {
													const selected = selectedStageIds.includes(st.id);
													return (
														<div
															key={st.id}
															className={
																`text-right rounded-3xl border p-4 transition-colors ${
																	selected
																		? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700/40'
																		: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/40'
																}`
															}
														>
															<button
																type="button"
																onClick={() => {
																	setSelectedStageIds(prev => {
																		const next = toggleIdInList(prev, st.id);
																		setStageAccessories(m => {
																			const copy = { ...m };
																			if (!next.includes(st.id)) {
																				delete copy[st.id];
																			} else {
																				if (!copy[st.id]) copy[st.id] = [];
																			}
																			return copy;
																		});
																		return next;
																	});
															}}
															className="w-full"
														>
															<div className="flex items-center justify-between gap-3">
																<div className="font-black text-slate-900 dark:text-white">{st.name}</div>
																<div className={
																	`text-xs font-black px-3 py-1 rounded-full ${
																		selected
																		? 'bg-emerald-600 text-white'
																		: 'bg-blue-600 text-white'
																}`
																}> {selected ? 'تم الاختيار' : 'اختيار'} </div>
															</div>
														</button>
															{selected && (
																<div className="mt-4 space-y-2">
																	<div className="text-xs font-bold text-slate-600 dark:text-slate-300">الاكسسوارات المستخدمة في هذه المرحلة (اختياري)</div>
																	<div className="space-y-2">
																		{(stageAccessories[st.id] || []).map((r, idx) => (
																			<div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-white/70 dark:bg-slate-900/40 rounded-2xl p-3">
																				<div className="md:col-span-7">
																					<CustomSelect
																						value={r.accessory_id === '' ? '' : String(r.accessory_id)}
																						onChange={(v) => {
																							const val = v === '' ? '' : Number(v);
																							setStageAccessories(prev => ({
																							...prev,
																							[st.id]: (prev[st.id] || []).map((x, i) => i === idx ? { ...x, accessory_id: val } : x)
																						}));
																						}}
																						options={[{ value: '', label: 'اختر اكسسوار' }, ...accessories.map(a => ({ value: String(a.id), label: a.name }))]}
																						className="w-full"
																					/>
																				</div>
																				<div className="md:col-span-3">
																					<input
																						type="number"
																						min={1}
																						value={r.quantity}
																						onChange={(ev) => {
																							const q = ev.target.value === '' ? 1 : Number(ev.target.value);
																							setStageAccessories(prev => ({
																							...prev,
																							[st.id]: (prev[st.id] || []).map((x, i) => i === idx ? { ...x, quantity: q } : x)
																						}));
																						}}
																						className="w-full bg-transparent border-none rounded-2xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
																						placeholder="الكمية"
																					/>
																				</div>
																				<div className="md:col-span-2 flex items-center">
																					<button
																						type="button"
																						onClick={(ev) => {
																							ev.preventDefault();
																							setStageAccessories(prev => ({
																							...prev,
																							[st.id]: (prev[st.id] || []).filter((_, i) => i !== idx)
																						}));
																					}}
																					className="w-full bg-rose-50 text-rose-600 rounded-2xl px-3 py-2 text-sm font-black"
																					>
																					حذف
																					</button>
																				</div>
																			</div>
																		))}
																		<button
																			type="button"
																			onClick={(ev) => {
																				ev.preventDefault();
																				setStageAccessories(prev => ({
																					...prev,
																					[st.id]: [...(prev[st.id] || []), { accessory_id: '', quantity: 1 }]
																				}));
																			}}
																		className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl py-3 text-sm font-black"
																>
																		إضافة اكسسوار
																</button>
															</div>
															</div>
														)}
													</div>
												);
											})}
											</div>
										</div>

										{/* accessories editor is now rendered inside each selected stage card */}
									</>
								) : (
									<>
										<div className="space-y-2 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 mr-2">مكونات المنتج المجمع</label>
											<div className="space-y-2">
												{components.map((c, idx) => (
													<div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
														<CustomSelect
															value={c.product_id === '' ? '' : String(c.product_id)}
															onChange={(v) => {
																const val = v === '' ? '' : Number(v);
																setComponents(prev => prev.map((x, i) => i === idx ? { ...x, product_id: val } : x));
															}}
															options={[{ value: '', label: 'اختر منتج' }, ...individualProducts.map(p => ({ value: String(p.id), label: p.name }))]}
															className="w-full"
														/>
														<input
															type="number"
															min="1"
															value={c.quantity}
															onChange={(ev) => {
																const q = ev.target.value === '' ? 1 : Number(ev.target.value);
																setComponents(prev => prev.map((x, i) => i === idx ? { ...x, quantity: q } : x));
															}}
															className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
															placeholder="العدد"
														/>
														<button
															type="button"
															onClick={() => setComponents(prev => prev.filter((_, i) => i !== idx))}
															className="bg-rose-50 text-rose-600 rounded-2xl px-4 py-3 text-sm font-black"
															disabled={components.length === 1}
														>
															حذف
														</button>
													</div>
												))}
												<button
													type="button"
													onClick={() => setComponents(prev => [...prev, { product_id: '', quantity: 1 }])}
													className="w-full bg-slate-100 dark:bg-slate-800 rounded-2xl py-3 text-sm font-black"
												>
													إضافة مكون
												</button>
											</div>
										</div>
									</>
								)}

								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">الوصف</label>
									<textarea name="description" value={form.description} onChange={handleChange} placeholder="الوصف" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
							</div>
							<button type="submit" className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
								<Save size={18} /> {editingId ? 'حفظ التعديلات' : 'إضافة'}
							</button>
						</form>
					</div>
				</div>
			)}

			{/* Assemble Composite Modal */}
			{isAssembleOpen && (
				<div className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card flex flex-col" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><Layers className="text-blue-500" /> تجميع المنتج</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400">اختر المخزن والمنتج المجمع ثم أدخل الكمية</p>
							</div>
							<button onClick={closeAssembleModal} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق"><X size={24} /></button>
						</div>

						<div className="p-6 overflow-y-auto flex-1 min-h-0">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المخزن</label>
									<CustomSelect
										value={assembleWarehouseId ? String(assembleWarehouseId) : ''}
										onChange={v => setAssembleWarehouseId(Number(v) || 0)}
										options={[{ value: '', label: 'اختر المخزن' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
										className="w-full"
									/>
								</div>

								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المقاس (إجباري)</label>
									<CustomSelect
										value={assembleSizeId ? String(assembleSizeId) : ''}
										onChange={v => setAssembleSizeId(Number(v) || 0)}
										options={[{ value: '', label: 'اختر المقاس' }, ...(((assembleInfo?.allowed_sizes && assembleInfo.allowed_sizes.length > 0) ? assembleInfo.allowed_sizes : sizes) as any[]).map((s: any) => ({ value: String(s.id), label: String(s.name || s.code || s.id) }))]}
										className="w-full"
										title="التجميع لابد أن يكون بنفس المقاس"
									/>
								</div>

								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المنتج المجمع</label>
									<CustomSelect
										value={assembleCompositeId ? String(assembleCompositeId) : ''}
										onChange={v => setAssembleCompositeId(Number(v) || 0)}
										options={[{ value: '', label: 'اختر المنتج المجمع' }, ...((allProducts || []).filter(p => p.type === 'composite').map(p => ({ value: String(p.id), label: `${p.name}${p.code ? ` (${p.code})` : ''}` })))]}
										className="w-full"
									/>
								</div>
							</div>

							<div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="rounded-3xl border border-card card p-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
									<div className="text-xs text-slate-500 dark:text-slate-400 font-bold">الكمية الحالية</div>
									<div className="mt-1 text-2xl font-black dir-ltr">{assembleInfo ? Number(assembleInfo.current_quantity || 0) : '—'}</div>
								</div>
								<div className="rounded-3xl border border-card card p-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
									<div className="text-xs text-slate-500 dark:text-slate-400 font-bold">أقصى كمية يمكن تجميعها</div>
									<div className="mt-1 text-2xl font-black dir-ltr">{assembleInfo ? Number(assembleInfo.max_quantity || 0) : '—'}</div>
								</div>
								<div className="rounded-3xl border border-card card p-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
									<div className="text-xs text-slate-500 dark:text-slate-400 font-bold">تكلفة الوحدة (تقديري)</div>
									<div className="mt-1 text-2xl font-black dir-ltr">{assembleInfo ? Number(assembleInfo.unit_cost || 0).toFixed(2) : '—'}</div>
								</div>
							</div>

							<div className="mt-4 rounded-3xl border border-card card p-5" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
								<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
									<div className="space-y-1">
										<label className="text-xs font-bold text-slate-500 mr-2">الكمية المراد تجميعها</label>
										<input
											type="number"
											min={1}
											max={Math.max(1, Number(assembleInfo?.max_quantity || 1))}
											value={assembleQty}
											onChange={e => setAssembleQty(Number(e.target.value) || 1)}
											className="w-full md:w-[220px] bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm font-black focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white dir-ltr"
										/>
									</div>
									<div className="flex items-center gap-2">
										<button
											onClick={() => fetchAssemblyInfo(assembleCompositeId, assembleWarehouseId)}
											disabled={assembleLoading}
											className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white px-4 py-3 rounded-2xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all disabled:opacity-60"
										>
											تحديث البيانات
										</button>
										<button
											onClick={handleAssemble}
											disabled={assembleLoading || !assembleInfo || Number(assembleInfo.max_quantity || 0) <= 0}
											className="bg-accent text-white px-5 py-3 rounded-2xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60"
											title={assembleInfo && Number(assembleInfo.max_quantity || 0) <= 0 ? 'لا توجد مكونات كافية للتجميع' : ''}
										>
											{assembleLoading ? 'جارٍ التنفيذ...' : 'تنفيذ التجميع'}
										</button>
									</div>
								</div>
							</div>

							<div className="mt-4 overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
								<table className="w-full text-right text-sm">
									<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
										<tr>
											<th className="px-6 py-4 font-bold">المكون</th>
											<th className="px-6 py-4 font-bold">الكود</th>
											<th className="px-6 py-4 font-bold text-center">لكل وحدة</th>
											<th className="px-6 py-4 font-bold text-center">المتاح</th>
											<th className="px-6 py-4 font-bold text-center">المطلوب</th>
											<th className="px-6 py-4 font-bold text-center">المتبقي بعد التجميع</th>
										</tr>
									</thead>
									<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
										{assembleLoading && !assembleInfo ? (
											<tr><td colSpan={6} className="text-center py-10 text-muted">جارٍ التحميل...</td></tr>
										) : !assembleInfo || (assembleInfo.components || []).length === 0 ? (
											<tr><td colSpan={6} className="text-center py-10 text-muted">اختر المخزن والمنتج لعرض المكونات.</td></tr>
										) : (assembleInfo.components || []).map(c => {
											const per = Number(c.per_unit || 0);
											const avail = Number(c.available_quantity || 0);
											const need = per * Math.max(1, Math.floor(Number(assembleQty || 1)));
											const remaining = avail - need;
											const low = remaining < 0;
											return (
												<tr key={c.product_id} className={low ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}>
													<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{c.name || c.product_id}</td>
													<td className="px-6 py-4 text-xs font-mono text-muted">{c.code || '-'}</td>
													<td className="px-6 py-4 text-center font-mono text-xs">{per}</td>
													<td className="px-6 py-4 text-center font-mono text-xs">{avail}</td>
													<td className="px-6 py-4 text-center font-mono text-xs">{need}</td>
													<td className={`px-6 py-4 text-center font-mono text-xs font-black ${low ? 'text-rose-600 dark:text-rose-400' : ''}`}>{remaining}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ProductsPage;