import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { arEG } from 'date-fns/locale'; // Arabic (Egypt) for beautiful formatting

registerLocale('ar', arEG);

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string; // YYYY-MM-DD
  onChange: any; // Mocks the event object so existing handlers don't break
}

export const CustomDateInput: React.FC<Props> = ({ value, onChange, className, ...rest }) => {
  const selectedDate = value ? new Date(value) : null;

  const handleChange = (date: Date | null) => {
    let dateStr = '';
    if (date) {
        // Adjust timezone offset to avoid JS shifting to previous day
        const offset = date.getTimezoneOffset();
        const adjusted = new Date(date.getTime() - (offset * 60 * 1000));
        dateStr = adjusted.toISOString().split('T')[0];
    }
    const syntheticEvent = { target: { value: dateStr } };
    onChange(syntheticEvent);
  };

  return (
    <div className="relative inline-block w-full">
      <DatePicker
        selected={selectedDate}
        onChange={handleChange}
        dateFormat="dd/MM/yyyy"
        locale="ar"
        placeholderText="يوم/شهر/سنة"
        className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm ${className || ''}`}
        wrapperClassName="w-full"
        showPopperArrow={false}
        {...rest as any}
      />
    </div>
  );
};

export default CustomDateInput;
