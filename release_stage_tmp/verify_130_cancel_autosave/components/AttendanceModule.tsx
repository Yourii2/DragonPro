import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Fingerprint, Plus, RefreshCw, Save, Upload } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';

const dayOptions = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' }
];

type AttendanceTab = 'devices' | 'shifts' | 'schedules' | 'holidays' | 'logs' | 'summary';

interface AttendanceModuleProps {
  initialTab?: AttendanceTab | string;
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<AttendanceTab>('devices');

  const [employees, setEmployees] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceUsers, setDeviceUsers] = useState<any[]>([]);
  const [deviceWorkers, setDeviceWorkers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);

  const [deviceForm, setDeviceForm] = useState({
    name: '',
    vendor: 'hikvision',
    protocol: 'http',
    driver: 'hikvision_isapi',
    driver_config: '',
    ip: '',
    port: '80',
    serial_number: '',
    username: '',
    password: '',
    location: '',
    enabled: true
  });

  const [deviceUserForm, setDeviceUserForm] = useState({ device_id: '', employee_id: '', device_user_id: '' });
  const [deviceWorkerForm, setDeviceWorkerForm] = useState({ device_id: '', worker_id: '', device_user_id: '' });

  const [pullForm, setPullForm] = useState({ device_id: '', start_date: '', end_date: '' });
  const [pullLoading, setPullLoading] = useState(false);

  const [shiftForm, setShiftForm] = useState({
    name: '',
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: '0',
    grace_in_minutes: '0',
    grace_out_minutes: '0',
    late_penalty_per_minute: '0',
    early_leave_penalty_per_minute: '0',
    absence_penalty_per_day: '0',
    overtime_rate_per_hour: '0',
    is_night_shift: false,
    weekly_off_days: [] as number[]
  });

  const [scheduleForm, setScheduleForm] = useState({
    employee_id: '',
    shift_id: '',
    day_of_week: '0',
    valid_from: '',
    valid_to: ''
  });

  const [holidayForm, setHolidayForm] = useState({ name: '', holiday_date: '', is_paid: true });

  const [logRange, setLogRange] = useState({ start_date: '', end_date: '' });
  const [summaryRange, setSummaryRange] = useState({ start_date: '', end_date: '' });
  const [importDeviceId, setImportDeviceId] = useState('');
  const [scanConfig, setScanConfig] = useState({
    network: '192.168.1',
    start: '1',
    end: '254',
    ports: '80,8000,4370'
  });
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [scanLoading, setScanLoading] = useState(false);

  const vendorLabels: Record<string, string> = useMemo(() => ({
    hikvision: 'Hikvision',
    zkteco: 'ZKTeco',
    adms: 'ADMS',
    other: 'أخرى'
  }), []);

  const driverLabels: Record<string, string> = useMemo(() => ({
    adms_push: 'Push (ADMS/ZKTeco)',
    hikvision_isapi: 'Hikvision ISAPI (Pull)',
    http_json_pull: 'HTTP JSON (Pull)',
    manual: 'Manual/CSV'
  }), []);

  const inferDefaultDriver = (vendor: string) => {
    if (vendor === 'hikvision') return 'hikvision_isapi';
    if (vendor === 'adms' || vendor === 'zkteco') return 'adms_push';
    return 'manual';
  };

  const fetchAll = async () => {
    try {
      const [empRes, workerRes, devRes, devUserRes, devWorkerRes, shiftRes, schedRes, holidayRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=employees&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=workers&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=attendance_devices&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=attendance_device_users&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=attendance_device_workers&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=attendance_shifts&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=attendance_schedules&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=attendance_holidays&action=getAll`).then(r => r.json())
      ]);

      setEmployees(empRes.success ? empRes.data : []);
      setWorkers(workerRes.success ? workerRes.data : []);
      setDevices(devRes.success ? devRes.data : []);
      setDeviceUsers(devUserRes.success ? devUserRes.data : []);
      setDeviceWorkers(devWorkerRes.success ? devWorkerRes.data : []);
      setShifts(shiftRes.success ? shiftRes.data : []);
      setSchedules(schedRes.success ? schedRes.data : []);
      setHolidays(holidayRes.success ? holidayRes.data : []);
    } catch (error) {
      Swal.fire('خطأ', 'تعذر تحميل بيانات البصمة.', 'error');
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const allowed: AttendanceTab[] = ['devices', 'shifts', 'schedules', 'holidays', 'logs', 'summary'];
    if (initialTab && allowed.includes(initialTab as AttendanceTab)) {
      setActiveTab(initialTab as AttendanceTab);
    }
  }, [initialTab]);

  const handleCreate = async (endpoint: string, payload: any, onSuccess: () => void) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        Swal.fire('خطأ', data.message || 'فشل الحفظ.', 'error');
      }
    } catch (error) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    }
  };

  const handleImportCsv = async (file: File) => {
    if (!importDeviceId) {
      Swal.fire('تنبيه', 'يرجى اختيار جهاز للاستيراد.', 'warning');
      return;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const items = lines.map(line => {
      const cols = line.split(',');
      return {
        device_id: Number(importDeviceId),
        device_user_id: cols[0]?.trim(),
        check_time: cols[1]?.trim(),
        direction: cols[2]?.trim() || 'unknown',
        source: 'csv'
      };
    }).filter(it => it.device_user_id && it.check_time);

    if (items.length === 0) {
      Swal.fire('تنبيه', 'لم يتم العثور على سجلات صالحة.', 'warning');
      return;
    }

    await handleCreate(
      `${API_BASE_PATH}/api.php?module=attendance_logs&action=bulkInsert`,
      { items },
      () => Swal.fire('تم', 'تم استيراد السجلات بنجاح.', 'success')
    );
  };

  const fetchLogs = async () => {
    if (!logRange.start_date || !logRange.end_date) {
      Swal.fire('تنبيه', 'حدد فترة البحث أولاً.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=attendance_logs&action=getByRange&start_date=${logRange.start_date}&end_date=${logRange.end_date}`);
      const data = await res.json();
      setLogs(data.success ? data.data : []);
    } catch (error) {
      Swal.fire('خطأ', 'تعذر تحميل السجلات.', 'error');
    }
  };

  const generateSummary = async () => {
    if (!summaryRange.start_date || !summaryRange.end_date) {
      Swal.fire('تنبيه', 'حدد فترة الملخص أولاً.', 'warning');
      return;
    }
    await handleCreate(
      `${API_BASE_PATH}/api.php?module=attendance_summary&action=generateForRange`,
      summaryRange,
      () => Swal.fire('تم', 'تم إنشاء الملخص بنجاح.', 'success')
    );
    fetchSummary();
  };

  const fetchSummary = async () => {
    if (!summaryRange.start_date || !summaryRange.end_date) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=attendance_summary&action=getForRange&start_date=${summaryRange.start_date}&end_date=${summaryRange.end_date}`);
      const data = await res.json();
      setSummaries(data.success ? data.data : []);
    } catch (error) {
      Swal.fire('خطأ', 'تعذر تحميل الملخص.', 'error');
    }
  };

  const handleScanNetwork = async () => {
    if (!scanConfig.network) {
      Swal.fire('تنبيه', 'يرجى إدخال نطاق الشبكة أولاً.', 'warning');
      return;
    }
    setScanLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/attendance_scan.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: scanConfig.network,
          start: Number(scanConfig.start || 1),
          end: Number(scanConfig.end || 254),
          ports: scanConfig.ports
        })
      });
      const data = await res.json();
      if (data.success) {
        setScanResults(data.data || []);
      } else {
        Swal.fire('خطأ', data.message || 'فشل البحث عن الأجهزة.', 'error');
      }
    } catch (error) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setScanLoading(false);
    }
  };

  const handleConnectDevice = (device: any) => {
    setDeviceForm(prev => ({
      ...prev,
      ip: device.ip || prev.ip,
      port: device.port ? String(device.port) : prev.port,
      vendor: device.vendor || prev.vendor,
      protocol: 'http'
    }));
    Swal.fire('تم', 'تم نقل بيانات الجهاز إلى النموذج.', 'success');
  };

  const handlePullLogs = async () => {
    if (!pullForm.device_id || !pullForm.start_date || !pullForm.end_date) {
      Swal.fire('تنبيه', 'اختر الجهاز وحدد الفترة أولاً.', 'warning');
      return;
    }
    setPullLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=attendance_devices&action=pullLogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: Number(pullForm.device_id),
          start_date: pullForm.start_date,
          end_date: pullForm.end_date
        })
      });
      const data = await res.json();
      if (data.success) {
        const msg = data.message || 'تم السحب.';
        const inserted = typeof data.inserted === 'number' ? data.inserted : null;
        Swal.fire('تم', inserted !== null ? `${msg} (تم إدخال: ${inserted})` : msg, 'success');
        fetchAll();
      } else {
        Swal.fire('خطأ', data.message || 'فشل السحب.', 'error');
      }
    } catch (error) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setPullLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'devices', label: 'الأجهزة' },
          { key: 'shifts', label: 'الورديات' },
          { key: 'schedules', label: 'الجداول' },
          { key: 'holidays', label: 'العطلات' },
          { key: 'logs', label: 'السجلات' },
          { key: 'summary', label: 'الملخص' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab.key ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl border border-card shadow-sm card lg:col-span-2" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4 flex items-center gap-2"><Fingerprint size={18}/> البحث عن أجهزة على الشبكة</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted">نطاق الشبكة</label>
                <input
                  className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2"
                  placeholder="مثال 192.168.1"
                  value={scanConfig.network}
                  onChange={e => setScanConfig({ ...scanConfig, network: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">بداية</label>
                <input
                  className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2"
                  placeholder="1"
                  value={scanConfig.start}
                  onChange={e => setScanConfig({ ...scanConfig, start: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">نهاية</label>
                <input
                  className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2"
                  placeholder="254"
                  value={scanConfig.end}
                  onChange={e => setScanConfig({ ...scanConfig, end: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">المنافذ</label>
                <input
                  className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2"
                  placeholder="80,8000,4370"
                  value={scanConfig.ports}
                  onChange={e => setScanConfig({ ...scanConfig, ports: e.target.value })}
                />
              </div>
            </div>
            <button
              className="mt-4 bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2"
              onClick={handleScanNetwork}
              disabled={scanLoading}
            >
              <RefreshCw size={14}/> {scanLoading ? 'جارٍ البحث...' : 'بحث عن الأجهزة'}
            </button>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted">
                  <tr>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">المنفذ</th>
                    <th className="px-3 py-2">النوع</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-muted" colSpan={4}>لا توجد أجهزة مكتشفة.</td>
                    </tr>
                  )}
                  {scanResults.map((d: any) => (
                    <tr key={`${d.ip}-${d.port}`} className="border-t border-slate-200/50">
                      <td className="px-3 py-2 font-bold">{d.ip}</td>
                      <td className="px-3 py-2">{d.port}</td>
                      <td className="px-3 py-2">{vendorLabels[d.vendor] || d.vendor}</td>
                      <td className="px-3 py-2">
                        <button className="px-3 py-1 bg-slate-200 rounded-lg" onClick={() => handleConnectDevice(d)}>اتصال</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4 flex items-center gap-2"><Fingerprint size={18}/> إضافة جهاز بصمة</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted">اسم الجهاز</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="اسم الجهاز" value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">النوع</label>
                <CustomSelect
                  value={deviceForm.vendor}
                  onChange={v => {
                    const nextVendor = v;
                    setDeviceForm(prev => ({
                      ...prev,
                      vendor: nextVendor,
                      driver: prev.driver ? prev.driver : inferDefaultDriver(nextVendor)
                    }));
                  }}
                  options={[
                    { value: 'hikvision', label: 'Hikvision' },
                    { value: 'zkteco', label: 'ZKTeco' },
                    { value: 'adms', label: 'ADMS' },
                    { value: 'other', label: 'أخرى' }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Driver</label>
                <CustomSelect
                  value={deviceForm.driver}
                  onChange={v => setDeviceForm({ ...deviceForm, driver: v })}
                  options={[
                    { value: 'adms_push', label: driverLabels.adms_push },
                    { value: 'hikvision_isapi', label: driverLabels.hikvision_isapi },
                    { value: 'http_json_pull', label: driverLabels.http_json_pull },
                    { value: 'manual', label: driverLabels.manual }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[11px] text-muted">Driver Config (JSON)</label>
                <textarea
                  className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 min-h-[90px]"
                  placeholder='مثال: {"path":"/ISAPI/AccessControl/AcsEvent","max_results":50} أو اتركه فارغاً'
                  value={deviceForm.driver_config}
                  onChange={e => setDeviceForm({ ...deviceForm, driver_config: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">عنوان IP</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="IP" value={deviceForm.ip} onChange={e => setDeviceForm({ ...deviceForm, ip: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">المنفذ</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="Port" value={deviceForm.port} onChange={e => setDeviceForm({ ...deviceForm, port: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">السيريال</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="Serial" value={deviceForm.serial_number} onChange={e => setDeviceForm({ ...deviceForm, serial_number: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">الموقع</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="Location" value={deviceForm.location} onChange={e => setDeviceForm({ ...deviceForm, location: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">اسم المستخدم</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="Username" value={deviceForm.username} onChange={e => setDeviceForm({ ...deviceForm, username: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">كلمة المرور</label>
                <input type="password" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="Password" value={deviceForm.password} onChange={e => setDeviceForm({ ...deviceForm, password: e.target.value })} />
              </div>
            </div>
            <button
              className="mt-4 w-full bg-accent text-white py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2"
              onClick={() => handleCreate(
                `${API_BASE_PATH}/api.php?module=attendance_devices&action=create`,
                { ...deviceForm, port: Number(deviceForm.port), enabled: deviceForm.enabled ? 1 : 0 },
                () => {
                  Swal.fire('تم', 'تم حفظ الجهاز.', 'success');
                  setDeviceForm({ ...deviceForm, name: '', ip: '', serial_number: '', location: '', driver_config: '' });
                  fetchAll();
                }
              )}
            >
              <Save size={16}/> حفظ الجهاز
            </button>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">سحب السجلات (Pull Sync)</h3>
            <div className="grid grid-cols-1 gap-3 text-xs">
              <CustomSelect
                value={String(pullForm.device_id || '')}
                onChange={v => setPullForm({ ...pullForm, device_id: v })}
                options={[{ value: '', label: 'اختر الجهاز' }, ...devices.map((d:any)=>({ value: String(d.id), label: d.name }))]}
                className="w-full"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted">من</label>
                  <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 w-full" value={pullForm.start_date} onChange={e => setPullForm({ ...pullForm, start_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted">إلى</label>
                  <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 w-full" value={pullForm.end_date} onChange={e => setPullForm({ ...pullForm, end_date: e.target.value })} />
                </div>
              </div>
            </div>
            <button
              className="mt-4 w-full bg-slate-700 text-white py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2"
              onClick={handlePullLogs}
              disabled={pullLoading}
            >
              <RefreshCw size={16}/> {pullLoading ? 'جارٍ السحب...' : 'سحب السجلات'}
            </button>
            <div className="mt-3 text-xs text-muted">
              ملاحظة: بعض الأجهزة تعمل Push فقط (ADMS/ZKTeco) ولا تدعم Pull.
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">ربط الموظفين بالأجهزة</h3>
            <div className="grid grid-cols-1 gap-3 text-xs">
              <CustomSelect
                value={String(deviceUserForm.device_id || '')}
                onChange={v => setDeviceUserForm({ ...deviceUserForm, device_id: v })}
                options={[{ value: '', label: 'اختر الجهاز' }, ...devices.map((d:any)=>({ value: String(d.id), label: d.name }))]}
                className="w-full"
              />
              <CustomSelect
                value={String(deviceUserForm.employee_id || '')}
                onChange={v => setDeviceUserForm({ ...deviceUserForm, employee_id: v })}
                options={[{ value: '', label: 'اختر الموظف' }, ...employees.map((emp:any)=>({ value: String(emp.id), label: emp.name }))]}
                className="w-full"
              />
              <div className="space-y-1">
                <label className="text-[11px] text-muted">رقم المستخدم على الجهاز</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="رقم المستخدم على الجهاز" value={deviceUserForm.device_user_id} onChange={e => setDeviceUserForm({ ...deviceUserForm, device_user_id: e.target.value })} />
              </div>
            </div>
            <button
              className="mt-4 w-full bg-emerald-600 text-white py-3 rounded-2xl text-xs font-black"
              onClick={() => handleCreate(
                `${API_BASE_PATH}/api.php?module=attendance_device_users&action=create`,
                { ...deviceUserForm },
                () => {
                  Swal.fire('تم', 'تم حفظ الربط.', 'success');
                  setDeviceUserForm({ device_id: '', employee_id: '', device_user_id: '' });
                  fetchAll();
                }
              )}
            >
              حفظ الربط
            </button>

            <div className="mt-4 text-xs text-muted">رابط الدفع للأجهزة (ZKTeco/ADMS):<br/>
              <span className="font-mono">{window.location.origin}/components/attendance_push.php</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">ربط العمال بالأجهزة</h3>
            <div className="grid grid-cols-1 gap-3 text-xs">
              <CustomSelect
                value={String(deviceWorkerForm.device_id || '')}
                onChange={v => setDeviceWorkerForm({ ...deviceWorkerForm, device_id: v })}
                options={[{ value: '', label: 'اختر الجهاز' }, ...devices.map((d:any)=>({ value: String(d.id), label: d.name }))]}
                className="w-full"
              />
              <CustomSelect
                value={String(deviceWorkerForm.worker_id || '')}
                onChange={v => setDeviceWorkerForm({ ...deviceWorkerForm, worker_id: v })}
                options={[{ value: '', label: 'اختر العامل' }, ...workers.map((w:any)=>({ value: String(w.id), label: w.name }))]}
                className="w-full"
              />
              <div className="space-y-1">
                <label className="text-[11px] text-muted">رقم المستخدم على الجهاز</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="رقم المستخدم على الجهاز" value={deviceWorkerForm.device_user_id} onChange={e => setDeviceWorkerForm({ ...deviceWorkerForm, device_user_id: e.target.value })} />
              </div>
            </div>
            <button
              className="mt-4 w-full bg-emerald-600 text-white py-3 rounded-2xl text-xs font-black"
              onClick={() => handleCreate(
                `${API_BASE_PATH}/api.php?module=attendance_device_workers&action=setForWorker`,
                { ...deviceWorkerForm },
                () => {
                  Swal.fire('تم', 'تم حفظ ربط العامل.', 'success');
                  setDeviceWorkerForm({ device_id: '', worker_id: '', device_user_id: '' });
                  fetchAll();
                }
              )}
            >
              حفظ الربط
            </button>
            {deviceWorkers.length > 0 && (
              <div className="mt-4 text-xs text-muted">
                تم ربط {deviceWorkers.length} عامل/جهاز.
              </div>
            )}
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card lg:col-span-2" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">قائمة الأجهزة</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted">
                  <tr>
                    <th className="px-3 py-2">الاسم</th>
                    <th className="px-3 py-2">النوع</th>
                    <th className="px-3 py-2">Driver</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Serial</th>
                    <th className="px-3 py-2">آخر مزامنة</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map(d => (
                    <tr key={d.id} className="border-t border-slate-200/50">
                      <td className="px-3 py-2 font-bold">{d.name}</td>
                      <td className="px-3 py-2">{vendorLabels[d.vendor] || d.vendor}</td>
                      <td className="px-3 py-2">{driverLabels[d.driver] || d.driver || '-'}</td>
                      <td className="px-3 py-2">{d.ip || '-'}</td>
                      <td className="px-3 py-2">{d.serial_number || '-'}</td>
                      <td className="px-3 py-2">{d.last_sync_at || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shifts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">إضافة وردية</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted">اسم الوردية</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="اسم الوردية" value={shiftForm.name} onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">وقت البداية</label>
                <input type="time" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={shiftForm.start_time} onChange={e => setShiftForm({ ...shiftForm, start_time: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">وقت النهاية</label>
                <input type="time" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={shiftForm.end_time} onChange={e => setShiftForm({ ...shiftForm, end_time: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">فترة الراحة (دقائق)</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="0" value={shiftForm.break_minutes} onChange={e => setShiftForm({ ...shiftForm, break_minutes: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">سماح الدخول</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="0" value={shiftForm.grace_in_minutes} onChange={e => setShiftForm({ ...shiftForm, grace_in_minutes: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">سماح الخروج</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="0" value={shiftForm.grace_out_minutes} onChange={e => setShiftForm({ ...shiftForm, grace_out_minutes: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">خصم التأخير / دقيقة</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="0" value={shiftForm.late_penalty_per_minute} onChange={e => setShiftForm({ ...shiftForm, late_penalty_per_minute: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">خصم خروج مبكر / دقيقة</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="0" value={shiftForm.early_leave_penalty_per_minute} onChange={e => setShiftForm({ ...shiftForm, early_leave_penalty_per_minute: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">خصم الغياب / يوم</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="0" value={shiftForm.absence_penalty_per_day} onChange={e => setShiftForm({ ...shiftForm, absence_penalty_per_day: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">سعر الإضافي / ساعة</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="0" value={shiftForm.overtime_rate_per_hour} onChange={e => setShiftForm({ ...shiftForm, overtime_rate_per_hour: e.target.value })} />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[11px] text-muted">أيام العطلة الأسبوعية</label>
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 border border-card">
                      <input
                        type="checkbox"
                        checked={shiftForm.weekly_off_days.includes(opt.value)}
                        onChange={(e) => {
                          const exists = shiftForm.weekly_off_days.includes(opt.value);
                          const next = e.target.checked
                            ? [...shiftForm.weekly_off_days, opt.value]
                            : shiftForm.weekly_off_days.filter(v => v !== opt.value);
                          setShiftForm({ ...shiftForm, weekly_off_days: next });
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={shiftForm.is_night_shift} onChange={e => setShiftForm({ ...shiftForm, is_night_shift: e.target.checked })} />
                وردية ليلية
              </label>
            </div>
            <button
              className="mt-4 w-full bg-accent text-white py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2"
              onClick={() => handleCreate(
                `${API_BASE_PATH}/api.php?module=attendance_shifts&action=create`,
                {
                  ...shiftForm,
                  break_minutes: Number(shiftForm.break_minutes),
                  grace_in_minutes: Number(shiftForm.grace_in_minutes),
                  grace_out_minutes: Number(shiftForm.grace_out_minutes),
                  late_penalty_per_minute: Number(shiftForm.late_penalty_per_minute),
                  early_leave_penalty_per_minute: Number(shiftForm.early_leave_penalty_per_minute),
                  absence_penalty_per_day: Number(shiftForm.absence_penalty_per_day),
                  overtime_rate_per_hour: Number(shiftForm.overtime_rate_per_hour),
                  is_night_shift: shiftForm.is_night_shift ? 1 : 0,
                  weekly_off_days: shiftForm.weekly_off_days.join(',')
                },
                () => {
                  Swal.fire('تم', 'تم حفظ الوردية.', 'success');
                  fetchAll();
                }
              )}
            >
              <Save size={16}/> حفظ الوردية
            </button>
          </div>
          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">قائمة الورديات</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted">
                  <tr>
                    <th className="px-3 py-2">الاسم</th>
                    <th className="px-3 py-2">الوقت</th>
                    <th className="px-3 py-2">سماح</th>
                    <th className="px-3 py-2">العطلة الأسبوعية</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s: any) => (
                    <tr key={s.id} className="border-t border-slate-200/50">
                      <td className="px-3 py-2 font-bold">{s.name}</td>
                      <td className="px-3 py-2">{s.start_time} - {s.end_time}</td>
                      <td className="px-3 py-2">{s.grace_in_minutes}/{s.grace_out_minutes}</td>
                      <td className="px-3 py-2">
                        {(s.weekly_off_days || '')
                          .toString()
                          .split(',')
                          .filter((v: string) => v !== '')
                          .map((v: string) => dayOptions.find(d => d.value === Number(v))?.label || v)
                          .join('، ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">إضافة جدول دوام</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted">الموظف</label>
                <CustomSelect
                  value={scheduleForm.employee_id ? String(scheduleForm.employee_id) : ''}
                  onChange={v => setScheduleForm({ ...scheduleForm, employee_id: v })}
                  options={[{ value: '', label: 'اختر الموظف' }, ...employees.map(emp => ({ value: String(emp.id), label: emp.name }))]}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">الوردية</label>
                <CustomSelect
                  value={scheduleForm.shift_id ? String(scheduleForm.shift_id) : ''}
                  onChange={v => setScheduleForm({ ...scheduleForm, shift_id: v })}
                  options={[{ value: '', label: 'اختر الوردية' }, ...shifts.map((s:any) => ({ value: String(s.id), label: s.name }))]}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">اليوم</label>
                <CustomSelect
                  value={scheduleForm.day_of_week ? String(scheduleForm.day_of_week) : ''}
                  onChange={v => setScheduleForm({ ...scheduleForm, day_of_week: v })}
                  options={dayOptions.map(opt => ({ value: String(opt.value), label: opt.label }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">تاريخ البداية</label>
                <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={scheduleForm.valid_from} onChange={e => setScheduleForm({ ...scheduleForm, valid_from: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">تاريخ النهاية</label>
                <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={scheduleForm.valid_to} onChange={e => setScheduleForm({ ...scheduleForm, valid_to: e.target.value })} />
              </div>
            </div>
            <button
              className="mt-4 w-full bg-accent text-white py-3 rounded-2xl text-xs font-black"
              onClick={() => handleCreate(
                `${API_BASE_PATH}/api.php?module=attendance_schedules&action=create`,
                {
                  ...scheduleForm,
                  employee_id: Number(scheduleForm.employee_id),
                  shift_id: Number(scheduleForm.shift_id),
                  day_of_week: Number(scheduleForm.day_of_week)
                },
                () => {
                  Swal.fire('تم', 'تم حفظ الجدول.', 'success');
                  fetchAll();
                }
              )}
            >
              حفظ الجدول
            </button>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">قائمة الجداول</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted">
                  <tr>
                    <th className="px-3 py-2">الموظف</th>
                    <th className="px-3 py-2">اليوم</th>
                    <th className="px-3 py-2">الوردية</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s: any) => (
                    <tr key={s.id} className="border-t border-slate-200/50">
                      <td className="px-3 py-2 font-bold">{employees.find(e => e.id === s.employee_id)?.name || s.employee_id}</td>
                      <td className="px-3 py-2">{dayOptions.find(d => d.value === Number(s.day_of_week))?.label || s.day_of_week}</td>
                      <td className="px-3 py-2">{shifts.find((sh: any) => sh.id === s.shift_id)?.name || s.shift_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'holidays' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">إضافة عطلة</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted">اسم العطلة</label>
                <input className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" placeholder="اسم العطلة" value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">تاريخ العطلة</label>
                <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={holidayForm.holiday_date} onChange={e => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={holidayForm.is_paid} onChange={e => setHolidayForm({ ...holidayForm, is_paid: e.target.checked })} />
                عطلة مدفوعة
              </label>
            </div>
            <button
              className="mt-4 w-full bg-accent text-white py-3 rounded-2xl text-xs font-black"
              onClick={() => handleCreate(
                `${API_BASE_PATH}/api.php?module=attendance_holidays&action=create`,
                { ...holidayForm, is_paid: holidayForm.is_paid ? 1 : 0 },
                () => {
                  Swal.fire('تم', 'تم حفظ العطلة.', 'success');
                  fetchAll();
                }
              )}
            >
              حفظ العطلة
            </button>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">قائمة العطلات</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted">
                  <tr>
                    <th className="px-3 py-2">العطلة</th>
                    <th className="px-3 py-2">التاريخ</th>
                    <th className="px-3 py-2">مدفوعة</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h: any) => (
                    <tr key={h.id} className="border-t border-slate-200/50">
                      <td className="px-3 py-2 font-bold">{h.name}</td>
                      <td className="px-3 py-2">{h.holiday_date}</td>
                      <td className="px-3 py-2">{Number(h.is_paid) === 1 ? 'نعم' : 'لا'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">استيراد سجلات CSV</h3>
            <CustomSelect
              value={importDeviceId ? String(importDeviceId) : ''}
              onChange={v => setImportDeviceId(v)}
              options={[{ value: '', label: 'اختر الجهاز' }, ...devices.map(d => ({ value: String(d.id), label: d.name }))]}
              className="w-full"
            />
            <input
              type="file"
              accept=".csv"
              className="mt-3 text-xs"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImportCsv(file);
              }}
            />
            <p className="text-[11px] text-muted mt-2">صيغة CSV: device_user_id,check_time,direction</p>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="font-black mb-4">عرض السجلات</h3>
            <div className="flex gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted">من</label>
                <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={logRange.start_date} onChange={e => setLogRange({ ...logRange, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted">إلى</label>
                <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={logRange.end_date} onChange={e => setLogRange({ ...logRange, end_date: e.target.value })} />
              </div>
              <button className="px-3 py-2 bg-slate-200 rounded-xl text-xs" onClick={fetchLogs}><RefreshCw size={14}/></button>
            </div>
            <div className="mt-4 max-h-64 overflow-y-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted">
                  <tr>
                    <th className="px-2 py-1">الموظف</th>
                    <th className="px-2 py-1">التاريخ</th>
                    <th className="px-2 py-1">الاتجاه</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id} className="border-t border-slate-200/50">
                      <td className="px-2 py-1">{employees.find(e => e.id === l.employee_id)?.name || l.device_user_id || '-'}</td>
                      <td className="px-2 py-1">{l.check_time}</td>
                      <td className="px-2 py-1">{l.direction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <h3 className="font-black mb-4 flex items-center gap-2"><CalendarDays size={18}/> ملخص الحضور</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] text-muted">من</label>
              <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={summaryRange.start_date} onChange={e => setSummaryRange({ ...summaryRange, start_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted">إلى</label>
              <input type="date" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2" value={summaryRange.end_date} onChange={e => setSummaryRange({ ...summaryRange, end_date: e.target.value })} />
            </div>
            <button className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black" onClick={generateSummary}><Plus size={14}/> توليد الملخص</button>
            <button className="px-3 py-2 bg-slate-200 rounded-xl text-xs" onClick={fetchSummary}><Upload size={14}/> عرض</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="text-muted">
                <tr>
                  <th className="px-2 py-1">الموظف</th>
                  <th className="px-2 py-1">التاريخ</th>
                  <th className="px-2 py-1">الدخول</th>
                  <th className="px-2 py-1">الخروج</th>
                  <th className="px-2 py-1">تأخير</th>
                  <th className="px-2 py-1">انصراف مبكر</th>
                  <th className="px-2 py-1">حالة</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-200/50">
                    <td className="px-2 py-1">{s.employee_name}</td>
                    <td className="px-2 py-1">{s.work_date}</td>
                    <td className="px-2 py-1">{s.first_in || '-'}</td>
                    <td className="px-2 py-1">{s.last_out || '-'}</td>
                    <td className="px-2 py-1">{s.late_minutes}</td>
                    <td className="px-2 py-1">{s.early_leave_minutes}</td>
                    <td className="px-2 py-1">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceModule;
