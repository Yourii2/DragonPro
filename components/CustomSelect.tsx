import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Search, X } from 'lucide-react';

export type Option = { value: string; label: React.ReactNode; searchLabel?: string };

type Props = {
  value: string;
  onChange: (v: string) => void | Promise<void>;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  searchable?: boolean;
};

/**
 * Normalizes Arabic letters and diacritics for smart case/spelling insensitive searching
 */
function normalizeArabic(text: string): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

const CustomSelect: React.FC<Props> = ({
  value,
  onChange,
  options,
  placeholder = '— اختر —',
  disabled,
  className,
  required,
  searchable = true
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm('');
    }
  }, [open]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp = spaceBelow < 300 && rect.top > 300;
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

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const normTerm = normalizeArabic(searchTerm);
    return options.filter(o => {
      let text = o.searchLabel || '';
      if (!text && typeof o.label === 'string') {
        text = o.label;
      } else if (!text && React.isValidElement(o.label)) {
        const children = (o.label as any).props?.children;
        if (typeof children === 'string') text = children;
        else if (Array.isArray(children)) text = children.map(c => typeof c === 'string' ? c : '').join(' ');
        else text = String(o.value);
      }
      if (!text) text = String(o.value);
      return normalizeArabic(text).includes(normTerm);
    });
  }, [options, searchTerm, searchable]);

  const dropdown = open ? ReactDOM.createPortal(
    <div
      ref={dropRef}
      style={dropStyle}
      className="max-h-72 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
    >
      {searchable && options.length > 0 && (
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute right-2.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم..."
              className="w-full pr-8 pl-7 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-auto flex-1 py-1 max-h-56">
        {filteredOptions.length > 0 ? (
          filteredOptions.map(o => {
            const isSelected = String(o.value) === String(value);
            return (
              <div
                key={String(o.value)}
                onMouseDown={e => {
                  e.preventDefault();
                  onChange(String(o.value));
                  setOpen(false);
                }}
                className={`px-3 py-2 text-xs font-bold hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer truncate flex items-center justify-between transition-colors ${
                  isSelected ? 'font-black bg-blue-100/60 dark:bg-slate-800 text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && <span className="text-blue-600 dark:text-blue-400 font-black mr-2">✓</span>}
              </div>
            );
          })
        ) : (
          <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">
            لا توجد نتائج متطابقة
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className || ''}`} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`w-full text-left rounded-2xl px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600'
        }`}
        aria-required={required}
      >
        <div className="flex items-center justify-between">
          <div className={`truncate ${selected ? 'font-bold' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</div>
          <div className="ml-2 text-sm text-slate-400">{open ? '▴' : '▾'}</div>
        </div>
      </button>
      {dropdown}
    </div>
  );
};

export default CustomSelect;
