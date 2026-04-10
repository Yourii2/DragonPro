import React, { useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';

const CreateAdminUser: React.FC = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dragon, setDragon] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name || !username || !password || !dragon) {
      Swal.fire('خطأ', 'جميع الحقول مطلوبة', 'error');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_PATH}/../scripts/create_full_admin.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, dragon_password: dragon })
      });
      const j = await resp.json();
      if (!resp.ok || !j.success) {
        Swal.fire('فشل', j.message || 'فشل الإنشاء', 'error');
      } else {
        Swal.fire('تم', 'تم إنشاء المستخدم بامتيازات كاملة', 'success');
        setName(''); setUsername(''); setPassword(''); setDragon('');
      }
    } catch (err:any) {
      Swal.fire('خطأ', err.message || 'حدث خطأ', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h3 className="text-lg font-bold mb-3">إنشاء مستخدم مدير كامل الصلاحيات</h3>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full p-2 border rounded" placeholder="الاسم الكامل" value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full p-2 border rounded" placeholder="اسم المستخدم" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" className="w-full p-2 border rounded" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} />
        <input type="password" className="w-full p-2 border rounded" placeholder="كلمة مرور دراجون" value={dragon} onChange={e => setDragon(e.target.value)} />
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded" disabled={loading}>{loading ? 'جارٍ...' : 'إنشاء'}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateAdminUser;
