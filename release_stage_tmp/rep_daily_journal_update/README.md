ملف التحديث: rep_daily_journal

وصف:
هذا المجلد يحتوي على سكريبتات مساعدة لتطبيق تحديث بنية قاعدة البيانات الخاصة بـ `rep_daily_journal` وتشغيل إعادة الحساب.

الملفات:
- `apply_update.ps1` : سكريبت PowerShell يُشغّل الهجرات ثم يعيد حساب جداول اليوميات لنطاق تواريخ (افتراضي 90 يومًا الماضية).
- `apply_update.bat` : ملف باتش لنظام Windows يقوم بنفس العمل (يدعو PowerShell داخليًا).

كيفية التشغيل (على الخادم أو بيئة العميل):
1) ضع المجلد داخل جذر مشروع Nexus (المسار الافتراضي هنا يفترض `c:\xampp\htdocs\Nexus`).
2) من داخل مجلد المشروع شغّل (PowerShell، مع صلاحيات كافية):

PowerShell:
```powershell
cd C:\xampp\htdocs\Nexus
.\release_stage_tmp\rep_daily_journal_update\apply_update.ps1
```

أو باستخدام الباتش (cmd):
```powershell
cd C:\xampp\htdocs\Nexus
release_stage_tmp\rep_daily_journal_update\apply_update.bat
```

خيارات (تحديد نطاق التاريخ):
- PowerShell: `.












اطلب مني أن أُحضّر أرشيف ZIP يضم هذه الملفات إن أردت ذلك للتوزيع على العميل.- `tools/fix_rep_daily_journal_index.php` (اختياري: يقوم بتعديل/حذف index إن لزم)- `scripts/recompute_rep_daily_journal.php` (يعيد ملء/إعادة حساب الصفوف)- `migrations/20260302_new_tables.sql` (يحتوي CREATE TABLE لـ `rep_daily_journal`)ملفات ذات صلة داخل المشروع:- السكريبتات تفترض وجود `php` في الـ PATH وتعمل من جذر المشروع.- تأكد من أخذ نسخة احتياطية من قاعدة البيانات قبل تشغيل أي هجرات أو سكريبتات تحديث.ملاحظات أمان:- Bat: `release_stage_tmp\rep_daily_journal_update\apply_update.bat 2025-12-03 2026-03-03`elease_stage_tmp\rep_daily_journal_update\apply_update.ps1 2025-12-03 2026-03-03`