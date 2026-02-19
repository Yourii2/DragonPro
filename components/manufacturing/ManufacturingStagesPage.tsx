import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowLeftRight, CheckCircle2, Plus, Save, X, Printer } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import Swal from 'sweetalert2';
import CustomSelect from '../CustomSelect';
import { API_BASE_PATH } from '../../services/apiConfig';
import { printBarcode, printBarcodeLabels } from '../../services/printUtils';

const BARCODE_PRINT_PREFILL_KEY = 'Nexus_barcode_print_prefill_v1';

type StageRow = {
	cutting_order_id: number;
	code: string;
	worker_id: number;
	worker_name: string;
	stage_id: number;
	stage_name: string;
	fabric_name: string;
	product_id: number;
	product_name: string;
	qty_received: number;
	qty_in_production: number;
	qty_remaining: number;
	is_last_stage: number;
	stage_order: number;
};

type CuttingOrderOption = {
	id: number;
	code: string;
	fabric_name: string;
	product_id: number;
	product_name: string;
	available_qty: number;
	warehouse_id: number;
};

type WorkerOption = { id: number; name: string };

type StageOption = { id: number; name: string; order_num?: number | null };

type SizeOption = { id: number; name: string; code?: string | null };

type WarehouseOption = { id: number; name: string };

type FinishedPiece = {
	piece_uid: string;
	size_id: number;
	size_name?: string | null;
	size_code?: string | null;
	color?: string | null;
};

type CompletedStageRow = StageRow & {
	started_at?: string | null;
	finished_at?: string | null;
	total_seconds?: number | null;
};

type CompletedPieceRow = {
	piece_uid: string;
	size_id?: number | null;
	size_name?: string | null;
	size_code?: string | null;
	fabric_color?: string | null;
};

const ManufacturingStagesPage = () => {
	const apiUrl = (action: string, extra: string = '') => `${API_BASE_PATH}/api.php?module=manufacturing_work&action=${action}${extra}`;

	const [rows, setRows] = useState<StageRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [activeTab, setActiveTab] = useState<'in_progress' | 'completed'>('in_progress');

	const [completedRows, setCompletedRows] = useState<CompletedStageRow[]>([]);
	const [completedLoading, setCompletedLoading] = useState(false);

	const [isCompletedViewOpen, setIsCompletedViewOpen] = useState(false);
	const [completedViewRow, setCompletedViewRow] = useState<CompletedStageRow | null>(null);
	const [completedPieces, setCompletedPieces] = useState<CompletedPieceRow[]>([]);
	const [completedPiecesLoading, setCompletedPiecesLoading] = useState(false);

	const [workers, setWorkers] = useState<WorkerOption[]>([]);
	const [cuttingOrders, setCuttingOrders] = useState<CuttingOrderOption[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

	const loadData = async () => {
		setLoading(true);
		try {
			const q = search.trim();
			const res = await fetch(apiUrl('getAll', q ? `&q=${encodeURIComponent(q)}` : ''));
			const json = await res.json();
			setRows(json?.data || []);
		} catch (e) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر تحميل مراحل التصنيع' });
		} finally {
			setLoading(false);
		}
	};

	const loadCompleted = async () => {
		setCompletedLoading(true);
		try {
			const q = search.trim();
			const res = await fetch(apiUrl('getCompleted', q ? `&q=${encodeURIComponent(q)}` : ''));
			const json = await res.json();
			setCompletedRows(json?.data || []);
		} catch (e) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر تحميل المراحل المكتملة' });
		} finally {
			setCompletedLoading(false);
		}
	};

	const loadMeta = async () => {
		try {
			const res = await fetch(apiUrl('getMeta'));
			const json = await res.json();
			setWorkers(json?.data?.workers || []);
			setCuttingOrders(json?.data?.cutting_orders || []);
			setWarehouses(json?.data?.warehouses || []);
		} catch (e) {
			console.error(e);
		}
	};

	useEffect(() => {
		loadMeta();
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const t = setTimeout(() => {
			if (activeTab === 'completed') loadCompleted();
			else loadData();
		}, 300);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search, activeTab]);

	useEffect(() => {
		if (activeTab === 'completed') loadCompleted();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTab]);

	const formatDateTime = (s?: string | null) => {
		const v = String(s || '').trim();
		if (!v) return '-';
		const d = new Date(v);
		if (Number.isNaN(d.getTime())) return v;
		try {
			return d.toLocaleString('ar-EG');
		} catch {
			return v;
		}
	};

	type DurationParts = { h: number; m: number; s: number };
	const toDurationParts = (seconds: number): DurationParts => {
		const sec = Math.max(0, Math.floor(Number(seconds || 0)));
		const h = Math.floor(sec / 3600);
		const m = Math.floor((sec % 3600) / 60);
		const s = sec % 60;
		return { h, m, s };
	};

	const formatDuration = (seconds?: number | null) => {
		const sec = Number(seconds || 0);
		if (!Number.isFinite(sec) || sec <= 0) return '-';
		const { h, m, s } = toDurationParts(sec);
		const mm = String(m).padStart(2, '0');
		const ss = String(s).padStart(2, '0');
		return `${h}:${mm}:${ss}`;
	};

	const openCompletedPieces = async (row: CompletedStageRow) => {
		setCompletedViewRow(row);
		setIsCompletedViewOpen(true);
		setCompletedPieces([]);
		setCompletedPiecesLoading(true);
		try {
			const res = await fetch(
				apiUrl('getCompletedPieces', `&cutting_order_id=${row.cutting_order_id}&stage_id=${row.stage_id}&worker_id=${row.worker_id}`)
			);
			const json = await res.json();
			setCompletedPieces(json?.data?.rows || []);
		} catch (e) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر تحميل باركودات المنتجات' });
		} finally {
			setCompletedPiecesLoading(false);
		}
	};

	const closeCompletedPieces = () => {
		setIsCompletedViewOpen(false);
		setCompletedViewRow(null);
		setCompletedPieces([]);
		setCompletedPiecesLoading(false);
	};

	const sendCompletedPiecesToPrint = () => {
		if (!completedViewRow) return;
		if (!completedPieces || completedPieces.length === 0) {
			Swal.fire({ icon: 'info', title: 'لا توجد باركودات', text: 'لا توجد باركودات لإرسالها للطباعة.' });
			return;
		}

		const items = completedPieces
			.map(p => {
				const code = String(p.piece_uid || '').trim();
				if (!code) return null;
				const parts = [completedViewRow.product_name, p.size_name || p.size_code || '', p.fabric_color || ''].filter(Boolean);
				return { code, title: parts.join(' - '), qty: 1 };
			})
			.filter(Boolean) as Array<{ code: string; title: string; qty: number }>;

		try {
			localStorage.setItem(BARCODE_PRINT_PREFILL_KEY, JSON.stringify({ items }));
		} catch {
			// ignore
		}

		try {
			window.dispatchEvent(new CustomEvent('nexus:navigate', { detail: { slug: 'barcode-print', subSlug: '' } }));
		} catch {
			// ignore
		}

		closeCompletedPieces();
	};

	const BarcodeSvg = ({ value }: { value: string }) => {
		const ref = useRef<SVGSVGElement | null>(null);
		useEffect(() => {
			if (!ref.current) return;
			try {
				JsBarcode(ref.current, value, {
					format: 'CODE128',
					displayValue: true,
					fontSize: 10,
					height: 44,
					margin: 0,
				});
			} catch {
				// ignore
			}
		}, [value]);
		return <svg ref={ref} />;
	};

	// --------------------
	// Assign modal
	// --------------------
	const [isAssignOpen, setIsAssignOpen] = useState(false);
	const [assignStages, setAssignStages] = useState<StageOption[]>([]);
	const [assignSizes, setAssignSizes] = useState<SizeOption[]>([]);
	const [assignInfo, setAssignInfo] = useState<{ available_qty: number } | null>(null);
	const [assignForm, setAssignForm] = useState({
		cutting_order_id: 0,
		quantity: 1,
		worker_id: 0,
		stage_id: 0,
		size_id: 0,
		is_paid: false,
		piece_rate: 0,
	});

	const assignRemaining = useMemo(() => {
		const av = Number(assignInfo?.available_qty || 0);
		const q = Number(assignForm.quantity || 0);
		return Math.max(0, av - Math.max(0, q));
	}, [assignForm.quantity, assignInfo?.available_qty]);

	const openAssign = async () => {
		setAssignForm({ cutting_order_id: 0, quantity: 1, worker_id: 0, stage_id: 0, size_id: 0, is_paid: false, piece_rate: 0 });
		setAssignStages([]);
		setAssignSizes([]);
		setAssignInfo(null);
		setIsAssignOpen(true);
	};
	const closeAssign = () => setIsAssignOpen(false);

	const loadAssignMeta = async (cuttingOrderId: number) => {
		if (!cuttingOrderId) {
			setAssignStages([]);
			setAssignSizes([]);
			setAssignInfo(null);
			return;
		}
		try {
			const res = await fetch(apiUrl('getAssignMeta', `&cutting_order_id=${cuttingOrderId}`));
			const json = await res.json();
			setAssignStages(json?.data?.stages || []);
			setAssignSizes(json?.data?.sizes || []);
			setAssignInfo({ available_qty: Number(json?.data?.available_qty || 0) });
			setAssignForm(f => ({
				...f,
				stage_id: Number(json?.data?.stages?.[0]?.id || 0),
				size_id: Number(json?.data?.sizes?.[0]?.id || 0),
			}));
		} catch (e) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر تحميل بيانات أمر القص' });
		}
	};

	const submitAssign = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!assignForm.cutting_order_id || !assignForm.worker_id || !assignForm.stage_id || !assignForm.size_id || !assignForm.quantity) {
			Swal.fire({ icon: 'warning', title: 'بيانات ناقصة', text: 'اختر أمر القص والعامل والمرحلة والمقاس وأدخل الكمية' });
			return;
		}
		try {
			const res = await fetch(apiUrl('assign'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cutting_order_id: assignForm.cutting_order_id,
					quantity: assignForm.quantity,
					worker_id: assignForm.worker_id,
					stage_id: assignForm.stage_id,
					size_id: assignForm.size_id,
					is_paid: assignForm.is_paid ? 1 : 0,
					piece_rate: assignForm.is_paid ? assignForm.piece_rate : 0,
				}),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Failed');
			Swal.fire({ icon: 'success', title: 'تم', text: 'تم تعيين العامل للمرحلة بنجاح' });
			closeAssign();
			await loadMeta();
			await loadData();
		} catch (err: any) {
			Swal.fire({ icon: 'error', title: 'خطأ', text: err?.message || 'تعذر تنفيذ العملية' });
		}
	};

	// --------------------
	// Transfer modal
	// --------------------
	const [isTransferOpen, setIsTransferOpen] = useState(false);
	const [transferRow, setTransferRow] = useState<StageRow | null>(null);
	const [transferStages, setTransferStages] = useState<StageOption[]>([]);
	const [transferForm, setTransferForm] = useState({
		to_worker_id: 0,
		to_stage_id: 0,
		quantity: 1,
		is_paid: false,
		piece_rate: 0,
	});

	const transferRemaining = useMemo(() => {
		const av = Number(transferRow?.qty_in_production || 0);
		const q = Number(transferForm.quantity || 0);
		return Math.max(0, av - Math.max(0, q));
	}, [transferForm.quantity, transferRow?.qty_in_production]);

	const openTransfer = async (row: StageRow) => {
		setTransferRow(row);
		setTransferForm({ to_worker_id: 0, to_stage_id: 0, quantity: 1, is_paid: false, piece_rate: 0 });
		setTransferStages([]);
		setIsTransferOpen(true);
		try {
			const res = await fetch(apiUrl('getTransferMeta', `&cutting_order_id=${row.cutting_order_id}&from_stage_id=${row.stage_id}`));
			const json = await res.json();
			setTransferStages(json?.data?.stages || []);
			setTransferForm(f => ({
				...f,
				to_stage_id: Number(json?.data?.stages?.[0]?.id || 0),
			}));
		} catch (e) {
			console.error(e);
			Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر تحميل المراحل المتبقية' });
		}
	};

	const closeTransfer = () => {
		setIsTransferOpen(false);
		setTransferRow(null);
		setTransferStages([]);
	};

	const submitTransfer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!transferRow) return;
		if (!transferForm.to_worker_id || !transferForm.to_stage_id || !transferForm.quantity) {
			Swal.fire({ icon: 'warning', title: 'بيانات ناقصة', text: 'اختر العامل والمرحلة الجديدة وأدخل الكمية' });
			return;
		}
		try {
			const res = await fetch(apiUrl('transfer'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cutting_order_id: transferRow.cutting_order_id,
					from_stage_id: transferRow.stage_id,
					from_worker_id: transferRow.worker_id,
					to_stage_id: transferForm.to_stage_id,
					to_worker_id: transferForm.to_worker_id,
					quantity: transferForm.quantity,
					is_paid: transferForm.is_paid ? 1 : 0,
					piece_rate: transferForm.is_paid ? transferForm.piece_rate : 0,
				}),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Failed');
			Swal.fire({ icon: 'success', title: 'تم', text: 'تم نقل الكمية للمرحلة التالية' });
			closeTransfer();
			await loadData();
		} catch (err: any) {
			Swal.fire({ icon: 'error', title: 'خطأ', text: err?.message || 'تعذر نقل المرحلة' });
		}
	};

	// --------------------
	// Finish modal
	// --------------------
	const [isFinishOpen, setIsFinishOpen] = useState(false);
	const [finishRow, setFinishRow] = useState<StageRow | null>(null);
	const [finishForm, setFinishForm] = useState({ quantity: 1, warehouse_id: 0 });

	const finishRemaining = useMemo(() => {
		const av = Number(finishRow?.qty_in_production || 0);
		const q = Number(finishForm.quantity || 0);
		return Math.max(0, av - Math.max(0, q));
	}, [finishForm.quantity, finishRow?.qty_in_production]);

	const openFinish = (row: StageRow) => {
		setFinishRow(row);
		setFinishForm({ quantity: 1, warehouse_id: warehouses?.[0]?.id || 0 });
		setIsFinishOpen(true);
	};
	const closeFinish = () => {
		setIsFinishOpen(false);
		setFinishRow(null);
	};

	const submitFinish = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!finishRow) return;
		if (!finishForm.warehouse_id || !finishForm.quantity) {
			Swal.fire({ icon: 'warning', title: 'بيانات ناقصة', text: 'اختر المخزن وأدخل الكمية' });
			return;
		}
		try {
			const res = await fetch(apiUrl('finish'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cutting_order_id: finishRow.cutting_order_id,
					from_stage_id: finishRow.stage_id,
					from_worker_id: finishRow.worker_id,
					quantity: finishForm.quantity,
					warehouse_id: finishForm.warehouse_id,
				}),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Failed');

			const finishedPieces: FinishedPiece[] = Array.isArray(json?.data?.finished_pieces) ? json.data.finished_pieces : [];
			const swalRes = await Swal.fire({
				icon: 'success',
				title: 'تم',
				text: 'تم إنهاء التصنيع وإضافة المنتج للمخزن',
				confirmButtonText: 'تم',
				showDenyButton: finishedPieces.length > 0,
				denyButtonText: 'طباعة باركود القطع',
			});

			if (swalRes.isDenied && finishedPieces.length > 0) {
				const labels = finishedPieces
					.map(p => {
						const code = String(p.piece_uid || '').trim();
						if (!code) return null;
						const parts = [finishRow.product_name, p.size_name || '', p.color || ''].filter(Boolean);
						return { code, title: parts.join(' - ') };
					})
					.filter(Boolean) as { code: string; title: string }[];

				printBarcodeLabels(labels, { mode: 'thermal', thermalType: 'paper' });
			}

			closeFinish();
			await loadMeta();
			await loadData();
		} catch (err: any) {
			Swal.fire({ icon: 'error', title: 'خطأ', text: err?.message || 'تعذر إنهاء التصنيع' });
		}
	};

	return (
		<div className="p-8">
			<div className="flex items-center justify-between mb-6 gap-4 dir-ltr">
				<button
					onClick={openAssign}
					className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
				>
					<Plus size={16} /> تعيين عامل لمرحلة جديدة
				</button>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setActiveTab('in_progress')}
						className={
							(activeTab === 'in_progress'
								? 'bg-blue-600 text-white '
								: 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 ') +
							'px-4 py-2 rounded-xl text-xs font-black transition-all'
						}
					>
						قيد التصنيع
					</button>
					<button
						onClick={() => setActiveTab('completed')}
						className={
							(activeTab === 'completed'
								? 'bg-blue-600 text-white '
								: 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 ') +
							'px-4 py-2 rounded-xl text-xs font-black transition-all'
						}
					>
						المراحل المكتملة
					</button>
				</div>
				<div className="flex-1 flex justify-end">
					<input
						dir="rtl"
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder="بحث باسم المنتج أو العامل أو كود العملية"
						className="w-full max-w-md bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white text-right"
					/>
				</div>
			</div>

			{activeTab === 'in_progress' ? (
				<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
					<table className="w-full text-right text-sm">
						<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
							<tr>
								<th className="px-6 py-4 font-bold">كود</th>
								<th className="px-6 py-4 font-bold">اسم العامل</th>
								<th className="px-6 py-4 font-bold">اسم المرحلة</th>
								<th className="px-6 py-4 font-bold">اسم القماش</th>
								<th className="px-6 py-4 font-bold">اسم المنتج</th>
								<th className="px-6 py-4 font-bold">الكمية مستلمة</th>
								<th className="px-6 py-4 font-bold">الكمية في الإنتاج</th>
								<th className="px-6 py-4 font-bold">الكمية المتبقية</th>
								<th className="px-6 py-4 font-bold text-center">تحكم</th>
							</tr>
						</thead>
						<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
							{loading ? (
								<tr><td colSpan={9} className="text-center py-10 text-muted">جارٍ التحميل...</td></tr>
							) : rows.length === 0 ? (
								<tr><td colSpan={9} className="text-center py-10 text-muted">لا توجد كميات قيد مراحل التصنيع.</td></tr>
							) : rows.map((r, idx) => (
								<tr
									key={`${r.cutting_order_id}-${r.stage_id}-${r.worker_id}-${idx}`}
									className={
										(r.is_last_stage ? 'bg-amber-50/60 dark:bg-amber-900/10 ' : '') +
										'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors'
									}
								>
									<td className="px-6 py-4 text-xs font-mono text-muted">{r.code}</td>
									<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{r.worker_name || '-'}</td>
									<td className="px-6 py-4 text-xs">{r.stage_name || '-'}</td>
									<td className="px-6 py-4 text-xs">{r.fabric_name || '-'}</td>
									<td className="px-6 py-4 text-xs">{r.product_name || '-'}</td>
									<td className="px-6 py-4 text-xs font-mono">{r.qty_received}</td>
									<td className="px-6 py-4 text-xs font-mono">{r.qty_in_production}</td>
									<td className="px-6 py-4 text-xs font-mono">{r.qty_remaining}</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center gap-1">
											<button
												onClick={() => printBarcode(r.code, 'باركود العملية')}
												className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
												title="طباعة الكود"
											>
												<Printer size={14} />
											</button>
											<button
												onClick={() => openTransfer(r)}
												className="p-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
												title="نقل إلى مرحلة تالية"
												disabled={r.qty_in_production <= 0 || !!r.is_last_stage}
											>
												<ArrowLeftRight size={14} />
											</button>
											<button
												onClick={() => openFinish(r)}
												className="p-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40"
												title="إنهاء التصنيع"
												disabled={!r.is_last_stage || r.qty_in_production <= 0}
											>
												<CheckCircle2 size={14} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="overflow-x-auto rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
					<table className="w-full text-right text-sm">
						<thead className="text-muted border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
							<tr>
								<th className="px-6 py-4 font-bold">كود المرحلة</th>
								<th className="px-6 py-4 font-bold">اسم القماش</th>
								<th className="px-6 py-4 font-bold">اسم المنتج</th>
								<th className="px-6 py-4 font-bold">اسم العامل</th>
								<th className="px-6 py-4 font-bold">وقت البدء</th>
								<th className="px-6 py-4 font-bold">وقت إنهاء الكميات</th>
								<th className="px-6 py-4 font-bold">إجمالي الوقت</th>
								<th className="px-6 py-4 font-bold text-center">عرض</th>
							</tr>
						</thead>
						<tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
							{completedLoading ? (
								<tr><td colSpan={8} className="text-center py-10 text-muted">جارٍ التحميل...</td></tr>
							) : completedRows.length === 0 ? (
								<tr><td colSpan={8} className="text-center py-10 text-muted">لا توجد مراحل مكتملة.</td></tr>
							) : completedRows.map((r, idx) => (
								<tr
									key={`c-${r.cutting_order_id}-${r.stage_id}-${r.worker_id}-${idx}`}
									className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
								>
									<td className="px-6 py-4 text-xs font-mono text-muted">{r.code}</td>
									<td className="px-6 py-4 text-xs">{r.fabric_name || '-'}</td>
									<td className="px-6 py-4 text-xs">{r.product_name || '-'}</td>
									<td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{r.worker_name || '-'}</td>
									<td className="px-6 py-4 text-xs">{formatDateTime(r.started_at)}</td>
									<td className="px-6 py-4 text-xs">{formatDateTime(r.finished_at)}</td>
									<td className="px-6 py-4 text-xs font-mono">{formatDuration(r.total_seconds ?? null)}</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-center">
											<button
												onClick={() => openCompletedPieces(r)}
												className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
												title="عرض باركودات المنتجات"
											>
												عرض
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{isCompletedViewOpen && completedViewRow && (
				<div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">
								باركودات المنتجات - {completedViewRow.code}
							</h3>
							<div className="flex items-center gap-2">
								<button
									onClick={sendCompletedPiecesToPrint}
									className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
									title="إرسال إلى صفحة طباعة الأكواد"
								>
									<Printer size={16} /> طباعة
								</button>
								<button onClick={closeCompletedPieces} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
									<X size={24} />
								</button>
							</div>
						</div>
						<div className="p-6 text-right">
							{completedPiecesLoading ? (
								<div className="text-center py-10 text-muted">جارٍ التحميل...</div>
							) : completedPieces.length === 0 ? (
								<div className="text-center py-10 text-muted">لا توجد باركودات.</div>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
									{completedPieces.slice(0, 200).map((p, idx) => {
										const v = String(p.piece_uid || '').trim();
										const parts = [completedViewRow.product_name, p.size_name || p.size_code || '', p.fabric_color || ''].filter(Boolean);
										return (
											<div
												key={`${v}-${idx}`}
												className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/30 p-3"
											>
												<div className="text-xs font-mono text-slate-600 dark:text-slate-300 text-center mb-2">{v}</div>
												{parts.length > 0 && (
													<div className="text-xs text-slate-600 dark:text-slate-300 text-center mb-2">{parts.join(' - ')}</div>
												)}
												<div className="flex justify-center">
													<BarcodeSvg value={v} />
												</div>
											</div>
										);
									})}
									{completedPieces.length > 200 && (
										<div className="sm:col-span-2 lg:col-span-3 text-center text-xs text-slate-500 dark:text-slate-400">
											تم عرض أول 200 باركود فقط.
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Assign Modal */}
			{isAssignOpen && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">تعيين عامل لمرحلة جديدة</h3>
							<button onClick={closeAssign} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={submitAssign} className="p-6 text-right">
							<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
								<div className="space-y-1 md:col-span-3">
									<label className="text-xs font-bold text-slate-500 mr-2">أمر القص</label>
									<CustomSelect
										value={String(assignForm.cutting_order_id || 0)}
										onChange={v => {
											const id = Number(v || 0);
											setAssignForm(f => ({ ...f, cutting_order_id: id }));
											loadAssignMeta(id);
										}}
										options={[{ value: '0', label: 'اختر أمر القص' }, ...cuttingOrders.map(o => ({ value: String(o.id), label: `${o.code} - ${o.product_name} - ${o.fabric_name}` }))]}
										className="w-full text-sm"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية المتاحة</label>
									<input disabled value={assignInfo?.available_qty ?? ''} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية للتسليم</label>
									<input
										type="number"
										min={1}
										value={assignForm.quantity}
										onChange={e => setAssignForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value || 1)) }))}
										className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المتبقي</label>
									<input disabled value={assignRemaining} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>

								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">العامل</label>
									<CustomSelect
										value={String(assignForm.worker_id || 0)}
										onChange={v => setAssignForm(f => ({ ...f, worker_id: Number(v || 0) }))}
										options={[{ value: '0', label: 'اختر العامل' }, ...workers.map(w => ({ value: String(w.id), label: w.name }))]}
										className="w-full text-sm"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">مرحلة التصنيع</label>
									<CustomSelect
										value={String(assignForm.stage_id || 0)}
										onChange={v => setAssignForm(f => ({ ...f, stage_id: Number(v || 0) }))}
										options={[{ value: '0', label: assignForm.cutting_order_id ? 'اختر المرحلة' : 'اختر أمر القص أولاً' }, ...assignStages.map(s => ({ value: String(s.id), label: s.name }))]}
										className="w-full text-sm"
										required
										disabled={!assignForm.cutting_order_id}
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">المقاس</label>
									<CustomSelect
										value={String(assignForm.size_id || 0)}
										onChange={v => setAssignForm(f => ({ ...f, size_id: Number(v || 0) }))}
										options={[{ value: '0', label: assignForm.cutting_order_id ? 'اختر المقاس' : 'اختر أمر القص أولاً' }, ...assignSizes.map(s => ({ value: String(s.id), label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))]}
										className="w-full text-sm"
										required
										disabled={!assignForm.cutting_order_id}
									/>
								</div>

								<div className="md:col-span-6 flex items-center justify-between gap-4 mt-2">
									<label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
										<input
											type="checkbox"
											checked={assignForm.is_paid}
											onChange={e => setAssignForm(f => ({ ...f, is_paid: e.target.checked }))}
										/>
										هذه المرحلة مدفوعة الأجر
									</label>
									<div className="flex-1" />
								</div>

								{assignForm.is_paid && (
									<>
										<div className="space-y-1 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 mr-2">الأجر مقابل القطعة</label>
											<input
												type="number"
												min={0}
												step="0.01"
												value={assignForm.piece_rate}
												onChange={e => setAssignForm(f => ({ ...f, piece_rate: Math.max(0, Number(e.target.value || 0)) }))}
												className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
											/>
										</div>
										<div className="space-y-1 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 mr-2">إجمالي الأجر</label>
											<input
												disabled
												value={(Number(assignForm.quantity || 0) * Number(assignForm.piece_rate || 0)).toFixed(2)}
												className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300"
											/>
										</div>
									</>
								)}
							</div>

							<button type="submit" className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
								<Save size={18} /> حفظ
							</button>
						</form>
					</div>
				</div>
			)}

			{/* Transfer Modal */}
			{isTransferOpen && transferRow && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">نقل إلى مرحلة تالية</h3>
							<button onClick={closeTransfer} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={submitTransfer} className="p-6 text-right">
							<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
								<div className="space-y-1 md:col-span-3">
									<label className="text-xs font-bold text-slate-500 mr-2">اسم المنتج</label>
									<input disabled value={transferRow.product_name} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية المتاحة</label>
									<input disabled value={transferRow.qty_in_production} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية للنقل</label>
									<input
										type="number"
										min={1}
										max={transferRow.qty_in_production}
										value={transferForm.quantity}
										onChange={e => setTransferForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value || 1)) }))}
										className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">المتبقي</label>
									<input disabled value={transferRemaining} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>

								<div className="space-y-1 md:col-span-3">
									<label className="text-xs font-bold text-slate-500 mr-2">العامل (للمرحلة الجديدة)</label>
									<CustomSelect
										value={String(transferForm.to_worker_id || 0)}
										onChange={v => setTransferForm(f => ({ ...f, to_worker_id: Number(v || 0) }))}
										options={[{ value: '0', label: 'اختر العامل' }, ...workers.map(w => ({ value: String(w.id), label: w.name }))]}
										className="w-full text-sm"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-3">
									<label className="text-xs font-bold text-slate-500 mr-2">المرحلة الجديدة</label>
									<CustomSelect
										value={String(transferForm.to_stage_id || 0)}
										onChange={v => setTransferForm(f => ({ ...f, to_stage_id: Number(v || 0) }))}
										options={[{ value: '0', label: 'اختر المرحلة' }, ...transferStages.map(s => ({ value: String(s.id), label: s.name }))]}
										className="w-full text-sm"
										required
									/>
								</div>

								<div className="md:col-span-6 flex items-center justify-between gap-4 mt-2">
									<label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
										<input
											type="checkbox"
											checked={transferForm.is_paid}
											onChange={e => setTransferForm(f => ({ ...f, is_paid: e.target.checked }))}
										/>
										هذه المرحلة مدفوعة الأجر
									</label>
									<div className="flex-1" />
								</div>

								{transferForm.is_paid && (
									<>
										<div className="space-y-1 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 mr-2">الأجر مقابل القطعة</label>
											<input
												type="number"
												min={0}
												step="0.01"
												value={transferForm.piece_rate}
												onChange={e => setTransferForm(f => ({ ...f, piece_rate: Math.max(0, Number(e.target.value || 0)) }))}
												className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
											/>
										</div>
										<div className="space-y-1 md:col-span-2">
											<label className="text-xs font-bold text-slate-500 mr-2">إجمالي الأجر</label>
											<input
												disabled
												value={(Number(transferForm.quantity || 0) * Number(transferForm.piece_rate || 0)).toFixed(2)}
												className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300"
											/>
										</div>
									</>
								)}
							</div>

							<button type="submit" className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
								<Save size={18} /> نقل
							</button>
						</form>
					</div>
				</div>
			)}

			{/* Finish Modal */}
			{isFinishOpen && finishRow && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
					<div className="w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
						<div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
							<h3 className="text-lg font-black text-slate-900 dark:text-white">إنهاء التصنيع</h3>
							<button onClick={closeFinish} className="text-slate-400 hover:text-rose-500 transition-colors" aria-label="إغلاق">
								<X size={24} />
							</button>
						</div>
						<form onSubmit={submitFinish} className="p-6 text-right">
							<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
								<div className="space-y-1 md:col-span-4">
									<label className="text-xs font-bold text-slate-500 mr-2">اسم المنتج</label>
									<input disabled value={finishRow.product_name} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية المتاحة</label>
									<input disabled value={finishRow.qty_in_production} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>
								<div className="space-y-1 md:col-span-1">
									<label className="text-xs font-bold text-slate-500 mr-2">الكمية للإنهاء</label>
									<input
										type="number"
										min={1}
										max={finishRow.qty_in_production}
										value={finishForm.quantity}
										onChange={e => setFinishForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value || 1)) }))}
										className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
										required
									/>
								</div>
								<div className="space-y-1 md:col-span-2">
									<label className="text-xs font-bold text-slate-500 mr-2">المتبقي</label>
									<input disabled value={finishRemaining} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-600 dark:text-slate-300" />
								</div>
								<div className="space-y-1 md:col-span-4">
									<label className="text-xs font-bold text-slate-500 mr-2">إضافة للمخزن</label>
									<CustomSelect
										value={String(finishForm.warehouse_id || 0)}
										onChange={v => setFinishForm(f => ({ ...f, warehouse_id: Number(v || 0) }))}
										options={[{ value: '0', label: 'اختر المخزن' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
										className="w-full text-sm"
										required
									/>
								</div>
							</div>

							<button type="submit" className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
								<Save size={18} /> إنهاء
							</button>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};

export default ManufacturingStagesPage;
