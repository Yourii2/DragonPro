import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { printBarcodeLabels, type BarcodeLabelItem, type BarcodeLabelsPrintOptions } from '../services/printUtils';

type SourceType = 'fabrics' | 'accessories' | 'factory_products' | 'products' | 'cutting_stage' | 'manufacturing_work';

type ListItem = {
	id: string;
	name: string;
	code: string;
	meta?: string;
};

type QueueItem = {
	key: string;
	sourceType: SourceType;
	name: string;
	code: string;
	qty: number;
};

const BARCODE_PRINT_PREFILL_KEY = 'Nexus_barcode_print_prefill_v1';

type BarcodePrintPrefillPayload = {
	items: Array<{ code: string; title?: string; qty?: number }>;
};

const sourceTypeLabel: Record<SourceType, string> = {
	fabrics: 'الأقمشة',
	accessories: 'الإكسسوارات',
	factory_products: 'منتجات المصنع',
	products: 'منتجات المخزن',
	manufacturing_work: 'مراحل التصنيع (قيد العمل)',
	cutting_stage: 'مرحلة القص',
};

const clampInt = (v: any, min: number, max: number) => {
	const n = Math.floor(Number(v));
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, n));
};

const BarcodePrintPage: React.FC = () => {
	const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
	const [thermalType, setThermalType] = useState<'paper' | 'sticker'>('paper');
	const [stickerWidthMm, setStickerWidthMm] = useState<number>(80);
	const [stickerHeightMm, setStickerHeightMm] = useState<number>(40);

	const [sourceType, setSourceType] = useState<SourceType>('products');
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(false);
	const [items, setItems] = useState<ListItem[]>([]);

	const [rowQty, setRowQty] = useState<Record<string, number>>({});
	const [queue, setQueue] = useState<QueueItem[]>([]);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(BARCODE_PRINT_PREFILL_KEY);
			if (!raw) return;
			localStorage.removeItem(BARCODE_PRINT_PREFILL_KEY);

			const parsed: BarcodePrintPrefillPayload | null = JSON.parse(raw);
			const payloadItems = Array.isArray(parsed?.items) ? parsed!.items : [];
			if (payloadItems.length === 0) return;

			const merged = new Map<string, QueueItem>();
			payloadItems.forEach((it, idx) => {
				const code = String(it?.code || '').trim();
				if (!code) return;
				const name = String(it?.title || '').trim() || code;
				const qty = clampInt(it?.qty ?? 1, 1, 9999);
				const key = `prefill:${code}:${idx}`;
				const existing = merged.get(code);
				if (existing) {
					existing.qty = clampInt(existing.qty + qty, 1, 9999);
					return;
				}
				merged.set(code, { key, sourceType: 'manufacturing_work', name, code, qty });
			});

			const nextQueue = Array.from(merged.values());
			if (nextQueue.length > 0) setQueue(nextQueue);
		} catch {
			// ignore
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const fetchList = async (type: SourceType) => {
		setLoading(true);
		try {
			let url = '';
			switch (type) {
				case 'fabrics':
					url = `${API_BASE_PATH}/api.php?module=fabrics&action=getAll`;
					break;
				case 'accessories':
					url = `${API_BASE_PATH}/api.php?module=accessories&action=getAll`;
					break;
				case 'factory_products':
					url = `${API_BASE_PATH}/api.php?module=factory_products&action=getAll`;
					break;
				case 'products':
					url = `${API_BASE_PATH}/api.php?module=products&action=getAll`;
					break;
				case 'cutting_stage':
					url = `${API_BASE_PATH}/api.php?module=cutting_stage&action=getAll`;
					break;
				case 'manufacturing_work':
					url = `${API_BASE_PATH}/api.php?module=manufacturing_work&action=getAll`;
					break;
			}

			const res = await fetch(url);
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'فشل تحميل البيانات');

			const rows: any[] = json?.data || [];
			const mapped: ListItem[] = rows
				.map((r: any) => {
					if (type === 'products') {
						const code = String(r?.barcode || '').trim();
						const name = String(r?.name || '').trim();
						const meta = [r?.color, r?.size].filter(Boolean).join(' - ');
						return { id: String(r?.id ?? ''), name, code, meta };
					}
					if (type === 'factory_products') {
						const code = String(r?.code || '').trim();
						const name = String(r?.name || '').trim();
						return { id: String(r?.id ?? ''), name, code, meta: String(r?.type || '').trim() };
					}
					if (type === 'fabrics') {
						const code = String(r?.code || '').trim();
						const name = String(r?.name || '').trim();
						return { id: String(r?.id ?? ''), name, code, meta: String(r?.color || '').trim() };
					}
					if (type === 'accessories') {
						const code = String(r?.code || '').trim();
						const name = String(r?.name || '').trim();
						return { id: String(r?.id ?? ''), name, code, meta: String(r?.color || '').trim() };
					}
					if (type === 'cutting_stage') {
						const code = String(r?.code || '').trim();
						const name = String(r?.code || '').trim();
						const meta = [r?.product_name, r?.fabric_name].filter(Boolean).join(' - ');
						return { id: String(r?.id ?? r?.code ?? ''), name, code, meta };
					}
					// manufacturing_work
					const code = String(r?.code || '').trim();
					const name = String(r?.code || '').trim();
					const meta = [r?.product_name, r?.stage_name, r?.worker_name].filter(Boolean).join(' - ');
					return { id: `${r?.cutting_order_id || ''}_${r?.stage_id || ''}_${r?.worker_id || ''}`, name, code, meta };
				})
				.filter((x: ListItem) => x.id && x.name);

			setItems(mapped);
			setRowQty({});
		} catch (e: any) {
			console.error(e);
			setItems([]);
			Swal.fire({ icon: 'error', title: 'خطأ', text: e?.message || 'تعذر تحميل القائمة' });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchList(sourceType);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sourceType]);

	const filteredItems = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return items;
		return items.filter(it => {
			return (
				(it.name || '').toLowerCase().includes(q) ||
				(it.code || '').toLowerCase().includes(q) ||
				(it.meta || '').toLowerCase().includes(q)
			);
		});
	}, [items, search]);

	const addToQueue = (it: ListItem) => {
		const code = String(it.code || '').trim();
		if (!code) {
			Swal.fire({ icon: 'warning', title: 'لا يوجد كود', text: 'هذا العنصر لا يحتوي على كود/باركود للطباعة.' });
			return;
		}
		const qty = clampInt(rowQty[it.id] ?? 1, 1, 9999);
		const key = `${sourceType}:${it.id}`;
		setQueue(prev => {
			const idx = prev.findIndex(q => q.key === key);
			if (idx >= 0) {
				const next = [...prev];
				next[idx] = { ...next[idx], qty: clampInt(next[idx].qty + qty, 1, 9999) };
				return next;
			}
			return [...prev, { key, sourceType, name: it.name, code, qty }];
		});
	};

	const removeFromQueue = (key: string) => setQueue(prev => prev.filter(q => q.key !== key));

	const updateQueueQty = (key: string, qty: number) => {
		setQueue(prev => prev.map(q => (q.key === key ? { ...q, qty: clampInt(qty, 1, 9999) } : q)));
	};

	const onPrint = () => {
		if (queue.length === 0) {
			Swal.fire({ icon: 'info', title: 'لا توجد عناصر', text: 'أضف عناصر إلى قائمة الطباعة أولاً.' });
			return;
		}

		const expanded: BarcodeLabelItem[] = [];
		for (const q of queue) {
			const title = q.name;
			for (let i = 0; i < clampInt(q.qty, 1, 9999); i++) {
				expanded.push({ code: q.code, title });
			}
		}

		let opts: BarcodeLabelsPrintOptions;
		if (printMode === 'a4') {
			opts = { mode: 'a4' };
		} else {
			if (thermalType === 'sticker') {
				opts = {
					mode: 'thermal',
					thermalType: 'sticker',
					stickerWidthMm: clampInt(stickerWidthMm, 10, 120),
					stickerHeightMm: clampInt(stickerHeightMm, 10, 120),
				};
			} else {
				opts = { mode: 'thermal', thermalType: 'paper' };
			}
		}

		try {
			printBarcodeLabels(expanded, opts);
		} catch (e: any) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: e?.message || 'تعذر الطباعة' });
		}
	};

	return (
		<div className="p-6" dir="rtl">
			<div className="flex items-center justify-between gap-4 mb-6">
				<h1 className="text-2xl font-black text-slate-900 dark:text-white">طباعة الأكواد</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="card p-4 rounded-2xl border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
					<h2 className="font-black mb-3">إعدادات الطباعة</h2>

					<label className="block text-sm font-bold mb-1">نوع الطباعة</label>
					<select
						className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
						value={printMode}
						onChange={e => setPrintMode(e.target.value as any)}
					>
						<option value="a4">A4</option>
						<option value="thermal">حراري 80mm</option>
					</select>

					{printMode === 'thermal' && (
						<div className="mt-3">
							<label className="block text-sm font-bold mb-1">الخامة</label>
							<select
								className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
								value={thermalType}
								onChange={e => setThermalType(e.target.value as any)}
							>
								<option value="paper">ورق</option>
								<option value="sticker">ملصق</option>
							</select>

							{thermalType === 'sticker' && (
								<div className="mt-3 grid grid-cols-2 gap-2">
									<div>
										<label className="block text-xs font-bold mb-1">عرض الملصق (mm)</label>
										<input
											type="number"
											className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
											value={stickerWidthMm}
											onChange={e => setStickerWidthMm(Number(e.target.value || 0))}
											min={10}
											max={120}
										/>
									</div>
									<div>
										<label className="block text-xs font-bold mb-1">طول الملصق (mm)</label>
										<input
											type="number"
											className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
											value={stickerHeightMm}
											onChange={e => setStickerHeightMm(Number(e.target.value || 0))}
											min={10}
											max={120}
										/>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				<div className="card p-4 rounded-2xl border border-card lg:col-span-2" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
					<div className="flex flex-col md:flex-row md:items-end gap-3 mb-3">
						<div className="flex-1">
							<label className="block text-sm font-bold mb-1">مصدر الأكواد</label>
							<select
								className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
								value={sourceType}
								onChange={e => setSourceType(e.target.value as any)}
							>
								<option value="fabrics">قماش</option>
								<option value="accessories">إكسسوار</option>
								<option value="factory_products">منتج مصنع</option>
								<option value="products">منتج مخزن</option>
								<option value="manufacturing_work">مرحلة تصنيع</option>
								<option value="cutting_stage">مرحلة قص</option>
							</select>
						</div>
						<div className="flex-1">
							<label className="block text-sm font-bold mb-1">بحث</label>
							<input
								type="text"
								className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
								placeholder="اسم / كود"
								value={search}
								onChange={e => setSearch(e.target.value)}
							/>
						</div>
						<button
							onClick={() => fetchList(sourceType)}
							className="px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
							disabled={loading}
						>
							تحديث
						</button>
					</div>

					<div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
						<table className="w-full">
							<thead className="bg-slate-50 dark:bg-slate-900/50">
								<tr className="text-slate-700 dark:text-slate-200">
									<th className="px-4 py-3 text-right text-sm font-black">{sourceTypeLabel[sourceType]}</th>
									<th className="px-4 py-3 text-right text-sm font-black">الكود</th>
									<th className="px-4 py-3 text-right text-sm font-black">الكمية</th>
									<th className="px-4 py-3 text-center text-sm font-black">إضافة</th>
								</tr>
							</thead>
							<tbody className="divide-y dark:divide-slate-700">
								{loading ? (
									<tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">جارٍ التحميل...</td></tr>
								) : filteredItems.length === 0 ? (
									<tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">لا توجد بيانات</td></tr>
								) : (
									filteredItems.slice(0, 200).map(it => (
										<tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
											<td className="px-4 py-3">
												<div className="font-bold text-slate-900 dark:text-white">{it.name}</div>
												{it.meta ? <div className="text-xs text-slate-500">{it.meta}</div> : null}
											</td>
											<td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">{it.code || '-'}</td>
											<td className="px-4 py-3">
												<input
													type="number"
													className="w-28 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
													value={rowQty[it.id] ?? 1}
													min={1}
													max={9999}
													onChange={e => setRowQty(prev => ({ ...prev, [it.id]: clampInt(e.target.value, 1, 9999) }))}
												/>
											</td>
											<td className="px-4 py-3 text-center">
												<button
													onClick={() => addToQueue(it)}
													className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
													disabled={!it.code}
												>
													إضافة
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					<div className="text-xs text-slate-500 mt-2">يتم عرض أول 200 عنصر فقط لتسريع الصفحة.</div>
				</div>
			</div>

			<div className="card p-4 rounded-2xl border border-card mt-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
				<div className="flex items-center justify-between gap-3 mb-3">
					<h2 className="font-black">قائمة الطباعة</h2>
					<button
						onClick={onPrint}
						className="px-5 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
					>
						طباعة
					</button>
				</div>

				<div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
					<table className="w-full">
						<thead className="bg-slate-50 dark:bg-slate-900/50">
							<tr className="text-slate-700 dark:text-slate-200">
								<th className="px-4 py-3 text-right text-sm font-black">النوع</th>
								<th className="px-4 py-3 text-right text-sm font-black">الاسم</th>
								<th className="px-4 py-3 text-right text-sm font-black">الكود</th>
								<th className="px-4 py-3 text-right text-sm font-black">الكمية</th>
								<th className="px-4 py-3 text-center text-sm font-black">حذف</th>
							</tr>
						</thead>
						<tbody className="divide-y dark:divide-slate-700">
							{queue.length === 0 ? (
								<tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">لم يتم إضافة عناصر بعد.</td></tr>
							) : (
								queue.map(q => (
									<tr key={q.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
										<td className="px-4 py-3 text-xs">{sourceTypeLabel[q.sourceType]}</td>
										<td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{q.name}</td>
										<td className="px-4 py-3 font-mono text-xs">{q.code}</td>
										<td className="px-4 py-3">
											<input
												type="number"
												className="w-28 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
												value={q.qty}
												min={1}
												max={9999}
												onChange={e => updateQueueQty(q.key, Number(e.target.value || 1))}
											/>
										</td>
										<td className="px-4 py-3 text-center">
											<button
												onClick={() => removeFromQueue(q.key)}
												className="px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors"
											>
												حذف
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default BarcodePrintPage;
