# Release Notes 1.3.2

- Fix: إصلاح حفظ المرتجعات من صفحة `تسجيل المرتجعات` عبر تمرير `rep_id` الصحيح لكل أوردر (بدلاً من الاعتماد على معرف صف التجميع).
- Fix: توحيد منطق المرتجع في `إغلاق اليومية` بين الصندوق والتفاصيل، مع فلترة أدق لحالات المرتجع الفعلية.
- Feature: إضافة عرض `عدد القطع المرتجعة` داخل بطاقة `إجمالي مرتجع`.
- Update: عرض قيمة `إجمالي تسليم` بدون مصاريف الشحن.
- Update: عرض قيمة `المؤجل` بدون مصاريف الشحن.
- Update: توحيد قيم التفاصيل في المودال مع نفس منطق الكروت لضمان التطابق الحسابي.
- Backend: تحسين حفظ/تحديث `rep_journal_orders` وحقول `returned_pieces` و`returned_value` للحالات الجزئية مع fallback للحالات التاريخية.

## Verification
- TypeScript checks for edited frontend files: Passed
- PHP syntax lint (`components/api.php`): Passed
