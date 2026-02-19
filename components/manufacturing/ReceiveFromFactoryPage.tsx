import React, { useEffect, useMemo, useState } from 'react';

import { Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../../services/apiConfig';
import CustomSelect from '../CustomSelect';

type DispatchOrderRow = {
	id: number;
	code?: string | null;
	from_warehouse_id: number;
	to_warehouse_id: number;
	from_warehouse_name?: string | null;
	to_warehouse_name?: string | null;
	status: 'pending' | 'confirmed' | 'mismatch' | string;
	created_by_name?: string | null;
	created_at?: string;
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

const ReceiveFromFactoryPage = () => {
	const [pendingOrders, setPendingOrders] = useState<DispatchOrderRow[]>([]);
	const [showCompleted, setShowCompleted] = useState<boolean>(false);
	const [selectedOrderId, setSelectedOrderId] = useState<number>(0);
	const [order, setOrder] = useState<DispatchOrderRow | null>(null);
	const [items, setItems] = useState<DispatchOrderItem[]>([]);
	const [receivedMap, setReceivedMap] = useState<Record<number, number>>({});
	const [barcodeToReceive, setBarcodeToReceive] = useState('');

	const normalizeColor = (c: string) => (c || '').trim();
	const itemKey = (pid: number, sid: number, color: string) => `${pid}|${sid}|${normalizeColor(color).toLowerCase()}`;

	const statusLabel = (s: string) => {
		const v = (s || '').trim();
		if (v === 'pending') return { label: 'معلقة', cls: 'bg-amber-100 text-amber-700' };
		if (v === 'confirmed') return { label: 'ناجحة', cls: 'bg-emerald-100 text-emerald-700' };
		if (v === 'mismatch') return { label: 'اختلاف', cls: 'bg-rose-100 text-rose-700' };
		return { label: v || '-', cls: 'bg-slate-100 text-slate-700' };
	};

	const fetchPending = async (opts?: { showCompleted?: boolean }) => {
		const sc = Boolean(opts?.showCompleted);
		const url = sc
			? `${API_BASE_PATH}/api.php?module=dispatch&action=listOrdersV2`
			: `${API_BASE_PATH}/api.php?module=dispatch&action=listOrdersV2&status=pending`;
		const res = await fetch(url);
		const json = await res.json();
		setPendingOrders(json?.data || []);
	};

	const fetchOrder = async (id: number) => {
		const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=getOrderV2&order_id=${encodeURIComponent(String(id))}`);
		const json = await res.json();
		if (!json?.success) throw new Error(json?.message || 'Failed');
		setOrder(json?.data?.order || null);
		const its: DispatchOrderItem[] = json?.data?.items || [];
		setItems(its);
		// Default received = sent
		const map: Record<number, number> = {};
		its.forEach(it => {
			map[it.id] = Number(it.qty_sent || 0);
		});
		setReceivedMap(map);
		setBarcodeToReceive('');
	};

	useEffect(() => {
		fetchPending({ showCompleted }).catch(() => setPendingOrders([]));
		setSelectedOrderId(0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showCompleted]);

	useEffect(() => {
		if (!selectedOrderId) {
			setOrder(null);
			setItems([]);
			setReceivedMap({});
			setBarcodeToReceive('');
			return;
		}
		fetchOrder(selectedOrderId).catch(() => {
			setOrder(null);
			setItems([]);
			setReceivedMap({});
			setBarcodeToReceive('');
		});
	}, [selectedOrderId]);

	const totals = useMemo(() => {
		const sent = items.reduce((s, it) => s + (Number(it.qty_sent) || 0), 0);
		const received = items.reduce((s, it) => s + (Number(receivedMap[it.id]) || 0), 0);
		return { sent, received };
	}, [items, receivedMap]);

	const setReceived = (itemId: number, value: number) => {
		setReceivedMap(prev => ({ ...prev, [itemId]: value }));
	};

	const bumpReceivedByBarcode = async () => {
		const bc = (barcodeToReceive || '').trim();
		if (!bc || !order) return;
		try {
			const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=resolveBarcodeV2&from_warehouse_id=${encodeURIComponent(String(order.from_warehouse_id))}&barcode=${encodeURIComponent(bc)}`);
			const js = await res.json();
			if (!js?.success) {
				Swal.fire({ title: 'باركود غير صحيح', text: js?.message || 'تعذر قراءة الباركود.', icon: 'error' });
				return;
			}
			const d = js.data || {};
			const pid = Number(d.factory_product_id || 0);
			const sid = Number(d.size_id || 0);
			const color = normalizeColor(String(d.color || ''));
			if (!pid || !sid || !color) {
				Swal.fire({ title: 'بيانات ناقصة', text: 'تعذر استخراج المقاس/اللون من الباركود.', icon: 'warning' });
				return;
			}
			const targetKey = itemKey(pid, sid, color);
			const found = items.find(it => itemKey(Number(it.factory_product_id), Number(it.size_id || 0), String(it.color || '')) === targetKey);
			if (!found) {
				Swal.fire({ title: 'غير موجود بالطلب', text: 'القطعة لا تنتمي لبنود هذا الإرسال.', icon: 'warning' });
				return;
			}
			const sent = Number(found.qty_sent || 0);
			const cur = Number(receivedMap[found.id] ?? 0);
			const next = Math.min(sent, (Number.isFinite(cur) ? cur : 0) + 1);
			setReceived(found.id, next);
			setBarcodeToReceive('');
		} catch {
			Swal.fire({ title: 'فشل', text: 'تعذر الاستلام بالباركود.', icon: 'error' });
		}
	};

	const confirmReceipt = async () => {
		if (!order) return;
		// Validate
		for (const it of items) {
			const received = Number(receivedMap[it.id] ?? 0);
			if (!Number.isFinite(received) || received < 0) {
				Swal.fire({ title: 'قيمة غير صحيحة', text: 'تأكد من الكميات المستلمة.', icon: 'warning' });
				return;
			}
			if (received > Number(it.qty_sent || 0)) {
				Swal.fire({ title: 'قيمة غير صحيحة', text: 'لا يمكن أن تكون الكمية المستلمة أكبر من المرسلة.', icon: 'warning' });
				return;
			}
		}

		const result = await Swal.fire({
			title: 'تأكيد الاستلام',
			text: 'سيتم خصم الكمية المستلمة فقط من مخزون الإرسال.',
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: 'تأكيد',
			cancelButtonText: 'إلغاء'
		});
		if (!result.isConfirmed) return;

		const payloadItems = items.map(it => ({
			item_id: it.id,
			factory_product_id: it.factory_product_id,
			qty_received: Number(receivedMap[it.id] ?? 0)
		}));

		const res = await fetch(`${API_BASE_PATH}/api.php?module=dispatch&action=confirmReceiptV2`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ order_id: order.id, items: payloadItems })
		});
		const json = await res.json();
		if (!json?.success) {
			Swal.fire({ title: 'فشل التأكيد', text: json?.message || 'حدث خطأ.', icon: 'error' });
			return;
		}
		await fetchPending({ showCompleted });
		setSelectedOrderId(0);
		Swal.fire({
			title: json?.data?.status === 'mismatch' ? 'تم التأكيد بحالة اختلاف' : 'تم التأكيد بنجاح',
			text: json?.data?.status === 'mismatch' ? 'تم اعتماد الكميات المستلمة كما هي.' : 'تم اعتماد الإرسال.',
			icon: 'success'
		});
	};

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-black">استلام من المصنع</h2>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="lg:col-span-1 rounded-3xl border border-card shadow-sm card p-5" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
					<div className="flex items-center justify-between gap-3 mb-3">
						<div className="text-sm font-black">{showCompleted ? 'الإرسالات' : 'الإرسالات المعلقة'}</div>
						<label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
							<input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
							إظهار المستلمة بالفعل
						</label>
					</div>
					<CustomSelect
						value={selectedOrderId ? String(selectedOrderId) : ''}
						onChange={v => setSelectedOrderId(Number(v) || 0)}
						options={[{ value: '', label: showCompleted ? 'اختر إرسالًا' : 'اختر إرسالًا معلقًا' }, ...pendingOrders.map(o => ({ value: String(o.id), label: `${o.code || `#${o.id}`} — ${o.from_warehouse_name || o.from_warehouse_id} → ${o.to_warehouse_name || o.to_warehouse_id}` }))]}
						className="w-full"
					/>
					<div className="mt-3 text-xs text-muted">عدد الإرسالات: {pendingOrders.length}</div>
				</div>

				<div className="lg:col-span-2 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
					{!order ? (
						<div className="p-10 text-center text-muted">اختر إرسالًا معلقًا لعرض بنوده وتأكيد الاستلام.</div>
					) : (
						<div className="p-6">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-lg font-black">{order.code || `#${order.id}`}</div>
									<div className="text-xs text-muted mt-1">من: {order.from_warehouse_name || order.from_warehouse_id} — إلى: {order.to_warehouse_name || order.to_warehouse_id}</div>
								</div>
								{(() => {
									const st = statusLabel(order.status);
									return <span className={`px-3 py-1 rounded-lg text-xs font-bold ${st.cls}`}>{st.label}</span>;
								})()}
							</div>

							<div className="mt-4 overflow-x-auto rounded-3xl border border-card">
								<table className="w-full text-right text-sm">
									<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
										<tr>
											<th className="px-6 py-4 font-bold">المنتج</th>
												<th className="px-6 py-4 font-bold">المقاس</th>
												<th className="px-6 py-4 font-bold">اللون</th>
											<th className="px-6 py-4 font-bold">المرسل</th>
											<th className="px-6 py-4 font-bold">المستلم (قابل للتعديل)</th>
											<th className="px-6 py-4 font-bold">الفرق</th>
										</tr>
									</thead>
									<tbody className="divide-y dark:divide-slate-700">
										{items.map(it => {
											const sent = Number(it.qty_sent || 0);
											const received = Number(receivedMap[it.id] ?? 0);
											const diff = sent - received;
											return (
												<tr key={it.id}>
													<td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-white">{it.product_name || it.factory_product_id}{it.product_code ? ` (${it.product_code})` : ''}</td>
														<td className="px-6 py-4 text-xs">{it.size_name || it.size_code || (it.size_id ? String(it.size_id) : '-')}</td>
														<td className="px-6 py-4 text-xs">{it.color || '-'}</td>
													<td className="px-6 py-4 text-xs font-mono text-muted">{sent}</td>
													<td className="px-6 py-4">
														<input
															type="number"
															min={0}
															max={sent}
															value={Number.isFinite(received) ? received : 0}
															onChange={e => setReceived(it.id, Number(e.target.value) || 0)}
															className="w-28 bg-white dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
														/>
													</td>
													<td className="px-6 py-4 text-xs font-mono text-muted">{diff}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

								<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
									<div className="space-y-1">
										<label className="text-xs font-bold text-slate-500 mr-2">استلام بالباركود</label>
										<input
											value={barcodeToReceive}
											onChange={e => setBarcodeToReceive(e.target.value)}
											onKeyDown={e => {
												if (e.key === 'Enter') {
													e.preventDefault();
													bumpReceivedByBarcode().catch(() => null);
												}
											}}
											placeholder="اقرأ الباركود ثم Enter"
											className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
										/>
									</div>
								</div>

							<div className="mt-4 text-xs text-muted font-mono">الإجمالي (مرسل/مستلم): {totals.sent} / {totals.received}</div>

							<button
								onClick={() => confirmReceipt().catch(() => Swal.fire({ title: 'فشل', text: 'تعذر تأكيد الاستلام.', icon: 'error' }))}
								className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
							>
								<Save size={18} /> تأكيد الاستلام
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ReceiveFromFactoryPage;
