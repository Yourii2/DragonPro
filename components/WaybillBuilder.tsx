import React, { useState, useEffect } from 'react';
import { Layout, Palette, Zap, LayoutTemplate, X } from 'lucide-react';
import WaybillBuilderQuick from './WaybillBuilderQuick';
import WaybillBuilderAdvanced from './WaybillBuilderAdvanced';
import WaybillTemplatesManager, { EditTemplatePayload } from './WaybillTemplatesManager';

export interface WaybillBuilderProps {
  initialPayload?: EditTemplatePayload | null;
  onClearPayload?: () => void;
}

const WaybillBuilder: React.FC<WaybillBuilderProps> = ({ initialPayload, onClearPayload }) => {
  const [editingPayload, setEditingPayload] = useState<EditTemplatePayload | null>(initialPayload || null);
  const [activeTab, setActiveTab] = useState<'quick' | 'advanced' | 'templates'>(() => {
    if (initialPayload?.type === 'advanced') return 'advanced';
    if (initialPayload?.type === 'quick') return 'quick';
    return 'templates';
  });
  const [advancedKey, setAdvancedKey] = useState<number>(Date.now());
  const [quickKey, setQuickKey] = useState<number>(Date.now());

  useEffect(() => {
    if (initialPayload) {
      setEditingPayload(initialPayload);
      if (initialPayload.type === 'advanced') {
        setAdvancedKey(Date.now());
        setActiveTab('advanced');
      } else if (initialPayload.type === 'quick') {
        setQuickKey(Date.now());
        setActiveTab('quick');
      }
    }
  }, [initialPayload]);

  const handleEdit = (payload: EditTemplatePayload) => {
    setEditingPayload(payload);
    if (payload.type === 'advanced') {
      setAdvancedKey(Date.now());
      setActiveTab('advanced');
    } else {
      setQuickKey(Date.now());
      setActiveTab('quick');
    }
  };

  const handleClearEditing = () => {
    setEditingPayload(null);
    if (onClearPayload) onClearPayload();
  };

  const handleCreateNew = (type: 'advanced' | 'quick') => {
    handleClearEditing();
    if (type === 'advanced') {
      setAdvancedKey(Date.now());
      setActiveTab('advanced');
    } else {
      setQuickKey(Date.now());
      setActiveTab('quick');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4" dir="rtl">
      {/* Header & Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <Palette size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-800 dark:text-white">مصمم وقوالب بوالص الشحن</h1>
              {editingPayload && (
                <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300/50">
                  <span>تعديل: {editingPayload.customTemplate?.name || editingPayload.initialData?.name || `نموذج ${editingPayload.templateId}`}</span>
                  <button 
                    onClick={handleClearEditing} 
                    className="hover:text-red-500 rounded-full"
                    title="إلغاء التعديل والبدء من جديد"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              اختر من بين 50 قالباً جاهزاً أو صمّم قالبك المخصص واحفظه في قائمة قوالب المستخدم
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl flex-wrap gap-1">
          <button
            onClick={() => {
              handleClearEditing();
              setActiveTab('templates');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'templates' 
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <LayoutTemplate size={16} /> معرض القوالب
          </button>
          <button
            onClick={() => {
              handleClearEditing();
              setQuickKey(Date.now());
              setActiveTab('quick');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'quick' 
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Zap size={16} /> المصمم السريع
          </button>
          <button
            onClick={() => {
              handleClearEditing();
              setAdvancedKey(Date.now());
              setActiveTab('advanced');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
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
        {activeTab === 'templates' && (
          <WaybillTemplatesManager 
            onEditTemplate={handleEdit} 
            onCreateNewTemplate={handleCreateNew}
          />
        )}
        {activeTab === 'quick' && (
          <WaybillBuilderQuick 
            key={quickKey}
            initialPayload={editingPayload?.type === 'quick' ? editingPayload : undefined}
            onBackToTemplates={() => {
              handleClearEditing();
              setActiveTab('templates');
            }}
          />
        )}
        {activeTab === 'advanced' && (
          <WaybillBuilderAdvanced 
            key={advancedKey}
            initialPayload={editingPayload?.type === 'advanced' ? editingPayload : undefined}
            onBackToTemplates={() => {
              handleClearEditing();
              setActiveTab('templates');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default WaybillBuilder;
