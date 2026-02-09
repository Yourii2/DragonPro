
import React from 'react';
import { SQL_SCHEMA } from '../services/dbSchema';
import { PHP_LOGIC } from '../services/phpLogic';
import { Terminal, Database, Shield } from 'lucide-react';

const Documentation: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto text-right">
      <div>
        <h1 className="text-3xl font-bold mb-2">المخطط الهندسي للنظام</h1>
        <p className="text-slate-500">المواصفات التقنية لمنطق العمليات الخلفية (Backend) المطلوبة.</p>
      </div>

      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-2 px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex-row-reverse">
          <Database className="text-blue-400 w-5 h-5" />
          <h3 className="text-white font-semibold flex-1">1. مخطط MySQL (الجداول والقيود)</h3>
        </div>
        <div className="p-6">
          <pre className="text-slate-300 text-sm overflow-x-auto leading-relaxed text-left" dir="ltr">
            <code>{SQL_SCHEMA}</code>
          </pre>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-2 px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex-row-reverse">
          <Shield className="text-emerald-400 w-5 h-5" />
          <h3 className="text-white font-semibold flex-1">2. منطق برمجة PHP (الصلاحيات ونطاق البيانات)</h3>
        </div>
        <div className="p-6">
          <pre className="text-slate-300 text-sm overflow-x-auto leading-relaxed text-left" dir="ltr">
            <code>{PHP_LOGIC}</code>
          </pre>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
          <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2 flex-row-reverse">
            <Terminal size={18} /> ملاحظات التنفيذ
          </h4>
          <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-2 list-disc mr-5">
            <li>يعتمد نظام الصلاحيات على 'Slug' يربط مسارات الواجهة بسجلات قاعدة البيانات.</li>
            <li>يتم فرض نطاق البيانات (Row-level scoping) عن طريق إضافة جمل WHERE إجبارية.</li>
            <li>يحتفظ نظام الخزينة بسجلات معاملات غير قابلة للتعديل لأغراض التدقيق.</li>
          </ul>
        </div>
        
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800">
          <h4 className="font-bold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-2 flex-row-reverse">
            <Shield size={18} /> أفضل الممارسات الأمنية
          </h4>
          <ul className="text-xs text-emerald-800 dark:text-emerald-400 space-y-2 list-disc mr-5">
            <li>استخدم دائماً PDO prepared statements (كما هو موضح في الأكواد).</li>
            <li>تشفير كلمات المرور باستخدام <code>password_hash()</code> BCRYPT.</li>
            <li>التحقق من <code>warehouse_id</code> في كل عملية إدخال أو تحديث.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
