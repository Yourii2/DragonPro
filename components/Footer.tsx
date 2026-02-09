import React from 'react';
import { assetUrl } from '../services/assetUrl';

const Footer: React.FC = () => {
  const companyLogo = localStorage.getItem('Dragon_company_logo') || assetUrl('Dragon.png');
  const year = new Date().getFullYear();

  const contacts = [
    { number: '01050016289', label: 'مبيعات' },
    { number: '01150006289', label: 'الدعم' }
  ];

  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 py-4 px-6 mt-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* الهوية - حجم مدمج */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <img 
              src={companyLogo} 
              alt="logo" 
              className="w-10 h-10 rounded-lg shadow-sm object-cover border border-slate-200 dark:border-slate-700" 
              onError={(e: any) => { e.target.src = assetUrl('Dragon.png') }} 
            />
          </div>
          <div className="text-right">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">شركة دراجون للأنظمة الأمنية</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">جميع الحقوق محفوظة &copy; {year}</p>
          </div>
        </div>

        {/* المطور - شكل هندسي صغير */}
        <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            تطوير: <span className="font-bold">م. ممدوح المصري</span> (نظام دراجون برو)
          </span>
        </div>

        {/* التواصل - أزرار واتساب واتصال حقيقية */}
        <div className="flex items-center gap-2">
          {contacts.map((contact, index) => (
            <div key={index} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="hidden lg:block text-[10px] font-bold text-slate-400 px-1">{contact.label}</div>
              
              <div className="flex gap-1">
                {/* اتصال */}
                <a 
                  href={`tel:${contact.number}`}
                  className="w-7 h-7 flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-600 hover:text-white transition-all"
                  title="اتصال"
                >
                  <i className="fas fa-phone-alt text-[10px]"></i>
                </a>
                
                {/* واتساب الرسمي */}
                <a 
                  href={`https://wa.me/2${contact.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md hover:bg-green-600 hover:text-white transition-all"
                  title="واتساب"
                >
                  <i className="fab fa-whatsapp text-sm"></i>
                </a>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* رابط الأيقونات */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </footer>
  );
};

export default Footer;