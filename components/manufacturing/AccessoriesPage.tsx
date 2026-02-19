
import React, { useEffect, useState } from 'react';

import { Edit, Plus, Trash2, X, Save, Eye, History, Printer } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../../services/apiConfig';
import { openPrintWindow } from '../../services/printUtils';
import CustomSelect from '../CustomSelect';

type AccessoryRow = {
	id: number;
	name: string;
	code?: string | null;
	color?: string | null;
	quantity?: number | null;
	cost_price?: number | null;
	min_stock?: number | null;
	warehouse_id?: number | null;
	warehouse_count?: number | null;
	one_warehouse_id?: number | null;
	warehouse_names?: string | null;
};

const AccessoriesPage = () => {
	const [accessories, setAccessories] = useState<AccessoryRow[]>([]);
	const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [selectedAccessory, setSelectedAccessory] = useState<AccessoryRow | null>(null);
	const [historyRows, setHistoryRows] = useState<any[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [form, setForm] = useState({
		name: '',
		code: '',
		color: '',
		quantity: 0,
		cost_price: 0,
		min_stock: 0,
		warehouse_id: '' as '' | number
	});
	const [editingId, setEditingId] = useState<number | null>(null);

	const generateAccessoryCode = () => {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
		const rnd = Math.floor(100 + Math.random() * 900);
		return `ACC-${ts}-${rnd}`;
	};

	const fetchAccessories = () => {
		fetch(`${API_BASE_PATH}/api.php?module=accessories&action=getAll`)
			.then(res => res.json())
			.then(data => setAccessories(data.data || []))
			.catch(() => setAccessories([]));
	};

	useEffect(() => {
		fetchAccessories();
		fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`)
			.then(res => res.json())
			.then(data => setWarehouses((data && data.data) ? data.data : []))
			.catch(() => setWarehouses([]));
	}, []);

	const openModal = (accessory: AccessoryRow | null = null) => {
		if (accessory) {
			const oneWarehouseId = (accessory.one_warehouse_id === null || accessory.one_warehouse_id === undefined || accessory.one_warehouse_id === 0)
				? ''
				: Number(accessory.one_warehouse_id);
			setForm({
				name: accessory.name || '',
				code: accessory.code || '',
				color: accessory.color || '',
				// quantity in the modal is per-warehouse; if it exists in a single warehouse, total == that warehouse qty
				quantity: oneWarehouseId ? Number(accessory.quantity || 0) : 0,
				cost_price: Number(accessory.cost_price || 0),
				min_stock: Number(accessory.min_stock || 0),
				warehouse_id: oneWarehouseId
			});
			setEditingId(accessory.id);
		} else {
			setForm({ name: '', code: generateAccessoryCode(), color: '', quantity: 0, cost_price: 0, min_stock: 0, warehouse_id: '' });
			setEditingId(null);
		}
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setForm({ name: '', code: '', color: '', quantity: 0, cost_price: 0, min_stock: 0, warehouse_id: '' });
		setEditingId(null);
	};

	const handleChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement> = e => {
		const { name, value } = e.target;
		if (name === 'warehouse_id') {
			const nextWarehouseId = value === '' ? '' : Number(value);
			setForm(prev => ({ ...prev, warehouse_id: nextWarehouseId }));
			// When editing: load quantity for the selected warehouse
			if (editingId && nextWarehouseId) {
				fetch(`${API_BASE_PATH}/api.php?module=accessories&action=getStockQty&accessory_id=${editingId}&warehouse_id=${nextWarehouseId}`)
					.then(r => r.json())
					.then(js => {
						const q = js && js.success && js.data ? Number(js.data.quantity || 0) : 0;
						setForm(p => ({ ...p, quantity: q }));
					})
					.catch(() => {
						setForm(p => ({ ...p, quantity: 0 }));
					});
			}
			return;
		}
		if (name === 'quantity' || name === 'cost_price' || name === 'min_stock') {
			setForm(prev => ({ ...prev, [name]: value === '' ? 0 : Number(value) }));
			return;
		}
		setForm(prev => ({ ...prev, [name]: value }));
	};

	const handleSubmit: React.FormEventHandler<HTMLFormElement> = e => {
		e.preventDefault();
		if (!form.warehouse_id) {
			Swal.fire('تنبيه', 'يجب اختيار المخزن.', 'warning');
			return;
		}
		const action = editingId ? 'update' : 'add';
		fetch(`${API_BASE_PATH}/api.php?module=accessories&action=${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editingId ? { ...form, id: editingId } : form)
		})
			.then(res => res.json())
			.then(() => {
				closeModal();
				fetchAccessories();
			});
	};

	const handleDelete = (id: number) => {
		Swal.fire({
			title: 'تأكيد الحذف',
			text: 'هل أنت متأكد من حذف هذا الاكسسوار؟',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'نعم',
			cancelButtonText: 'إلغاء'
		}).then(result => {
			if (!result.isConfirmed) return;
			fetch(`${API_BASE_PATH}/api.php?module=accessories&action=delete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			})
				.then(res => res.json())
				.then(() => fetchAccessories());
		});
	};

	const openHistory = (acc: AccessoryRow) => {
		setSelectedAccessory(acc);
		setIsHistoryOpen(true);
		setHistoryRows([]);
		setHistoryLoading(true);
		fetch(`${API_BASE_PATH}/api.php?module=accessories&action=getMovements&accessory_id=${acc.id}`)
			.then(r => r.json())
			.then(js => {
				setHistoryRows((js && js.success && Array.isArray(js.data)) ? js.data : []);
			})
			.catch(() => setHistoryRows([]))
			.finally(() => setHistoryLoading(false));
	};

	const closeHistory = () => {
		setIsHistoryOpen(false);
		setSelectedAccessory(null);
		setHistoryRows([]);
		setHistoryLoading(false);
	};

	const printHistory = () => {
		if (!selectedAccessory) return;
		const title = 'سجل حركة الإكسسوارات';
		const subtitle = `${selectedAccessory.name || ''}${selectedAccessory.code ? ` (${selectedAccessory.code})` : ''}`;
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
		if (t === 'purchase') return { label: 'شراء/استلام', cls: 'bg-emerald-100 text-emerald-700' };
		if (t === 'initial_balance') return { label: 'رصيد افتتاحي', cls: 'bg-blue-100 text-blue-700' };
		if (t === 'adjustment') return { label: 'تسوية', cls: 'bg-amber-100 text-amber-700' };
		if (t === 'manufacturing') return { label: 'تصنيع', cls: 'bg-rose-100 text-rose-700' };
		return { label: 'غير محدد', cls: 'bg-slate-100 text-slate-700' };
	};

	const formatReference = (referenceType: any, referenceId: any) => {
		if (!referenceId) return '-';
		const rt = String(referenceType || '').trim();
		let label = 'مرجع';
		if (rt === 'manufacturing_stage') label = 'مرحلة التصنيع';
		if (rt === 'cutting_order') label = 'أمر قص';
		if (rt === 'purchase') label = 'شراء/استلام';
		return `${label} رقم ${referenceId}`;
	};

	const safeDetails = (notes: any) => {
		if (!notes) return '-';
		if (typeof notes !== 'string') return String(notes);
		const s = notes.trim();
		if (!s) return '-';
		try {
			const obj = JSON.parse(s);
			if (obj && typeof obj === 'object') {
				const o: any = obj;
				const action = String(o.action || '');
				let actionLabel = '';
				if (action === 'assign') actionLabel = 'تعيين';
				if (action === 'transfer') actionLabel = 'نقل';
				if (action === 'finish') actionLabel = 'إنهاء';
				const parts: string[] = [];
				if (o.accessory_name) parts.push(`الإكسسوار: ${o.accessory_name}`);
				if (o.accessory_code) parts.push(`الكود: ${o.accessory_code}`);
				if (o.factory_product_id != null) parts.push(`رقم المنتج: ${o.factory_product_id}`);
				if (o.stage_id != null) parts.push(`رقم المرحلة: ${o.stage_id}`);
				if (o.per_piece != null) parts.push(`لكل قطعة: ${o.per_piece}`);
				if (o.qty != null) parts.push(`الكمية: ${o.qty}`);
				if (o.cutting_order_id != null) parts.push(`أمر قص: ${o.cutting_order_id}`);
				if (o.worker_id != null) parts.push(`العامل: ${o.worker_id}`);
				if (o.from_stage_id != null) parts.push(`من مرحلة: ${o.from_stage_id}`);
				if (o.to_stage_id != null) parts.push(`إلى مرحلة: ${o.to_stage_id}`);
				if (o.from_worker_id != null) parts.push(`من عامل: ${o.from_worker_id}`);
				if (o.to_worker_id != null) parts.push(`إلى عامل: ${o.to_worker_id}`);
				if (actionLabel) parts.push(`الإجراء: ${actionLabel}`);
				if (parts.length) return parts.join(' | ');
				if (o.name) return o.name;
			}
			return '-';
		} catch {
			return s;
		}
	};

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-black">إدارة الاكسسوارات</h2>
				<button
					onClick={() => openModal()}
					className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
				>
					<Plus size={16} /> إضافة اكسسوار
				</button>
			</div>

			<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
				<table className="w-full text-right text-sm">
					<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
						<tr>
							<th className="px-6 py-4 font-bold">الاسم</th>
							<th className="px-6 py-4 font-bold">الكود</th>
							<th className="px-6 py-4 font-bold">المخزن</th>
							<th className="px-6 py-4 font-bold">اللون</th>
							<th className="px-6 py-4 font-bold">سعر التكلفة</th>
							<th className="px-6 py-4 font-bold">الحد الأدنى</th>
							<th className="px-6 py-4 font-bold">الكمية الحالية</th>
							<th className="px-6 py-4 font-bold text-center">تحكم</th>
						</tr>
					</thead>
					<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
						{accessories.length === 0 ? (
							<tr>
								<td colSpan={8} className="text-center py-10 text-muted">لا توجد اكسسوارات مسجلة.</td>
							</tr>
						) : (
							accessories.map(accessory => (
								<tr key={accessory.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
									<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{accessory.name}</td>
									<td className="px-6 py-4 text-xs font-mono text-muted">{accessory.code || '-'}</td>
									<td className="px-6 py-4 text-xs">{(() => {
										const count = Number((accessory as any).warehouse_count || 0);
										const names = (((accessory as any).warehouse_names) || '').toString().trim();
										if (!count) return '-';
										if (names) return names;
										const wid = (accessory as any).one_warehouse_id;
										if (count === 1 && wid) {
											const w = warehouses.find(x => Number(x.id) === Number(wid));
											return w ? w.name : String(wid);
										}
										return 'متعدد';
									})()}</td>
									<td className="px-6 py-4 text-xs">{accessory.color || '-'}</td>
									<td className="px-6 py-4 text-xs font-mono text-muted">{Number(accessory.cost_price || 0)}</td>
									<td className="px-6 py-4 text-xs font-mono">{Number(accessory.min_stock || 0)}</td>
									<td className="px-6 py-4 text-xs font-mono text-muted">{Number(accessory.quantity || 0)}</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center gap-1">
											<button onClick={() => openHistory(accessory)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="عرض حركة المخزون"><Eye size={14} /></button>
											<button onClick={() => openModal(accessory)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors" title="تعديل">
												<Edit size={14} />
											</button>
											<button onClick={() => handleDelete(accessory.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="حذف">
												<Trash2 size={14} />
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Movement History Modal */}
			{isHistoryOpen && selectedAccessory && (
				<div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700 h-[80vh] flex flex-col">
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><History className="text-blue-500" /> سجل حركة المخزون</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400">{selectedAccessory.name} ({selectedAccessory.code || '-'})</p>
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
												<td className="px-4 py-3 text-xs font-mono text-slate-500">{formatReference(m.reference_type, m.reference_id)}</td>
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
					<div className="w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">{editingId ? 'تعديل الاكسسوار' : 'إضافة اكسسوار جديد'}</h3>
							<button onClick={closeModal} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={handleSubmit} className="p-8 text-right">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">اسم الاكسسوار</label>
									<input name="name" value={form.name} onChange={handleChange} placeholder="اسم الاكسسوار" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" required />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكود (تلقائي)</label>
									<input name="code" value={form.code} readOnly placeholder="ACC-..." className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm font-mono focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">المخزن</label>
									<CustomSelect
										value={form.warehouse_id === '' ? '' : String(form.warehouse_id)}
										onChange={v => handleChange({ target: { name: 'warehouse_id', value: v } } as any)}
										options={warehouses.map(w => ({ value: String(w.id), label: w.name }))}
										placeholder="اختر المخزن"
										disabled={false}
										className=""
									/>
									{warehouses.length === 0 && (
										<p className="text-[11px] text-rose-600 mt-1">لا توجد مخازن. أضف مخزنًا أولاً من المخازن.</p>
									)}
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">اللون</label>
									<input name="color" value={form.color} onChange={handleChange} placeholder="اللون" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية الحالية</label>
									<input name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange} placeholder="الكمية الحالية" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الحد الأدنى للمخزون</label>
									<input name="min_stock" type="number" min="0" value={form.min_stock} onChange={handleChange} placeholder="الحد الأدنى" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">سعر التكلفة</label>
									<input name="cost_price" type="number" min="0" value={form.cost_price} onChange={handleChange} placeholder="سعر التكلفة" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
							</div>
							<button type="submit" className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
								<Save size={18} /> {editingId ? 'حفظ التعديلات' : 'إضافة'}
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default AccessoriesPage;
