
# Dragon Pro (Vite + PHP)

## تشغيل محلياً (Development)

**المتطلبات:** Node.js + XAMPP (Apache + MySQL)

1) إعداد قاعدة البيانات/الاتصال
- انسخ الملف `config.example.php` إلى `config.php` وعدّل بيانات الاتصال.
- ملاحظة: `config.php` غير مرفوع على GitHub لتجنب تسريب كلمات المرور.

2) تثبيت الحزم
- `npm install`
- على ويندوز: لو PowerShell مانع تشغيل سكربتات npm استخدم: `npm.cmd install`

3) تشغيل Vite
- `npm run dev`
- على ويندوز: `npm.cmd run dev`

## نشر على Apache (Production)

الـ build الناتج يتم وضعه في جذر المشروع (index.html + assets/) مع مجلد `components/` الخاص بـ PHP.
لإنشاء باكدج جاهز للرفع على GitHub Releases استخدم `Release.bat`.

## عمل إصدار GitHub Releases (مثال: v1.0.0)

1) تحديث رقم الإصدار
- المشروع يعتمد على `version.json` لعرض رقم الإصدار وميزة التحديث.
- ملف `package.json` أيضاً تم ضبطه ليعكس الإصدار.

2) إنشاء ملف ZIP للإصدار
- شغّل: `Release.bat 1.0.0`
   أو افتح `Release.bat` واتبع السؤال الخاص برقم الإصدار.

3) رفع الإصدار على GitHub
- أنشئ Release على GitHub بالـ tag: `v1.0.0`
- ارفع الملف الناتج من: `releases/DragonPro_v1.0.0.zip`

## ملاحظات مهمة

- ملفات الأسرار/البيئة (`.env*`) وملفات العميل (`uploads/`, `logs/`, `backups/`, `config.php`, `*.lic`) تم إضافتها إلى `.gitignore`.
- لو كانت `config.php` أو أي ملف حساس تم تتبعه من Git قبل كده، لازم يتشال من الـ index:
   - `git rm --cached config.php`
