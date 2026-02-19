import React, { useEffect, useRef, useState } from 'react';

type Option = { value: string; label: React.ReactNode };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const CustomSelect: React.FC<Props> = ({ value, onChange, options, placeholder = '— اختر —', disabled, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div className={`relative ${className || ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(s => !s)}
        className={`w-full text-left rounded-2xl px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center justify-between">
          <div className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</div>
          <div className="ml-2 text-sm text-slate-400">▾</div>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full max-h-60 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          {options.map(o => (
            <div
              key={String(o.value)}
              onClick={() => { onChange(String(o.value)); setOpen(false); }}
              className={`px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer truncate ${String(o.value) === String(value) ? 'font-black' : ''}`}
              role="option"
              aria-selected={String(o.value) === String(value)}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
