import React from 'react';

interface Custom12HourTimePickerProps {
  label?: string;
  value: string; // HH:mm (24h format string)
  onChange: (time24: string) => void;
}

const HOURS = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const Custom12HourTimePicker: React.FC<Custom12HourTimePickerProps> = ({
  label,
  value,
  onChange,
}) => {
  // Parse current 24h value
  let selectedHour = '12';
  let selectedMinute = '00';
  let selectedPeriod: 'AM' | 'PM' = 'AM';

  if (value && value.includes(':')) {
    const [hStr, mStr] = value.split(':');
    let h = parseInt(hStr || '0', 10);
    selectedPeriod = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    selectedHour = h < 10 ? `0${h}` : `${h}`;
    selectedMinute = mStr || '00';
  }

  const updateTime = (h: string, m: string, p: 'AM' | 'PM') => {
    let hourNum = parseInt(h, 10);
    if (isNaN(hourNum)) hourNum = 12;
    if (p === 'PM' && hourNum < 12) hourNum += 12;
    if (p === 'AM' && hourNum === 12) hourNum = 0;
    const h24 = hourNum < 10 ? `0${hourNum}` : `${hourNum}`;
    const minStr = m || '00';
    onChange(`${h24}:${minStr}`);
  };

  return (
    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-2xl shadow-sm text-xs">
      {label && <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">{label}</span>}
      <div className="flex items-center gap-1">
        {/* Hour Dropdown */}
        <select
          value={selectedHour}
          onChange={(e) => updateTime(e.target.value, selectedMinute, selectedPeriod)}
          className="bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-extrabold px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-600 outline-none text-xs cursor-pointer hover:border-blue-400"
        >
          {HOURS.map((hr) => (
            <option key={hr} value={hr}>
              {hr}
            </option>
          ))}
        </select>

        <span className="font-black text-slate-400 dark:text-slate-500">:</span>

        {/* Minute Dropdown */}
        <select
          value={selectedMinute}
          onChange={(e) => updateTime(selectedHour, e.target.value, selectedPeriod)}
          className="bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-extrabold px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-600 outline-none text-xs cursor-pointer hover:border-blue-400"
        >
          {MINUTES.map((mn) => (
            <option key={mn} value={mn}>
              {mn}
            </option>
          ))}
        </select>

        {/* AM / PM Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-700/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-600 mr-1">
          <button
            type="button"
            onClick={() => updateTime(selectedHour, selectedMinute, 'AM')}
            className={`px-2 py-1 rounded-lg text-xs font-black transition-all ${
              selectedPeriod === 'AM'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            صباحاً
          </button>
          <button
            type="button"
            onClick={() => updateTime(selectedHour, selectedMinute, 'PM')}
            className={`px-2 py-1 rounded-lg text-xs font-black transition-all ${
              selectedPeriod === 'PM'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            مساءً
          </button>
        </div>
      </div>
    </div>
  );
};

export default Custom12HourTimePicker;
