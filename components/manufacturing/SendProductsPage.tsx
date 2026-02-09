import React, { useEffect, useMemo, useState } from 'react';

import { Eye, Plus, Save, Trash2, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../../services/apiConfig';

type Warehouse = { id: number; name: string };
type MetaColor = { id: number; name: string; code?: string | null };
type MetaSize = { id: number; name: string; code?: string | null };

type AvailableProduct = {
	id: number;
	name: string;
	code?: string | null;
	available_quantity: number;
};

type DispatchOrderRow = {
	id: number;
	code?: string | null;
	from_warehouse_id: number;
	to_warehouse_id: number;
	from_warehouse_name?: string | null;
	to_warehouse_name?: string | null;
	status: 'pending' | 'confirmed' | 'mismatch' | string;
	notes?: string | null;
	created_at?: string;
	created_by_name?: string | null;
	confirmed_at?: string | null;
	confirmed_by_name?: string | null;
	total_sent?: number;
	total_received?: number;
};

type DispatchOrderItem = {
	id: number;
	order_id: number;
	factory_product_id: number;
	product_name?: string | null;
	product_code?: string | null;
	size_id?: number;
	size_name?: string | null;
	size_code?: string | null;
	color?: string | null;
	qty_sent: number;
	qty_received?: number | null;
};

type LineItem = { factory_product_id: number; size_id: number; color: string; qty_sent: number };

const SendProductsPage = () => {
	const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
	const [fromWarehouseId, setFromWarehouseId] = useState<number>(0);
	const [toWarehouseId, setToWarehouseId] = useState<number>(0);
	const [canChangeFromWarehouse, setCanChangeFromWarehouse] = useState<boolean>(true);
	const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
	const [metaColors, setMetaColors] = useState<MetaColor[]>([]);
	const [metaSizes, setMetaSizes] = useState<MetaSize[]>([]);

	const [orders, setOrders] = useState<DispatchOrderRow[]>([]);

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [notes, setNotes] = useState('');
	const [barcodeToAdd, setBarcodeToAdd] = useState('');
	const [selectedProductId, setSelectedProductId] = useState<number>(0);
	const [selectedSizeId, setSelectedSizeId] = useState<number>(0);
	const [selectedColor, setSelectedColor] = useState<string>('');
	const [selectedQty, setSelectedQty] = useState<number>(1);
	const [items, setItems] = useState<LineItem[]>([]);

	const [isDetailsOpen, setIsDetailsOpen] = useState(false);
	const [details, setDetails] = useState<{ order: DispatchOrderRow | null; items: DispatchOrderItem[] }>({ order: null, items: [] });

	const statusLabel = (s: string) => {
		const v = (s || '').trim();
		if (v === 'pending') return { label: 'معلقة', cls: 'bg-amber-100 text-amber-700' };
		if (v === 'confirmed') return { label: 'ناجحة', cls: 'bg-emerald-100 text-emerald-700' };
		if (v === 'mismatch') return { label: 'اختلاف', cls: 'bg-rose-100 text-rose-700' };
		return { label: v || '-', cls: 'bg-slate-100 text-slate-700' };
	};

	const fetchMeta = async (fromId?: number) => {
		const q = fromId ? `&from_warehouse_id=${encodeURIComponent(String(fromId))}` : '';
		const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=getMetaV2${q}`);
		const json = await res.json();
		const data = json?.data || {};
		setWarehouses(Array.isArray(data.warehouses) ? data.warehouses : []);
		setCanChangeFromWarehouse(Boolean(data.can_change_from_warehouse));
		const defFrom = Number(data.from_warehouse_id || 0);
		if (defFrom && !fromWarehouseId) setFromWarehouseId(defFrom);
		setAvailableProducts(Array.isArray(data.products) ? data.products : []);
		setMetaColors(Array.isArray(data.colors) ? data.colors : []);
		setMetaSizes(Array.isArray(data.sizes) ? data.sizes : []);
	};

	const fetchOrders = async () => {
		const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=listOrdersV2`);
		const json = await res.json();
		setOrders(json?.data || []);
	};

	useEffect(() => {
		fetchMeta().catch(() => {
			setWarehouses([]);
			setAvailableProducts([]);
		});
		fetchOrders().catch(() => setOrders([]));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!fromWarehouseId) return;
		fetchMeta(fromWarehouseId).catch(() => setAvailableProducts([]));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fromWarehouseId]);

	const productById = useMemo(() => {
		const m = new Map<number, AvailableProduct>();
		availableProducts.forEach(p => m.set(Number(p.id), p));
		return m;
	}, [availableProducts]);

	const totalSentForProduct = (pid: number) => items.filter(i => i.factory_product_id === pid).reduce((sum, i) => sum + (Number(i.qty_sent) || 0), 0);
	const normalizeColor = (c: string) => (c || '').trim();
	const itemKey = (pid: number, sid: number, color: string) => `${pid}|${sid}|${normalizeColor(color).toLowerCase()}`;

	const addLineItem = () => {
		const pid = Number(selectedProductId || 0);
		const sid = Number(selectedSizeId || 0);
		const color = normalizeColor(selectedColor);
		const qty = Number(selectedQty || 0);
		if (!pid || !sid || !color || qty <= 0) {
			Swal.fire({ title: 'بيانات غير صحيحة', text: 'اختر منتجًا وحدد المقاس واللون والكمية بشكل صحيح.', icon: 'warning' });
			return;
		}
		const p = productById.get(pid);
		const available = Number(p?.available_quantity || 0);
		const already = totalSentForProduct(pid);
		if (qty + already > available) {
			Swal.fire({ title: 'الكمية أكبر من المتاح', text: `المتاح: ${available} — تم اختيار: ${already}`, icon: 'warning' });
			return;
		}
		// Merge by product+size+color
		setItems(prev => {
			const k = itemKey(pid, sid, color);
			const idx = prev.findIndex(x => itemKey(x.factory_product_id, x.size_id, x.color) === k);
			if (idx >= 0) {
				const next = [...prev];
				next[idx] = { ...next[idx], qty_sent: Number(next[idx].qty_sent || 0) + qty };
				return next;
			}
			return [...prev, { factory_product_id: pid, size_id: sid, color, qty_sent: qty }];
		});
		setSelectedQty(1);
	};

	const addByBarcode = async () => {
		const bc = (barcodeToAdd || '').trim();
		if (!bc) return;
		if (!fromWarehouseId) {
			Swal.fire({ title: 'حدد المخزن', text: 'اختر المخزن المرسل منه أولاً قبل الإضافة بالباركود.', icon: 'warning' });
			return;
		}
		try {
			const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=resolveBarcodeV2&from_warehouse_id=${encodeURIComponent(String(fromWarehouseId))}&barcode=${encodeURIComponent(bc)}`);
			const js = await res.json();
			if (!js?.success) {
				Swal.fire({ title: 'باركود غير صحيح', text: js?.message || 'تعذر قراءة الباركود.', icon: 'error' });
				return;
			}
			const d = js.data || {};
			const pid = Number(d.factory_product_id || 0);
			let sid = Number(d.size_id || 0);
			let color = normalizeColor(String(d.color || ''));
			const needsVariant = Boolean(d.needs_variant) || (!sid || !color);
			if (!pid) {
				Swal.fire({ title: 'بيانات ناقصة', text: 'تعذر تحديد المنتج من الباركود.', icon: 'warning' });
				return;
			}
			if (needsVariant) {
				const sizesOptions = metaSizes
					.map(s => `<option value="${s.id}">${String(s.name || '')}${s.code ? ` (${String(s.code)})` : ''}</option>`)
					.join('');
				const colorsOptions = metaColors
					.map(c => `<option value="${String(c.name || '')}">${String(c.name || '')}${c.code ? ` (${String(c.code)})` : ''}</option>`)
					.join('');

				const result = await Swal.fire({
					title: 'اختر المقاس واللون',
					html: `
						<div style="text-align:right">
							<div style="font-weight:700;margin-bottom:6px">${d.product_name ? String(d.product_name) : 'المنتج'}</div>
							<div style="font-size:12px;color:#6b7280;margin-bottom:12px">الكود: <span style="font-family:monospace">${String(d.product_code || bc)}</span></div>
							<label style="display:block;font-size:12px;font-weight:700;margin:6px 0">المقاس</label>
							<select id="swal-size" class="swal2-input" style="width:100%">
								<option value="">اختر المقاس</option>
								${sizesOptions}
							</select>
							<label style="display:block;font-size:12px;font-weight:700;margin:6px 0">اللون</label>
							<select id="swal-color" class="swal2-input" style="width:100%">
								<option value="">اختر اللون</option>
								${colorsOptions}
							</select>
						</div>
					`,
					focusConfirm: false,
					showCancelButton: true,
					confirmButtonText: 'إضافة',
					cancelButtonText: 'إلغاء',
					didOpen: () => {
						const popup = Swal.getPopup();
						const sizeSel = popup?.querySelector('#swal-size') as HTMLSelectElement | null;
						const colorSel = popup?.querySelector('#swal-color') as HTMLSelectElement | null;
						if (sizeSel && selectedSizeId) sizeSel.value = String(selectedSizeId);
						if (colorSel && selectedColor) colorSel.value = String(selectedColor);
					},
					preConfirm: () => {
						const popup = Swal.getPopup();
						const sizeSel = popup?.querySelector('#swal-size') as HTMLSelectElement | null;
						const colorSel = popup?.querySelector('#swal-color') as HTMLSelectElement | null;
						const sidVal = Number(sizeSel?.value || 0);
						const colorVal = normalizeColor(String(colorSel?.value || ''));
						if (!sidVal || !colorVal) {
							Swal.showValidationMessage('اختر المقاس واللون');
							return null;
						}
						return { sidVal, colorVal };
					},
				});
				if (!result.isConfirmed || !result.value) return;
				sid = Number(result.value.sidVal || 0);
				color = normalizeColor(String(result.value.colorVal || ''));
				if (sid) setSelectedSizeId(sid);
				if (color) setSelectedColor(color);
			}

			if (!pid || !sid || !color) {
				Swal.fire({ title: 'بيانات ناقصة', text: 'تعذر استخراج المقاس/اللون من الباركود.', icon: 'warning' });
				return;
			}
			const p = productById.get(pid);
			const available = Number(p?.available_quantity || d.available_quantity || 0);
			const already = totalSentForProduct(pid);
			if (already + 1 > available) {
				Swal.fire({ title: 'الكمية أكبر من المتاح', text: `المتاح: ${available} — تم اختيار: ${already}`, icon: 'warning' });
				return;
			}
			setItems(prev => {
				const k = itemKey(pid, sid, color);
				const idx = prev.findIndex(x => itemKey(x.factory_product_id, x.size_id, x.color) === k);
				if (idx >= 0) {
					const next = [...prev];
					next[idx] = { ...next[idx], qty_sent: Number(next[idx].qty_sent || 0) + 1 };
					return next;
				}
				return [...prev, { factory_product_id: pid, size_id: sid, color, qty_sent: 1 }];
			});
			setBarcodeToAdd('');
		} catch {
			Swal.fire({ title: 'فشل', text: 'تعذر الإضافة بالباركود.', icon: 'error' });
		}
	};

	const removeLineItem = (idx: number) => {
		setItems(prev => prev.filter((_, i) => i !== idx));
	};

	const openCreate = () => {
		setNotes('');
		setBarcodeToAdd('');
		setToWarehouseId(0);
		setSelectedProductId(0);
		setSelectedSizeId(0);
		setSelectedColor('');
		setSelectedQty(1);
		setItems([]);
		setIsCreateOpen(true);
	};

	const closeCreate = () => setIsCreateOpen(false);

	const createOrder = async () => {
		if (!fromWarehouseId || !toWarehouseId) {
			Swal.fire({ title: 'بيانات ناقصة', text: 'حدد المخزن المرسل منه والمخزن المرسل إليه.', icon: 'warning' });
			return;
		}
		if (fromWarehouseId === toWarehouseId) {
			Swal.fire({ title: 'غير مسموح', text: 'لا يمكن الإرسال إلى نفس المخزن.', icon: 'warning' });
			return;
		}
		if (items.length === 0) {
			Swal.fire({ title: 'لا توجد منتجات', text: 'أضف منتجًا واحدًا على الأقل.', icon: 'warning' });
			return;
		}

		const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=createOrderV2`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from_warehouse_id: fromWarehouseId,
				to_warehouse_id: toWarehouseId,
				notes: notes,
				items
			})
		});
		const json = await res.json();
		if (!json?.success) {
			Swal.fire({ title: 'فشل الإرسال', text: json?.message || 'حدث خطأ غير متوقع.', icon: 'error' });
			return;
		}
		closeCreate();
		await fetchOrders();
		Swal.fire({ title: 'تم إنشاء الإرسال', text: `رقم الإرسال: ${json?.data?.code || json?.data?.order_id || ''}`, icon: 'success' });
	};

	const openDetails = async (orderId: number) => {
		const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=getOrderV2&order_id=${encodeURIComponent(String(orderId))}`);
		const json = await res.json();
		if (!json?.success) {
			Swal.fire({ title: 'تعذر تحميل التفاصيل', text: json?.message || 'حدث خطأ.', icon: 'error' });
			return;
		}
		setDetails({ order: json?.data?.order || null, items: json?.data?.items || [] });
		setIsDetailsOpen(true);
	};

	const closeDetails = () => {
		setIsDetailsOpen(false);
		setDetails({ order: null, items: [] });
	};

	const cancelOrder = async (order: DispatchOrderRow) => {
		const result = await Swal.fire({
			title: 'تأكيد الإلغاء',
			text: 'هل أنت متأكد من إلغاء عملية الإرسال؟',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'نعم',
			cancelButtonText: 'إلغاء'
		});
		if (!result.isConfirmed) return;
		const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=cancelOrderV2`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ order_id: order.id })
		});
		const json = await res.json();
		if (!json?.success) {
			Swal.fire({ title: 'فشل الإلغاء', text: json?.message || 'حدث خطأ.', icon: 'error' });
			return;
		}
		await fetchOrders();
		Swal.fire({ title: 'تم الإلغاء', icon: 'success' });
	};

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-black">إرسال إلى المبيعات</h2>
				<button onClick={openCreate} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
					<Plus size={16} /> إنشاء إرسال جديد
				</button>
			</div>

			<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
				<table className="w-full text-right text-sm">
					<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
						<tr>
							<th className="px-6 py-4 font-bold">رقم الإرسال</th>
							<th className="px-6 py-4 font-bold">من مخزن</th>
							<th className="px-6 py-4 font-bold">إلى مخزن</th>
							<th className="px-6 py-4 font-bold">الحالة</th>
							<th className="px-6 py-4 font-bold">المرسل</th>
							<th className="px-6 py-4 font-bold">المستلم</th>
							<th className="px-6 py-4 font-bold">الكميات (مرسل/مستلم)</th>
							<th className="px-6 py-4 font-bold text-center">تحكم</th>
						</tr>
					</thead>
					<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
						{orders.length === 0 ? (
							<tr>
								<td colSpan={8} className="text-center py-10 text-muted">لا توجد عمليات إرسال مسجلة.</td>
							</tr>
						) : (
							orders.map(o => {
								const st = statusLabel(o.status);
								const sent = Number(o.total_sent || 0);
								const received = Number(o.total_received || 0);
								return (
									<tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
										<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{o.code || `#${o.id}`}</td>
										<td className="px-6 py-4 text-xs">{o.from_warehouse_name || o.from_warehouse_id}</td>
										<td className="px-6 py-4 text-xs">{o.to_warehouse_name || o.to_warehouse_id}</td>
										<td className="px-6 py-4"><span className={`px-2 py-1 rounded-lg text-xs font-bold ${st.cls}`}>{st.label}</span></td>
										<td className="px-6 py-4 text-xs">{o.created_by_name || '-'}</td>
										<td className="px-6 py-4 text-xs">{o.confirmed_by_name || '-'}</td>
										<td className="px-6 py-4 text-xs font-mono text-muted">{sent} / {received}</td>
										<td className="px-6 py-4">
											<div className="flex items-center justify-center gap-1">
												<button onClick={() => openDetails(o.id)} className="p-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" title="عرض التفاصيل">
													<Eye size={14} />
												</button>
												{o.status === 'pending' && (
													<button onClick={() => cancelOrder(o)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="إلغاء">
														<Trash2 size={14} />
													</button>
												)}
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			{isCreateOpen && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">إنشاء إرسال إلى المبيعات</h3>
							<button onClick={closeCreate} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق"><X size={24} /></button>
						</div>
						<div className="p-8 text-right">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المخزن المرسل منه</label>
									<select value={fromWarehouseId || ''} onChange={e => setFromWarehouseId(Number(e.target.value) || 0)} disabled={!canChangeFromWarehouse} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white">
										<option value="">اختر المخزن</option>
										{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
									</select>
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المخزن المرسل إليه (المبيعات)</label>
									<select value={toWarehouseId || ''} onChange={e => setToWarehouseId(Number(e.target.value) || 0)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white">
										<option value="">اختر المخزن</option>
										{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
									</select>
								</div>
									<div className="space-y-1">
										<label className="text-xs font-bold text-slate-500 mr-2">ملاحظات</label>
										<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
									</div>
									<div className="space-y-1">
										<label className="text-xs font-bold text-slate-500 mr-2">إضافة بالباركود</label>
										<input
											value={barcodeToAdd}
											onChange={e => setBarcodeToAdd(e.target.value)}
											onKeyDown={e => {
												if (e.key === 'Enter') {
													e.preventDefault();
													addByBarcode().catch(() => null);
												}
											}}
											placeholder="اقرأ الباركود ثم Enter"
											className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
										/>
									</div>
							</div>

							<div className="mt-6 rounded-3xl border border-card overflow-hidden">
								<div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 border-b dark:border-slate-700">
									<div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
										<div className="md:col-span-2 space-y-1">
											<label className="text-xs font-bold text-slate-500 mr-2">المنتج (من المخزن المرسل منه)</label>
											<select value={selectedProductId || ''} onChange={e => setSelectedProductId(Number(e.target.value) || 0)} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white">
												<option value="">اختر المنتج</option>
												{availableProducts.map(p => (
													<option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''} — المتاح: {p.available_quantity}</option>
												))}
											</select>
										</div>
											<div className="space-y-1">
												<label className="text-xs font-bold text-slate-500 mr-2">المقاس</label>
												<select value={selectedSizeId || ''} onChange={e => setSelectedSizeId(Number(e.target.value) || 0)} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white">
													<option value="">اختر المقاس</option>
													{metaSizes.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
												</select>
											</div>
										<div className="space-y-1">
												<label className="text-xs font-bold text-slate-500 mr-2">اللون</label>
												<select value={selectedColor} onChange={e => setSelectedColor(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white">
													<option value="">اختر اللون</option>
													{metaColors.map(c => <option key={c.id} value={c.name}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
												</select>
										</div>
											<div className="space-y-1">
												<label className="text-xs font-bold text-slate-500 mr-2">الكمية</label>
												<input type="number" value={selectedQty} min={1} onChange={e => setSelectedQty(Number(e.target.value) || 0)} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
											</div>
											<button onClick={addLineItem} className="md:col-span-4 w-full bg-blue-600 text-white py-3 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
											<Plus size={16} /> إضافة
										</button>
									</div>
								</div>
								<div className="p-4">
									<table className="w-full text-right text-sm">
										<thead className="text-muted border-b dark:border-slate-700">
											<tr>
												<th className="py-2 px-2 font-bold">المنتج</th>
													<th className="py-2 px-2 font-bold">المقاس</th>
													<th className="py-2 px-2 font-bold">اللون</th>
												<th className="py-2 px-2 font-bold">الكمية المرسلة</th>
												<th className="py-2 px-2 font-bold text-center">تحكم</th>
											</tr>
										</thead>
										<tbody className="divide-y dark:divide-slate-700">
											{items.length === 0 ? (
													<tr><td colSpan={5} className="py-6 text-center text-muted">لم يتم إضافة منتجات بعد.</td></tr>
											) : (
												items.map((it, idx) => {
													const p = productById.get(it.factory_product_id);
														const sizeName = metaSizes.find(s => Number(s.id) === Number(it.size_id))?.name || String(it.size_id);
													return (
														<tr key={`${it.factory_product_id}-${idx}`}>
															<td className="py-3 px-2 text-xs font-bold text-slate-800 dark:text-white">{p ? `${p.name}${p.code ? ` (${p.code})` : ''}` : it.factory_product_id}</td>
																<td className="py-3 px-2 text-xs">{sizeName}</td>
																<td className="py-3 px-2 text-xs">{it.color}</td>
															<td className="py-3 px-2 text-xs font-mono text-muted">{it.qty_sent}</td>
															<td className="py-3 px-2 text-center">
																<button onClick={() => removeLineItem(idx)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="حذف"><Trash2 size={14} /></button>
															</td>
														</tr>
													);
												})
											)}
										</tbody>
									</table>
								</div>
							</div>

							<button onClick={() => createOrder().catch(() => Swal.fire({ title: 'فشل', text: 'تعذر إنشاء الإرسال.', icon: 'error' }))} className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
								<Save size={18} /> حفظ (معلقة لحين الاستلام)
							</button>
						</div>
					</div>
				</div>
			)}

			{isDetailsOpen && details.order && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white">تفاصيل الإرسال: {details.order.code || `#${details.order.id}`}</h3>
								<div className="text-xs text-muted mt-1">من: {details.order.from_warehouse_name || details.order.from_warehouse_id} — إلى: {details.order.to_warehouse_name || details.order.to_warehouse_id}</div>
							</div>
							<button onClick={closeDetails} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق"><X size={24} /></button>
						</div>
						<div className="p-8 text-right">
							<div className="mb-4">{(() => { const st = statusLabel(details.order!.status); return <span className={`px-3 py-1 rounded-lg text-xs font-bold ${st.cls}`}>{st.label}</span>; })()}</div>
							<div className="overflow-x-auto rounded-3xl border border-card">
								<table className="w-full text-right text-sm">
									<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
										<tr>
											<th className="px-6 py-4 font-bold">المنتج</th>
											<th className="px-6 py-4 font-bold">المقاس</th>
											<th className="px-6 py-4 font-bold">اللون</th>
											<th className="px-6 py-4 font-bold">المرسل</th>
											<th className="px-6 py-4 font-bold">المستلم</th>
											<th className="px-6 py-4 font-bold">الفرق</th>
										</tr>
									</thead>
									<tbody className="divide-y dark:divide-slate-700">
										{details.items.map(it => {
											const sent = Number(it.qty_sent || 0);
											const receivedVal = it.qty_received === null || it.qty_received === undefined ? null : Number(it.qty_received);
											const received = receivedVal === null ? null : Number.isFinite(receivedVal) ? receivedVal : null;
											const diff = received === null ? null : sent - received;
											return (
												<tr key={it.id}>
													<td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-white">{it.product_name || it.factory_product_id}{it.product_code ? ` (${it.product_code})` : ''}</td>
													<td className="px-6 py-4 text-xs">{it.size_name || it.size_id || '-'}</td>
													<td className="px-6 py-4 text-xs">{it.color || '-'}</td>
													<td className="px-6 py-4 text-xs font-mono text-muted">{sent}</td>
													<td className="px-6 py-4 text-xs font-mono text-muted">{received === null ? '-' : received}</td>
													<td className="px-6 py-4 text-xs font-mono text-muted">{diff === null ? '-' : diff}</td>
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

export default SendProductsPage;
