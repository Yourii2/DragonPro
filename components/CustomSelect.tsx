import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

type Option = { value: string; label: React.ReactNode };

type Props = {
  value: string;
  onChange: (v: string) => void | Promise<void>;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
};

const CustomSelect: React.FC<Props> = ({ value, onChange, options, placeholder = '— اختر —', disabled, className, required }) => {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp = spaceBelow < 260 && rect.top > 260;
      setDropStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(goUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setOpen(s => !s);
  };

  const selected = options.find(o => String(o.value) === String(value));

  const dropdown = open ? ReactDOM.createPortal(
    <div
      ref={dropRef}
      style={dropStyle}
      className="max-h-60 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
    >
      {options.map(o => (
        <div
          key={String(o.value)}
          onMouseDown={e => { e.preventDefault(); onChange(String(o.value)); setOpen(false); }}
          className={`px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer truncate ${String(o.value) === String(value) ? 'font-black bg-blue-50' : ''}`}
          role="option"
          aria-selected={String(o.value) === String(value)}
        >
          {o.label}
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className || ''}`} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`w-full text-left rounded-2xl px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-required={required}
      >
        <div className="flex items-center justify-between">
          <div className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</div>
          <div className="ml-2 text-sm text-slate-400">{open ? '▴' : '▾'}</div>
        </div>
      </button>
      {dropdown}
    </div>
  );
};

export default CustomSelect;
