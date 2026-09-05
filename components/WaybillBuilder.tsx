import React, { useState } from 'react';
import { Layout, Palette, Zap } from 'lucide-react';
import WaybillBuilderQuick from './WaybillBuilderQuick';
import WaybillBuilderAdvanced from './WaybillBuilderAdvanced';

const WaybillBuilder: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'quick' | 'advanced'>('advanced');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4" dir="rtl">
      {/* Header & Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
            <Palette size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white">مصمم بوليصة الشحن</h1>
            <p className="text-xs text-slate-500">اختر النظام الذي يناسبك لتصميم البوليصة</p>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'quick' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Zap size={16} /> المصمم السريع
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'advanced' 
                ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Layout size={16} /> المصمم المتقدم
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="animate-in fade-in zoom-in duration-300">
        {activeTab === 'quick' ? <WaybillBuilderQuick /> : <WaybillBuilderAdvanced />}
      </div>
    </div>
  );
};

export default WaybillBuilder;
