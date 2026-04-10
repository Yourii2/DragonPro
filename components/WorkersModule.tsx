import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { Briefcase, CircleDollarSign, FileText, Fingerprint, List, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface WorkersModuleProps {
	initialView?: string;
}

type WorkerRow = {
	id: number;
	name: string;
	job_title?: string;
	salary_type?: 'daily' | 'weekly' | 'monthly' | 'piecework';
	salary_amount?: number;
	hire_date?: string;
	phone?: string;
	fingerprint_no?: string;
	manufacturing_extra?: number;
	status?: 'active' | 'inactive' | 'on_leave';
};

type WorkerSalaryRow = {
	id: number;
	worker_id: number;
	worker_name?: string;
	manufacturing_extra?: number;
	period_type: string;
	period_value: string;
	base_salary: number;
	deductions: number;
	bonuses: number;
	net_salary: number;
	status: 'pending' | 'paid';
	paid_at?: string | null;
	notes?: string | null;
};

type WorkerTxRow = {
	id: number;
	worker_id: number;
	amount: number;
	type: 'advance' | 'bonus' | 'penalty' | 'piecework' | 'salary';
	date: string;
	notes?: string;
	status: 'pending' | 'paid' | 'deducted';
	created_at?: string;
};

const monthNow = () => new Date().toISOString().slice(0, 7);

const WorkersModule: React.FC<WorkersModuleProps> = ({ initialView }) => {
	const [activeView, setActiveView] = useState<string>(initialView || 'list');
	const [workers, setWorkers] = useState<WorkerRow[]>([]);
	const [loading, setLoading] = useState(false);

	const [month, setMonth] = useState(monthNow());
	const [salaries, setSalaries] = useState<WorkerSalaryRow[]>([]);

	const [transactions, setTransactions] = useState<WorkerTxRow[]>([]);

	const [reportWorkerId, setReportWorkerId] = useState<number>(0);
	const [reportMonth, setReportMonth] = useState<string>(monthNow());
	const [reportData, setReportData] = useState<any>(null);

	useEffect(() => {
		if (initialView) setActiveView(initialView);
	}, [initialView]);

	const fetchWorkers = async () => {
		try {
			setLoading(true);
			const res = await fetch(`${API_BASE_PATH}/api.php?module=workers&action=getAll&month=${encodeURIComponent(monthNow())}`);
			const json = await res.json();
			if (json && json.success) {
				setWorkers(Array.isArray(json.data) ? json.data : []);
			} else {
				throw new Error(json?.message || 'Failed to load workers');
			}
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Fetch workers error', e);
			Swal.fire('خطأ', e?.message || 'تعذر تحميل قائمة العمال', 'error');
		} finally {
			setLoading(false);
		}
	};

	const fetchSalaries = async (m: string) => {
		try {
			setLoading(true);
			const res = await fetch(`${API_BASE_PATH}/api.php?module=worker_salaries&action=getForMonth&month=${encodeURIComponent(m)}`);
			const json = await res.json();
			if (json && json.success) {
				setSalaries(Array.isArray(json.data) ? json.data : []);
			} else {
				throw new Error(json?.message || 'Failed to load salaries');
			}
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Fetch salaries error', e);
			Swal.fire('خطأ', e?.message || 'تعذر تحميل الرواتب', 'error');
		} finally {
			setLoading(false);
		}
	};

	const fetchTransactions = async () => {
		try {
			setLoading(true);
			const res = await fetch(`${API_BASE_PATH}/api.php?module=worker_transactions&action=getAll`);
			const json = await res.json();
			if (json && json.success) {
				setTransactions(Array.isArray(json.data) ? json.data : []);
			} else {
				throw new Error(json?.message || 'Failed to load transactions');
			}
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Fetch transactions error', e);
			Swal.fire('خطأ', e?.message || 'تعذر تحميل المعاملات', 'error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchWorkers();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (activeView === 'salaries') {
			fetchSalaries(month);
		}
		if (activeView === 'transactions') {
			fetchTransactions();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeView]);

	const workerNameById = useMemo(() => {
		const map = new Map<number, string>();
		workers.forEach((w) => map.set(w.id, w.name));
		return map;
	}, [workers]);

	const salaryTypeAr = (t?: WorkerRow['salary_type']) => {
		if (t === 'daily') return 'يومي';
		if (t === 'weekly') return 'أسبوعي';
		if (t === 'monthly') return 'شهري';
		if (t === 'piecework') return 'قطعة';
		return '-';
	};

	const workerStatusAr = (s?: WorkerRow['status']) => {
		if (s === 'active') return 'نشط';
		if (s === 'inactive') return 'غير نشط';
		if (s === 'on_leave') return 'إجازة';
		return '-';
	};

	const salaryStatusAr = (s?: WorkerSalaryRow['status']) => {
		if (s === 'pending') return 'قيد التجهيز';
		if (s === 'paid') return 'مدفوع';
		return s || '-';
	};

	const txTypeAr = (t?: WorkerTxRow['type']) => {
		if (t === 'advance') return 'سلفة';
		if (t === 'bonus') return 'مكافأة';
		if (t === 'penalty') return 'خصم';
		if (t === 'piecework') return 'تصنيع (قطعة)';
		if (t === 'salary') return 'راتب';
		return '-';
	};

	const txStatusAr = (s?: WorkerTxRow['status']) => {
		if (s === 'pending') return 'قيد المراجعة';
		if (s === 'paid') return 'مدفوع';
		if (s === 'deducted') return 'تم الخصم/الاحتساب';
		return '-';
	};

	const txNotesAr = (notes?: string) => {
		if (!notes) return '-';
		const n = String(notes);
		try {
			const obj = JSON.parse(n);
			if (obj && typeof obj === 'object') {
				const type = String((obj as any).type || '');
				const cuttingOrderId = (obj as any).cutting_order_id;
				const productId = (obj as any).product_id;
				const stageId = (obj as any).stage_id;
				const qty = (obj as any).qty;
				let typeLabel = type;
				if (type === 'stage_complete_transfer') typeLabel = 'إكمال مرحلة (نقل)';
				if (type === 'stage_complete_finish') typeLabel = 'إكمال مرحلة (إنهاء)';
				const parts: string[] = [];
				if (cuttingOrderId != null) parts.push(`أمر قص: ${cuttingOrderId}`);
				if (productId != null) parts.push(`منتج: ${productId}`);
				if (stageId != null) parts.push(`مرحلة: ${stageId}`);
				if (qty != null) parts.push(`كمية: ${qty}`);
				if (typeLabel) parts.push(`سبب: ${typeLabel}`);
				return parts.join(' | ');
			}
		} catch {
			// ignore
		}
		return n;
	};

	const dateValueForInput = (value?: string) => {
		if (!value) return '';
		// Accept `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`
		if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
		// Accept `DD-MM-YYYY` or `DD/MM/YYYY`
		const m = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
		if (m) return `${m[3]}-${m[2]}-${m[1]}`;
		return value;
	};

	const openWorkerForm = async (existing?: WorkerRow) => {
		const isEdit = Boolean(existing?.id);
		const hireDateValue = dateValueForInput(existing?.hire_date);
		const { value: formValues } = await Swal.fire({
			title: isEdit ? 'تعديل عامل' : 'إضافة عامل',
			icon: isEdit ? 'info' : 'question',
			html: `
				<div class="text-right">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">الاسم</label>
							<input id="w_name" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="اسم العامل" value="${existing?.name || ''}">
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">المسمى الوظيفي</label>
							<input id="w_job" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="مثال: قص / خياطة" value="${existing?.job_title || ''}">
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">نوع الأجر</label>
							<select id="w_type" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
								<option value="daily" ${existing?.salary_type === 'daily' ? 'selected' : ''}>يومي</option>
								<option value="weekly" ${existing?.salary_type === 'weekly' ? 'selected' : ''}>أسبوعي</option>
								<option value="monthly" ${existing?.salary_type === 'monthly' ? 'selected' : ''}>شهري</option>
								<option value="piecework" ${existing?.salary_type === 'piecework' ? 'selected' : ''}>قطعة</option>
							</select>
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">قيمة الأجر</label>
							<input id="w_amount" type="number" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="0" value="${existing?.salary_amount ?? 0}">
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">تاريخ التعيين</label>
							<input id="w_hire" type="date" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value="${hireDateValue}">
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">الهاتف</label>
							<input id="w_phone" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="01xxxxxxxxx" value="${existing?.phone || ''}">
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">رقم البصمة (على الجهاز)</label>
							<input id="w_fp" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="مثال: 12" value="${existing?.fingerprint_no || ''}">
							<p class="mt-1 text-[11px] text-slate-400">يجب أن يطابق قيمة device_user_id القادمة من جهاز البصمة.</p>
						</div>
					</div>
					<div class="mt-3">
						<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">الحالة</label>
						<select id="w_status" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
							<option value="active" ${(existing?.status || 'active') === 'active' ? 'selected' : ''}>نشط</option>
							<option value="inactive" ${existing?.status === 'inactive' ? 'selected' : ''}>غير نشط</option>
							<option value="on_leave" ${existing?.status === 'on_leave' ? 'selected' : ''}>إجازة</option>
						</select>
					</div>
					<p class="mt-3 text-[11px] text-slate-400">سيتم حفظ البيانات فور التأكيد.</p>
				</div>
			`,
			buttonsStyling: false,
			customClass: {
				popup: 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl',
				title: 'text-right text-lg font-black text-slate-900 dark:text-white',
				htmlContainer: 'p-0',
				confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-black',
				cancelButton: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-xl text-sm font-black mr-2',
			},
			didOpen: () => {
				try {
					(document.getElementById('w_name') as HTMLInputElement | null)?.focus();
				} catch {}
			},
			showCancelButton: true,
			confirmButtonText: 'حفظ',
			cancelButtonText: 'إلغاء',
			preConfirm: () => {
				const name = (document.getElementById('w_name') as HTMLInputElement).value.trim();
				const job_title = (document.getElementById('w_job') as HTMLInputElement).value.trim();
				const salary_type = (document.getElementById('w_type') as HTMLSelectElement).value;
				const salary_amount = parseFloat((document.getElementById('w_amount') as HTMLInputElement).value || '0');
				const hire_date = (document.getElementById('w_hire') as HTMLInputElement).value.trim();
				const phone = (document.getElementById('w_phone') as HTMLInputElement).value.trim();
				const fingerprint_no = (document.getElementById('w_fp') as HTMLInputElement).value.trim();
				const status = (document.getElementById('w_status') as HTMLSelectElement).value;
				if (!name) return Swal.showValidationMessage('الاسم مطلوب');
				return { name, job_title, salary_type, salary_amount, hire_date: hire_date || null, phone, fingerprint_no: fingerprint_no || null, status };
			},
		});

		if (!formValues) return;

		try {
			setLoading(true);
			const url = `${API_BASE_PATH}/api.php?module=workers&action=${isEdit ? 'update' : 'create'}`;
			const payload: any = { ...formValues };
			if (isEdit) payload.id = existing!.id;

			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Save failed');
			await fetchWorkers();
			Swal.fire('تم', 'تم حفظ بيانات العامل', 'success');
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Save worker error', e);
			Swal.fire('خطأ', e?.message || 'تعذر حفظ العامل', 'error');
		} finally {
			setLoading(false);
		}
	};

	const deleteWorker = async (id: number) => {
		const ok = await Swal.fire({
			title: 'تأكيد الحذف',
			text: 'هل تريد حذف هذا العامل؟',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonText: 'حذف',
			cancelButtonText: 'إلغاء',
		});
		if (!ok.isConfirmed) return;

		try {
			setLoading(true);
			const res = await fetch(`${API_BASE_PATH}/api.php?module=workers&action=delete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Delete failed');
			await fetchWorkers();
			Swal.fire('تم', 'تم حذف العامل', 'success');
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Delete worker error', e);
			Swal.fire('خطأ', e?.message || 'تعذر حذف العامل', 'error');
		} finally {
			setLoading(false);
		}
	};

	const openAttendanceSummary = async (worker: WorkerRow) => {
		const { value: monthValue } = await Swal.fire({
			title: 'ملخص الحضور والانصراف',
			icon: 'info',
			html: `
				<div class="text-right">
					<p class="text-sm font-black text-slate-900 dark:text-white mb-2">${worker.name}</p>
					<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">الشهر</label>
					<input id="att_month" type="month" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value="${monthNow()}">
					<p class="mt-2 text-[11px] text-slate-400">يعتمد على سجلات جهاز البصمة في attendance_logs.</p>
				</div>
			`,
			buttonsStyling: false,
			customClass: {
				popup: 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl',
				title: 'text-right text-lg font-black text-slate-900 dark:text-white',
				htmlContainer: 'p-0',
				confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-black',
				cancelButton: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-xl text-sm font-black mr-2',
			},
			showCancelButton: true,
			confirmButtonText: 'عرض',
			cancelButtonText: 'إلغاء',
			preConfirm: () => {
				const m = (document.getElementById('att_month') as HTMLInputElement).value.trim();
				if (!m) return Swal.showValidationMessage('اختر الشهر');
				return m;
			},
		});

		if (!monthValue) return;

		try {
			Swal.fire({
				title: 'جاري التحميل...',
				allowOutsideClick: false,
				didOpen: () => Swal.showLoading(),
			});
			const res = await fetch(
				`${API_BASE_PATH}/api.php?module=workers&action=getAttendanceSummary&worker_id=${encodeURIComponent(
					worker.id
				)}&month=${encodeURIComponent(monthValue)}`
			);
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Failed to load attendance');
			const data = json.data;
			const days: any[] = Array.isArray(data?.days) ? data.days : [];

			const rowsHtml =
				days.length === 0
					? '<div class="text-center text-slate-400 text-sm">لا توجد سجلات لهذا الشهر</div>'
					: `
						<div class="overflow-auto max-h-[50vh]">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="text-right text-slate-500">
										<th class="p-2">اليوم</th>
										<th class="p-2">أول دخول</th>
										<th class="p-2">آخر خروج</th>
										<th class="p-2">البصمات</th>
									</tr>
								</thead>
								<tbody>
									${days
										.map(
											(d) => `
												<tr class="border-t border-slate-100 dark:border-slate-700/60">
													<td class="p-2 font-bold text-slate-800 dark:text-white">${d.day ?? ''}</td>
													<td class="p-2">${(d.first_in ?? '').toString().replace('T', ' ')}</td>
													<td class="p-2">${(d.last_out ?? '').toString().replace('T', ' ')}</td>
													<td class="p-2">${d.punches ?? ''}</td>
												</tr>
											`
										)
										.join('')}
								</tbody>
							</table>
						</div>
					`;

			await Swal.fire({
				title: `الحضور: ${data?.present_days ?? 0} يوم`,
				icon: 'success',
				html: `
					<div class="text-right">
						<div class="text-xs text-slate-500 dark:text-slate-400 mb-2">رقم البصمة: ${data?.worker?.fingerprint_no || '-'}</div>
						${rowsHtml}
					</div>
				`,
				buttonsStyling: false,
				customClass: {
					popup: 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl',
					title: 'text-right text-lg font-black text-slate-900 dark:text-white',
					htmlContainer: 'p-0',
					confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-black',
				},
			});
		} catch (e: any) {
			Swal.fire('خطأ', e?.message || 'تعذر تحميل الحضور', 'error');
		}
	};

	const processPayroll = async () => {
		try {
			setLoading(true);
			const res = await fetch(`${API_BASE_PATH}/api.php?module=worker_salaries&action=processPayroll`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ month }),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Payroll failed');
			await fetchSalaries(month);
			Swal.fire('تم', json?.message || 'تم تجهيز الرواتب', 'success');
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Process payroll error', e);
			Swal.fire('خطأ', e?.message || 'تعذر تجهيز الرواتب', 'error');
		} finally {
			setLoading(false);
		}
	};

	const paySalary = async (salaryId: number) => {
		const ok = await Swal.fire({
			title: 'صرف الراتب',
			text: 'تأكيد صرف الراتب؟',
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: 'صرف',
			cancelButtonText: 'إلغاء',
		});
		if (!ok.isConfirmed) return;

		try {
			setLoading(true);
			const res = await fetch(`${API_BASE_PATH}/api.php?module=worker_salaries&action=pay`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: salaryId }),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Pay failed');
			await fetchSalaries(month);
			Swal.fire('تم', 'تم صرف الراتب', 'success');
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Pay salary error', e);
			Swal.fire('خطأ', e?.message || 'تعذر صرف الراتب', 'error');
		} finally {
			setLoading(false);
		}
	};

	const addTransaction = async () => {
		const { value } = await Swal.fire({
			title: 'إضافة معاملة',
			icon: 'info',
			html: `
				<div class="text-right">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">العامل</label>
							<select id="tx_worker" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
								<option value="">اختر عامل</option>
								${workers.map((w) => `<option value="${w.id}">${w.name}</option>`).join('')}
							</select>
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">النوع</label>
							<select id="tx_type" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
								<option value="advance">سلفة</option>
								<option value="bonus">مكافأة</option>
								<option value="penalty">خصم</option>
							</select>
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">المبلغ</label>
							<input id="tx_amount" type="number" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="0" value="0">
						</div>
						<div>
							<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">التاريخ</label>
							<input id="tx_date" type="date" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" value="${new Date().toISOString().slice(0, 10)}">
						</div>
					</div>
					<div class="mt-3">
						<label class="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1">ملاحظات</label>
						<input id="tx_notes" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="اختياري" value="">
					</div>
				</div>
			`,
			buttonsStyling: false,
			customClass: {
				popup: 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl',
				title: 'text-right text-lg font-black text-slate-900 dark:text-white',
				htmlContainer: 'p-0',
				confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-black',
				cancelButton: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-xl text-sm font-black mr-2',
			},
			showCancelButton: true,
			confirmButtonText: 'حفظ',
			cancelButtonText: 'إلغاء',
			preConfirm: () => {
				const worker_id = parseInt((document.getElementById('tx_worker') as HTMLSelectElement).value || '0', 10);
				const type = (document.getElementById('tx_type') as HTMLSelectElement).value as any;
				const amount = parseFloat((document.getElementById('tx_amount') as HTMLInputElement).value || '0');
				const date = (document.getElementById('tx_date') as HTMLInputElement).value.trim();
				const notes = (document.getElementById('tx_notes') as HTMLInputElement).value.trim();
				if (!worker_id) return Swal.showValidationMessage('اختر عامل');
				if (!amount || amount <= 0) return Swal.showValidationMessage('المبلغ يجب أن يكون أكبر من صفر');
				if (!date) return Swal.showValidationMessage('التاريخ مطلوب');
				return { worker_id, type, amount, date, notes, status: 'pending' };
			},
		});

		if (!value) return;

		try {
			setLoading(true);
			const res = await fetch(`${API_BASE_PATH}/api.php?module=worker_transactions&action=create`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(value),
			});
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Create failed');
			await fetchTransactions();
			Swal.fire('تم', 'تمت إضافة المعاملة', 'success');
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Add tx error', e);
			Swal.fire('خطأ', e?.message || 'تعذر إضافة المعاملة', 'error');
		} finally {
			setLoading(false);
		}
	};

	const loadReport = async () => {
		if (!reportWorkerId) {
			Swal.fire('تنبيه', 'اختر عامل أولاً', 'info');
			return;
		}
		try {
			setLoading(true);
			const res = await fetch(
				`${API_BASE_PATH}/api.php?module=worker_salaries&action=getReport&worker_id=${reportWorkerId}&month=${encodeURIComponent(reportMonth)}`,
			);
			const json = await res.json();
			if (!json?.success) throw new Error(json?.message || 'Report failed');
			setReportData(json.data);
		} catch (e: any) {
			// eslint-disable-next-line no-console
			console.error('Load report error', e);
			Swal.fire('خطأ', e?.message || 'تعذر تحميل التقرير', 'error');
		} finally {
			setLoading(false);
		}
	};

	const headerTabs = [
		{ key: 'list', label: 'قائمة العمال', Icon: List },
		{ key: 'salaries', label: 'الرواتب', Icon: CircleDollarSign },
		{ key: 'transactions', label: 'معاملات العمال', Icon: ReceiptText },
		{ key: 'salary-report', label: 'تقرير الرواتب', Icon: FileText },
	];

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-start gap-3">
					<div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
						<Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<h1 className="text-2xl font-black text-slate-900 dark:text-white">العمال</h1>
						<p className="text-xs text-slate-500 dark:text-slate-400">إدارة العمال والرواتب والمعاملات</p>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2 overflow-x-auto">
				{headerTabs.map((t) => (
					<button
						key={t.key}
						onClick={() => {
							setActiveView(t.key);
							setReportData(null);
						}}
						className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
							activeView === t.key
								? 'bg-blue-600 text-white shadow-md'
								: 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
						}`}
					>
						<span className="inline-flex items-center gap-2">
							<t.Icon className="w-4 h-4" />
							{t.label}
						</span>
					</button>
				))}
			</div>

			{loading && <div className="text-xs text-slate-500 dark:text-slate-400">جاري التحميل...</div>}

			{activeView === 'list' && (
				<div className="card p-4 space-y-4">
					<div className="flex items-center justify-between">
						<div className="text-sm font-black">العمال</div>
						<button
							onClick={() => openWorkerForm()}
							className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2"
						>
							<Plus className="w-4 h-4" />
							إضافة عامل
						</button>
					</div>

					<div className="overflow-auto">
						<table className="min-w-full text-sm">
							<thead>
								<tr className="text-right text-slate-500">
									<th className="p-2">الاسم</th>
									<th className="p-2">المسمى</th>
									<th className="p-2">نوع الأجر</th>
									<th className="p-2">القيمة</th>
									<th className="p-2">رقم البصمة</th>
									<th className="p-2">الحالة</th>
									<th className="p-2">إجراءات</th>
								</tr>
							</thead>
							<tbody>
								{workers.map((w) => (
									<tr key={w.id} className="border-t border-slate-100 dark:border-slate-700/60">
										<td className="p-2 font-bold text-slate-800 dark:text-white">{w.name}</td>
										<td className="p-2">{w.job_title || '-'}</td>
										<td className="p-2">{salaryTypeAr(w.salary_type)}</td>
										<td className="p-2">{Number(w.salary_amount || 0).toFixed(2)}</td>
										<td className="p-2">{w.fingerprint_no || '-'}</td>
										<td className="p-2">{workerStatusAr(w.status)}</td>
										<td className="p-2 flex gap-2">
											<button
												onClick={() => openWorkerForm(w)}
												className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 inline-flex items-center gap-1"
											>
												<Pencil className="w-3.5 h-3.5" />
												تعديل
											</button>
											<button
												onClick={() => openAttendanceSummary(w)}
												className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 inline-flex items-center gap-1"
											>
												<Fingerprint className="w-3.5 h-3.5" />
												الحضور
											</button>
											<button
												onClick={() => deleteWorker(w.id)}
												className="px-3 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 inline-flex items-center gap-1"
											>
												<Trash2 className="w-3.5 h-3.5" />
												حذف
											</button>
										</td>
									</tr>
								))}
								{workers.length === 0 && (
									<tr>
										<td className="p-3 text-center text-slate-400" colSpan={7}>
											لا يوجد عمال
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{activeView === 'salaries' && (
				<div className="card p-4 space-y-4">
					<div className="flex items-center justify-between gap-3 flex-wrap">
						<div className="flex items-center gap-2">
							<div className="text-sm font-black">رواتب شهر</div>
							<input
								value={month}
								onChange={(e) => setMonth(e.target.value)}
								className="border rounded-xl px-3 py-2 text-xs dark:bg-slate-900"
								placeholder="YYYY-MM"
							/>
							<button
								onClick={() => fetchSalaries(month)}
								className="px-3 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800"
							>
								عرض
							</button>
						</div>
						<button
							onClick={processPayroll}
							className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black"
						>
							تجهيز الرواتب
						</button>
					</div>

					<div className="overflow-auto">
						<table className="min-w-full text-sm">
							<thead>
								<tr className="text-right text-slate-500">
									<th className="p-2">العامل</th>
									<th className="p-2">الأساسي</th>
									<th className="p-2">إضافي تصنيع</th>
									<th className="p-2">الخصومات</th>
									<th className="p-2">المكافآت</th>
									<th className="p-2">الصافي</th>
									<th className="p-2">الحالة</th>
									<th className="p-2">إجراءات</th>
								</tr>
							</thead>
							<tbody>
								{salaries.map((s) => (
									<tr key={s.id} className="border-t border-slate-100 dark:border-slate-700/60">
										<td className="p-2 font-bold text-slate-800 dark:text-white">
											{s.worker_name || workerNameById.get(s.worker_id) || s.worker_id}
										</td>
										<td className="p-2">{Number(s.base_salary || 0).toFixed(2)}</td>
										<td className="p-2 font-black">{Number(s.manufacturing_extra || 0).toFixed(2)}</td>
										<td className="p-2">{Number(s.deductions || 0).toFixed(2)}</td>
										<td className="p-2">{Number(s.bonuses || 0).toFixed(2)}</td>
										<td className="p-2 font-black">{Number(s.net_salary || 0).toFixed(2)}</td>
										<td className="p-2">{salaryStatusAr(s.status)}</td>
										<td className="p-2">
											{s.status === 'pending' ? (
												<button
													onClick={() => paySalary(s.id)}
													className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-black"
												>
													صرف
												</button>
											) : (
												<span className="text-xs text-slate-400">تم الصرف</span>
											)}
										</td>
									</tr>
								))}
								{salaries.length === 0 && (
									<tr>
										<td className="p-3 text-center text-slate-400" colSpan={7}>
											لا توجد بيانات
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{activeView === 'transactions' && (
				<div className="card p-4 space-y-4">
					<div className="flex items-center justify-between">
						<div className="text-sm font-black">معاملات العمال</div>
						<button
							onClick={addTransaction}
							className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black"
						>
							إضافة معاملة
						</button>
					</div>

					<div className="overflow-auto">
						<table className="min-w-full text-sm">
							<thead>
								<tr className="text-right text-slate-500">
									<th className="p-2">العامل</th>
									<th className="p-2">النوع</th>
									<th className="p-2">المبلغ</th>
									<th className="p-2">التاريخ</th>
									<th className="p-2">الحالة</th>
									<th className="p-2">ملاحظات</th>
								</tr>
							</thead>
							<tbody>
								{transactions.map((tx) => (
									<tr key={tx.id} className="border-t border-slate-100 dark:border-slate-700/60">
										<td className="p-2 font-bold text-slate-800 dark:text-white">
											{workerNameById.get(tx.worker_id) || tx.worker_id}
										</td>
										<td className="p-2">{txTypeAr(tx.type)}</td>
										<td className="p-2">{Number(tx.amount || 0).toFixed(2)}</td>
										<td className="p-2">{tx.date}</td>
										<td className="p-2">{txStatusAr(tx.status)}</td>
										<td className="p-2">{txNotesAr(tx.notes)}</td>
									</tr>
								))}
								{transactions.length === 0 && (
									<tr>
										<td className="p-3 text-center text-slate-400" colSpan={6}>
											لا توجد معاملات
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{activeView === 'salary-report' && (
				<div className="card p-4 space-y-4">
					<div className="flex items-center gap-2 flex-wrap">
						<CustomSelect
							value={reportWorkerId ? String(reportWorkerId) : ''}
							onChange={(v) => setReportWorkerId(v ? Number(v) : 0)}
							options={[{ value: '', label: 'اختر عامل' }, ...workers.map((w) => ({ value: String(w.id), label: w.name }))]}
						/>
						<input
							value={reportMonth}
							onChange={(e) => setReportMonth(e.target.value)}
							className="border rounded-xl px-3 py-2 text-xs dark:bg-slate-900"
							placeholder="YYYY-MM"
						/>
						<button
							onClick={loadReport}
							className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black"
						>
							عرض التقرير
						</button>
					</div>

					{reportData && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
								<div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
									<div className="text-xs text-slate-500">الأساسي (تقديري)</div>
									<div className="text-lg font-black">{Number(reportData?.computed?.base_salary || 0).toFixed(2)}</div>
								</div>
								<div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
									<div className="text-xs text-slate-500">المكافآت</div>
									<div className="text-lg font-black">{Number(reportData?.computed?.bonuses || 0).toFixed(2)}</div>
								</div>
								<div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
									<div className="text-xs text-slate-500">الخصومات</div>
									<div className="text-lg font-black">{Number(reportData?.computed?.deductions || 0).toFixed(2)}</div>
								</div>
								<div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
									<div className="text-xs text-slate-500">الصافي (تقديري)</div>
									<div className="text-lg font-black">{Number(reportData?.computed?.net_estimate || 0).toFixed(2)}</div>
								</div>
							</div>

							<div className="overflow-auto">
								<table className="min-w-full text-sm">
									<thead>
										<tr className="text-right text-slate-500">
											<th className="p-2">التاريخ</th>
											<th className="p-2">النوع</th>
											<th className="p-2">المبلغ</th>
											<th className="p-2">الحالة</th>
											<th className="p-2">ملاحظات</th>
										</tr>
									</thead>
									<tbody>
										{(reportData?.transactions?.rows || []).map((tx: any) => (
											<tr key={tx.id} className="border-t border-slate-100 dark:border-slate-700/60">
												<td className="p-2">{tx.date}</td>
												<td className="p-2">{txTypeAr(tx.type)}</td>
												<td className="p-2">{Number(tx.amount || 0).toFixed(2)}</td>
												<td className="p-2">{txStatusAr(tx.status)}</td>
												<td className="p-2">{txNotesAr(tx.notes)}</td>
											</tr>
										))}
										{(!reportData?.transactions?.rows || reportData.transactions.rows.length === 0) && (
											<tr>
												<td className="p-3 text-center text-slate-400" colSpan={5}>
													لا توجد معاملات
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default WorkersModule;