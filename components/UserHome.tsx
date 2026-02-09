import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';

const UserHome: React.FC = () => {
  const [modules, setModules] = useState<any[]>([]);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getMyModules`);
        const js = await res.json();
        if (js.success && Array.isArray(js.data)) setModules(js.data);
      } catch (e) { console.error('Failed to fetch my modules', e); }
    };
    fetchModules();
  }, []);

  if (!modules || modules.length === 0) return (<div className="p-6 bg-white rounded-2xl shadow-sm">لا توجد اختصارات حالياً. تواصل مع مدير النظام.</div>);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {modules.map(m => (
        <button key={m.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow hover:shadow-md text-right">
          <div className="font-bold text-sm">{m.name}</div>
        </button>
      ))}
    </div>
  );
};

export default UserHome;
