import React from 'react';
import { assetUrl } from '../services/assetUrl';

const BrandedWelcome: React.FC = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6" dir="rtl">
      <div
        className="w-full max-w-2xl rounded-3xl border border-card card overflow-hidden"
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}
      >
        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
              <img
                src={assetUrl('Dragon.png')}
                alt="Dragon"
                className="w-16 h-16 md:w-20 md:h-20 object-contain"
              />
            </div>

            <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">دراجون برو</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300 font-semibold">
              اهلا بك فى برمجيات دراجون للأنظمه الامنيه
            </p>

            <div className="mt-6 w-full rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-4 text-right">
              <div className="text-sm font-bold">ملاحظة</div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                لوحة التحكم غير مفعلة لهذا المستخدم. تواصل مع مدير النظام لتفعيل صلاحية الوصول.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandedWelcome;
