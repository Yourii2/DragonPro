import React, { useEffect, useState } from 'react';

import { Plus, Edit, Trash2, X, Save, Eye, History, Printer } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../../services/apiConfig';
import { openPrintWindow } from '../../services/printUtils';
import CustomSelect from '../CustomSelect';

const FabricsPage = () => {
	const [fabrics, setFabrics] = useState([]);
	const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [selectedFabric, setSelectedFabric] = useState<any>(null);
	const [historyRows, setHistoryRows] = useState<any[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [form, setForm] = useState({ name: '', code: '', color: '', quantity: 0, cost_price: 0, min_stock: 0, warehouse_id: '' as '' | number });
	const [editingId, setEditingId] = useState(null);

	const generateFabricCode = () => {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
		const rnd = Math.floor(100 + Math.random() * 900);
		return `FAB-${ts}-${rnd}`;
	};

	useEffect(() => {
		fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=getAll`)
			.then(res => res.json())
			.then(data => setFabrics(data.data || []));

		fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`)
			.then(res => res.json())
			.then(data => setWarehouses((data && data.data) ? data.data : []))
			.catch(() => setWarehouses([]));
	}, []);

	const openModal = (fabric = null) => {
		if (fabric) {
			const oneWarehouseId = (fabric.one_warehouse_id === null || fabric.one_warehouse_id === undefined || fabric.one_warehouse_id === '')
				? ''
				: Number(fabric.one_warehouse_id);
			setForm({
				name: fabric.name || '',
				code: fabric.code || '',
				color: fabric.color || '',
				// quantity in the modal is per-warehouse; if the fabric exists in a single warehouse, total == that warehouse qty
				quantity: oneWarehouseId ? Number(fabric.quantity || 0) : 0,
				cost_price: Number(fabric.cost_price || 0),
				min_stock: Number(fabric.min_stock || 0),
				warehouse_id: oneWarehouseId
			});
			setEditingId(fabric.id);
		} else {
			setForm({ name: '', code: generateFabricCode(), color: '', quantity: 0, cost_price: 0, min_stock: 0, warehouse_id: '' });
			setEditingId(null);
		}
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setForm({ name: '', code: '', color: '', quantity: 0, cost_price: 0, min_stock: 0, warehouse_id: '' });
		setEditingId(null);
	};

	const handleChange = e => {
		const { name, value } = e.target;
		if (name === 'warehouse_id') {
			const nextWarehouseId = value === '' ? '' : Number(value);
			setForm(f => ({ ...f, warehouse_id: nextWarehouseId }));
			// When editing: load quantity for the selected warehouse
			if (editingId && nextWarehouseId) {
				fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=getStockQty&fabric_id=${editingId}&warehouse_id=${nextWarehouseId}`)
					.then(r => r.json())
					.then(js => {
						const q = js && js.success && js.data ? Number(js.data.quantity || 0) : 0;
						setForm(prev => ({ ...prev, quantity: q }));
					})
					.catch(() => {
						setForm(prev => ({ ...prev, quantity: 0 }));
					});
			}
			return;
		}
		if (name === 'quantity' || name === 'cost_price' || name === 'min_stock') {
			setForm(f => ({ ...f, [name]: value === '' ? 0 : Number(value) }));
			return;
		}
		setForm(f => ({ ...f, [name]: value }));
	};

	const handleSubmit = e => {
		e.preventDefault();
		if (!form.warehouse_id) {
			Swal.fire('تنبيه', 'يجب اختيار المخزن.', 'warning');
			return;
		}
		const action = editingId ? 'update' : 'add';
		fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editingId ? { ...form, id: editingId } : form)
		})
			.then(res => res.json())
			.then(() => {
				closeModal();
				fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=getAll`)
					.then(res => res.json())
					.then(data => setFabrics(data.data || []));
			});
	};

	const handleDelete = id => {
		Swal.fire({
			title: 'تأكيد الحذف',
			text: 'هل أنت متأكد من حذف هذا القماش؟',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'نعم',
			cancelButtonText: 'إلغاء'
		}).then(result => {
			if (!result.isConfirmed) return;
			fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=delete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			})
				.then(res => res.json())
				.then(() => {
					fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=getAll`)
						.then(res => res.json())
						.then(data => setFabrics(data.data || []));
				});
		});
	};

	const openHistory = (fabric: any) => {
		setSelectedFabric(fabric);
		setIsHistoryOpen(true);
		setHistoryRows([]);
		setHistoryLoading(true);
		fetch(`${API_BASE_PATH}/api.php?module=fabrics&action=getMovements&fabric_id=${fabric.id}`)
			.then(r => r.json())
			.then(js => {
				setHistoryRows((js && js.success && Array.isArray(js.data)) ? js.data : []);
			})
			.catch(() => setHistoryRows([]))
			.finally(() => setHistoryLoading(false));
	};

	const closeHistory = () => {
		setIsHistoryOpen(false);
		setSelectedFabric(null);
		setHistoryRows([]);
		setHistoryLoading(false);
	};

	const printHistory = () => {
		if (!selectedFabric) return;
		const title = 'سجل حركة الأقمشة';
		const subtitle = `${selectedFabric.name || ''}${selectedFabric.code ? ` (${selectedFabric.code})` : ''}`;
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
		if (t === 'cutting_order') return { label: 'أمر قص', cls: 'bg-rose-100 text-rose-700' };
		if (t === 'manufacturing') return { label: 'تصنيع', cls: 'bg-rose-100 text-rose-700' };
		if (t === 'initial_balance') return { label: 'رصيد افتتاحي', cls: 'bg-blue-100 text-blue-700' };
		if (t === 'adjustment') return { label: 'تسوية', cls: 'bg-amber-100 text-amber-700' };
		return { label: 'غير محدد', cls: 'bg-slate-100 text-slate-700' };
	};

	const formatReference = (referenceType: any, referenceId: any) => {
		if (!referenceId) return '-';
		const rt = String(referenceType || '').trim();
		let label = 'مرجع';
		if (rt === 'cutting_order') label = 'أمر قص';
		if (rt === 'manufacturing_stage') label = 'مرحلة التصنيع';
		if (rt === 'purchase') label = 'شراء/استلام';
		return `${label} رقم ${referenceId}`;
	};

	const safeDetails = (notes: any) => {
	    if (!notes) return '-';
	    if (typeof notes !== 'string') return formatDetailsFromObject(notes);
	    const s = notes.trim();
	    if (!s) return '-';
	    try {
	      const obj = JSON.parse(s);
	      if (obj && typeof obj === 'object') return formatDetailsFromObject(obj);
	      return String(obj);
	    } catch {
	      return s;
	    }
	  };

	  const formatDetailsFromObject = (obj: any) => {
	    if (!obj || typeof obj !== 'object') return '-';
	    if (obj.notes) return String(obj.notes);
	    if (obj.name && !obj.itemType) return String(obj.name);
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
	    pushText('السبب', obj.reason);

	    return parts.length ? parts.join(' | ') : '-';
	  };

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-black">إدارة الأقمشة</h2>
				<button onClick={() => openModal()} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
					<Plus size={16} /> إضافة قماش
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
							<th className="px-6 py-4 font-bold">الكمية الحالية</th>
							<th className="px-6 py-4 font-bold">سعر التكلفة</th>
							<th className="px-6 py-4 font-bold">الحد الأدنى</th>
							<th className="px-6 py-4 font-bold text-center">تحكم</th>
						</tr>
					</thead>
					<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
						{fabrics.length === 0 ? (
								<tr><td colSpan={8} className="text-center py-10 text-muted">لا توجد أقمشة مسجلة.</td></tr>
						) : fabrics.map(fabric => (
							<tr key={fabric.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
								<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{fabric.name}</td>
								<td className="px-6 py-4 text-xs font-mono text-muted">{fabric.code || '-'}</td>
								<td className="px-6 py-4 text-xs">{(() => {
									const count = Number(fabric.warehouse_count || 0);
									const names = (fabric.warehouse_names || '').toString().trim();
									if (!count) return '-';
									if (names) return names;
									const wid = fabric.one_warehouse_id;
									if (count === 1 && wid) {
										const w = warehouses.find(x => Number(x.id) === Number(wid));
										return w ? w.name : String(wid);
									}
									return 'متعدد';
								})()}</td>
								<td className="px-6 py-4 text-xs">{fabric.color || '-'}</td>
								<td className="px-6 py-4 text-xs font-mono">{Number(fabric.quantity || 0)}</td>
								<td className="px-6 py-4 text-xs font-mono text-muted">{Number(fabric.cost_price || 0)}</td>
								<td className="px-6 py-4 text-xs font-mono">{Number(fabric.min_stock || 0)}</td>
								<td className="px-6 py-4">
									<div className="flex items-center justify-center gap-1">
										<button onClick={() => openHistory(fabric)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="عرض حركة المخزون"><Eye size={14} /></button>
										<button onClick={() => openModal(fabric)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors" title="تعديل"><Edit size={14} /></button>
										<button onClick={() => handleDelete(fabric.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="حذف"><Trash2 size={14} /></button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Movement History Modal */}
			{isHistoryOpen && selectedFabric && (
				<div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700 h-[80vh] flex flex-col">
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<div>
								<h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><History className="text-blue-500" /> سجل حركة المخزون</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400">{selectedFabric.name} ({selectedFabric.code || '-'})</p>
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
					<div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">{editingId ? 'تعديل القماش' : 'إضافة قماش جديد'}</h3>
							<button onClick={closeModal} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={handleSubmit} className="p-8 text-right">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">اسم القماش</label>
									<input name="name" value={form.name} onChange={handleChange} placeholder="اسم القماش" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" required />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكود (تلقائي)</label>
									<input name="code" value={form.code} readOnly placeholder="FAB-..." className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm font-mono focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
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
										<p className="text-[11px] text-rose-600 mt-1">لا توجد مخازن. أضف مخزنًا أولاً من إعدادات/المخازن.</p>
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

export default FabricsPage;