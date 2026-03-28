import React, { useEffect, useState } from 'react';

import { Plus, Edit, Trash2, X, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../../services/apiConfig';

const ProductionStagesPage = () => {
	const [stages, setStages] = useState([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [form, setForm] = useState({ name: '', order_num: 1, description: '' });
	const [editingId, setEditingId] = useState(null);

	useEffect(() => {
		fetch(`${API_BASE_PATH}/api.php?module=production_stages&action=getAll`)
			.then(res => res.json())
			.then(data => setStages(data.data || []));
	}, []);

	const openModal = (stage = null) => {
		if (stage) {
			setForm(stage);
			setEditingId(stage.id);
		} else {
			setForm({ name: '', order_num: 1, description: '' });
			setEditingId(null);
		}
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setForm({ name: '', order_num: 1, description: '' });
		setEditingId(null);
	};

	const handleChange = e => {
		const { name, value } = e.target;
		setForm(f => ({ ...f, [name]: value }));
	};

	const handleSubmit = e => {
		e.preventDefault();
		const action = editingId ? 'update' : 'add';
		fetch(`${API_BASE_PATH}/api.php?module=production_stages&action=${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editingId ? { ...form, id: editingId } : form)
		})
			.then(res => res.json())
			.then(() => {
				closeModal();
				fetch(`${API_BASE_PATH}/api.php?module=production_stages&action=getAll`)
					.then(res => res.json())
					.then(data => setStages(data.data || []));
			});
	};

	const handleDelete = id => {
		Swal.fire({
			title: 'تأكيد الحذف',
			text: 'هل أنت متأكد من حذف هذه المرحلة؟',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'نعم',
			cancelButtonText: 'إلغاء'
		}).then(result => {
			if (!result.isConfirmed) return;
			fetch(`${API_BASE_PATH}/api.php?module=production_stages&action=delete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			})
				.then(res => res.json())
				.then(() => {
					fetch(`${API_BASE_PATH}/api.php?module=production_stages&action=getAll`)
						.then(res => res.json())
						.then(data => setStages(data.data || []));
				});
		});
	};

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-black">مراحل الإنتاج</h2>
				<button onClick={() => openModal()} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
					<Plus size={16} /> إضافة مرحلة
				</button>
			</div>

			<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
				<table className="w-full text-right text-sm">
					<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
						<tr>
							<th className="px-6 py-4 font-bold">الاسم</th>
							<th className="px-6 py-4 font-bold">الترتيب</th>
							<th className="px-6 py-4 font-bold">الوصف</th>
							<th className="px-6 py-4 font-bold text-center">تحكم</th>
						</tr>
					</thead>
					<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
						{stages.length === 0 ? (
								<tr><td colSpan={4} className="text-center py-10 text-muted">لا توجد مراحل مسجلة.</td></tr>
						) : stages.map(stage => (
							<tr key={stage.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
								<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{stage.name}</td>
								<td className="px-6 py-4 text-xs font-mono text-muted">{stage.order_num || '-'}</td>
								<td className="px-6 py-4 text-xs">{stage.description || '-'}</td>
								<td className="px-6 py-4">
									<div className="flex items-center justify-center gap-1">
										<button onClick={() => openModal(stage)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors" title="تعديل"><Edit size={14} /></button>
										<button onClick={() => handleDelete(stage.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="حذف"><Trash2 size={14} /></button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Modal for Add/Edit */}
			{isModalOpen && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">{editingId ? 'تعديل المرحلة' : 'إضافة مرحلة جديدة'}</h3>
							<button onClick={closeModal} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={handleSubmit} className="p-8 text-right">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">اسم المرحلة</label>
									<input name="name" value={form.name} onChange={handleChange} placeholder="اسم المرحلة" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" required />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">رقم الترتيب</label>
									<input name="order_num" type="number" value={form.order_num} onChange={handleChange} placeholder="رقم الترتيب" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الوصف</label>
									<input name="description" value={form.description} onChange={handleChange} placeholder="الوصف" className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
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

export default ProductionStagesPage;