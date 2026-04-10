import React, { useEffect, useMemo, useState } from 'react';

import { Eye, Plus, X, Save, Printer } from 'lucide-react';
import Swal from 'sweetalert2';
import CustomSelect from '../CustomSelect';
import { API_BASE_PATH } from '../../services/apiConfig';
import { printBarcode } from '../../services/printUtils';

type FabricOption = { id: number; name: string; code?: string | null };
type ProductOption = { id: number; name: string; code?: string | null; type?: string | null };
type WarehouseOption = { id: number; name: string };

type CuttingOrderRow = {
	id: number;
	code: string;
	fabric_id: number;
	fabric_name?: string | null;
	factory_product_id: number;
	product_name?: string | null;
	cut_quantity: number;
	consumption_per_piece: number;
	total_consumption: number;
	available_qty: number;
	in_production_qty: number;
	ready_qty: number;
	created_at?: string | null;
};

type InProductionRow = {
	stage_id: number;
	stage_name: string;
	worker_id: number;
	worker_name: string;
	qty: number;
};

const CuttingStagePage = () => {
	const [fabrics, setFabrics] = useState<FabricOption[]>([]);
	const [products, setProducts] = useState<ProductOption[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
	const [orders, setOrders] = useState<CuttingOrderRow[]>([]);
	const [loading, setLoading] = useState(false);

	const [form, setForm] = useState({
		warehouse_id: 0,
		fabric_id: 0,
		factory_product_id: 0,
		cut_quantity: 1,
		consumption_per_piece: 0,
	});

	const totalConsumption = useMemo(() => {
		const qty = Number.isFinite(form.cut_quantity) ? Number(form.cut_quantity) : 0;
		const cpp = Number.isFinite(form.consumption_per_piece) ? Number(form.consumption_per_piece) : 0;
		return Math.round(qty * Math.max(0, cpp) * 10000) / 10000;
	}, [form.cut_quantity, form.consumption_per_piece]);

	const [isViewOpen, setIsViewOpen] = useState(false);
	const [viewOrder, setViewOrder] = useState<CuttingOrderRow | null>(null);
	const [viewRows, setViewRows] = useState<InProductionRow[]>([]);
	const [viewLoading, setViewLoading] = useState(false);

	const apiUrl = (action: string, extra: string = '') => `${API_BASE_PATH}/api.php?module=cutting_stage&action=${action}${extra}`;

	const loadMeta = async (warehouseId: number = 0) => {
		try {
			const extra = warehouseId > 0 ? `&warehouse_id=${warehouseId}` : '';
			const res = await fetch(apiUrl('getMeta', extra));
			const json = await res.json();
			setWarehouses(json?.data?.warehouses || []);
			setFabrics(json?.data?.fabrics || []);
			setProducts((json?.data?.products || []).filter((p: ProductOption) => (p.type || 'individual') === 'individual'));
		} catch (e) {
			console.error(e);
		}
	};

	const loadOrders = async () => {
		setLoading(true);
		try {
			const res = await fetch(apiUrl('getAll'));
			const json = await res.json();
			setOrders(json?.data || []);
		} catch (e) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر تحميل أوامر القص' });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadMeta();
		loadOrders();
	}, []);

	useEffect(() => {
		if (form.warehouse_id > 0) {
			loadMeta(form.warehouse_id);
			setForm(f => ({ ...f, fabric_id: 0 }));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [form.warehouse_id]);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.warehouse_id || !form.fabric_id || !form.factory_product_id || !form.cut_quantity) {
			Swal.fire({ icon: 'warning', title: 'بيانات ناقصة', text: 'اختر القماش والمنتج وأدخل الكمية' });
			return;
		}
		try {
			const res = await fetch(apiUrl('add'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					warehouse_id: form.warehouse_id,
					fabric_id: form.fabric_id,
					factory_product_id: form.factory_product_id,
					cut_quantity: form.cut_quantity,
					consumption_per_piece: form.consumption_per_piece,
				}),
			});
			const json = await res.json();
			if (!json?.success) {
				throw new Error(json?.message || 'Failed');
			}
			closeCreate();
			Swal.fire({ icon: 'success', title: 'تم', text: `تم إنشاء أمر القص: ${json?.data?.code || ''}` });
			setForm({ warehouse_id: 0, fabric_id: 0, factory_product_id: 0, cut_quantity: 1, consumption_per_piece: 0 });
			await loadOrders();
		} catch (err: any) {
			Swal.fire({ icon: 'error', title: 'خطأ', text: err?.message || 'تعذر إنشاء أمر القص' });
		}
	};

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const openCreate = () => setIsCreateOpen(true);
	const closeCreate = () => setIsCreateOpen(false);

	const openView = async (order: CuttingOrderRow) => {
		setViewOrder(order);
		setIsViewOpen(true);
		setViewRows([]);
		setViewLoading(true);
		try {
			const res = await fetch(apiUrl('getProduction', `&id=${order.id}`));
			const json = await res.json();
			setViewRows(json?.data?.rows || []);
		} catch (e) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر تحميل بيانات التصنيع الحالية' });
		} finally {
			setViewLoading(false);
		}
	};

	const closeView = () => {
		setIsViewOpen(false);
		setViewOrder(null);
		setViewRows([]);
		setViewLoading(false);
	};

	const getRowTintClass = (o: CuttingOrderRow) => {
		const a = Math.max(0, Number(o.available_qty || 0));
		const p = Math.max(0, Number(o.in_production_qty || 0));
		const r = Math.max(0, Number(o.ready_qty || 0));

		const hasA = a > 0;
		const hasP = p > 0;
		const hasR = r > 0;
		const key = `${hasA ? 1 : 0}${hasP ? 1 : 0}${hasR ? 1 : 0}`;

		switch (key) {
			case '100':
				// كل الكمية متاح للإنتاج
				return 'bg-sky-50/60 dark:bg-sky-900/10';
			case '110':
				// بين متاح للإنتاج و في الإنتاج
				return 'bg-indigo-50/60 dark:bg-indigo-900/10';
			case '111':
				// بين متاح للإنتاج و في الإنتاج و منتج جاهز
				return 'bg-amber-50/60 dark:bg-amber-900/10';
			case '101':
				// بين متاح للإنتاج و منتج جاهز
				return 'bg-teal-50/60 dark:bg-teal-900/10';
			case '011':
				// بين في الإنتاج و منتج جاهز
				return 'bg-rose-50/60 dark:bg-rose-900/10';
			case '010':
				// كل الكمية في الإنتاج
				return 'bg-violet-50/60 dark:bg-violet-900/10';
			case '001':
				// كل الكمية منتج جاهز
				return 'bg-emerald-50/60 dark:bg-emerald-900/10';
			default:
				return '';
		}
	};

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-black">مرحلة القص</h2>
				<button onClick={openCreate} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
					<Plus size={16} /> إنشاء أمر قص
				</button>
			</div>

			{isCreateOpen && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">إنشاء أمر قص</h3>
							<button onClick={closeCreate} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={handleCreate} className="p-6 text-right">
							<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">المخزن</label>
									<CustomSelect
										value={String(form.warehouse_id || 0)}
										onChange={v => setForm(f => ({ ...f, warehouse_id: Number(v || 0) }))}
										options={[{ value: '0', label: 'اختر المخزن' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
										className="w-full text-sm"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">القماش</label>
									<CustomSelect
										value={String(form.fabric_id || 0)}
										onChange={v => setForm(f => ({ ...f, fabric_id: Number(v || 0) }))}
										options={[{ value: '0', label: form.warehouse_id ? 'اختر القماش' : 'اختر المخزن أولاً' }, ...fabrics.map(f => ({ value: String(f.id), label: `${f.name}${f.code ? ` (${f.code})` : ''}` }))]}
										className="w-full text-sm"
										required
										disabled={!form.warehouse_id}
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">المنتج</label>
									<CustomSelect
										value={String(form.factory_product_id || 0)}
										onChange={v => setForm(f => ({ ...f, factory_product_id: Number(v || 0) }))}
										options={[{ value: '0', label: 'اختر المنتج' }, ...products.map(p => ({ value: String(p.id), label: `${p.name}${p.code ? ` (${p.code})` : ''}` }))]}
										className="w-full text-sm"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية المراد قصها</label>
									<input
										type="number"
										min={1}
										value={form.cut_quantity}
										onChange={e => setForm(f => ({ ...f, cut_quantity: Math.max(1, Number(e.target.value || 1)) }))}
										className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">استهلاك القطعة</label>
									<input
										type="number"
										min={0}
										step="0.0001"
										value={form.consumption_per_piece}
										onChange={e => setForm(f => ({ ...f, consumption_per_piece: Math.max(0, Number(e.target.value || 0)) }))}
										className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">إجمالي الاستهلاك</label>
									<input
										disabled
										value={totalConsumption}
										className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300"
									/>
								</div>
							</div>
							<button type="submit" className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
								<Save size={18} /> إنشاء أمر قص
							</button>
						</form>
					</div>
				</div>
			)}

			<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
				<table className="w-full text-right text-sm">
					<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
						<tr>
							<th className="px-6 py-4 font-bold">كود القص</th>
							<th className="px-6 py-4 font-bold">القماش</th>
							<th className="px-6 py-4 font-bold">المنتج</th>
							<th className="px-6 py-4 font-bold">الكمية</th>
							<th className="px-6 py-4 font-bold">استهلاك/قطعة</th>
							<th className="px-6 py-4 font-bold">إجمالي الاستهلاك</th>
							<th className="px-6 py-4 font-bold">متاح للإنتاج</th>
							<th className="px-6 py-4 font-bold">في الإنتاج</th>
							<th className="px-6 py-4 font-bold">منتج جاهز</th>
							<th className="px-6 py-4 font-bold text-center">عرض</th>
						</tr>
					</thead>
					<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
						{loading ? (
							<tr>
								<td colSpan={10} className="text-center py-10 text-muted">جارٍ التحميل...</td>
							</tr>
						) : orders.length === 0 ? (
							<tr>
								<td colSpan={10} className="text-center py-10 text-muted">لا توجد أوامر قص.</td>
							</tr>
						) : (
							orders.map(o => (
								<tr
									key={o.id}
									className={
										getRowTintClass(o) +
										' hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors'
									}
								>
									<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{o.code}</td>
									<td className="px-6 py-4 text-xs">{o.fabric_name || '-'}</td>
									<td className="px-6 py-4 text-xs">{o.product_name || '-'}</td>
									<td className="px-6 py-4 font-bold">{o.cut_quantity}</td>
									<td className="px-6 py-4">{Number(o.consumption_per_piece || 0).toFixed(4)}</td>
									<td className="px-6 py-4 font-bold">{Number(o.total_consumption || 0).toFixed(4)}</td>
									<td className="px-6 py-4 font-bold">{o.available_qty}</td>
									<td className="px-6 py-4 font-bold">{o.in_production_qty}</td>
									<td className="px-6 py-4 font-bold">{o.ready_qty}</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center gap-2">
											<button
												onClick={() => openView(o)}
												className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
												title="عرض التصنيع الحالي"
											>
												<Eye size={16} /> عرض
											</button>
											<button
												onClick={() => printBarcode(o.code, 'باركود أمر القص')}
												className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
												title="طباعة الكود"
											>
												<Printer size={16} /> طباعة الكود
											</button>
										</div>
									</td>
								</tr>
							))
						)
						}
					</tbody>
				</table>
			</div>

			{isViewOpen && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">
								التصنيع الحالي {viewOrder?.code ? `- ${viewOrder.code}` : ''}
							</h3>
							<button onClick={closeView} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<div className="p-6">
							{viewLoading ? (
								<div className="text-center py-10 text-muted">جارٍ التحميل...</div>
							) : viewRows.length === 0 ? (
								<div className="text-center py-10 text-muted">لا توجد كميات قيد التصنيع حالياً لهذا الأمر.</div>
							) : (
								<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
									<table className="w-full text-right text-sm">
										<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
											<tr>
												<th className="px-6 py-4 font-bold">العامل</th>
												<th className="px-6 py-4 font-bold">المرحلة</th>
												<th className="px-6 py-4 font-bold">الكمية</th>
											</tr>
										</thead>
										<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
											{viewRows.map((r, idx) => (
												<tr key={`${r.stage_id}-${r.worker_id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
													<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{r.worker_name || '-'}</td>
													<td className="px-6 py-4 text-xs">{r.stage_name || '-'}</td>
													<td className="px-6 py-4 font-bold">{Number(r.qty || 0)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CuttingStagePage;