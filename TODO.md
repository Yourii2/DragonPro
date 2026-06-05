# TODO

## الخطوة 1: وضع آلية منع التكرار في الواجهة (Frontend)
- [ ] إنشاء helper موحّد لقفل تنفيذ نفس الإجراء أثناء وجود request شغال.
- [ ] تطبيق الـ helper على كل أزرار/Forms التي تعمل POST/تعدّل بيانات (create/update/delete/confirm/close/save...).

## الخطوة 2: منع التكرار على السيرفر (Backend)
- [ ] إضافة Idempotency-Key processing داخل components/api.php (module/action endpoints التي تعمل معاملات).
- [ ] إنشاء جدول لتخزين keys الخاصة بكل عملية (user_id + idempotency_key + module + action + status).
- [ ] رفض request المتكرر لنفس key وإرجاع response/نجاح سابق.

## الخطوة 3: ربط الواجهة بالـ Idempotency-Key
- [ ] من الـ frontend، إرسال `X-Idempotency-Key` لكل request مع body/params.

## الخطوة 4: التأكد من endpoints المهمة
- [ ] التركيز على endpoints الأكثر حساسية: sales close/confirmDeliveryNote، معاملات inventory/treasury، attendance bulk عمليات، CRM create/update/delete…

## الخطوة 5: الاختبار
- [ ] تجربة الضغط المتكرر على الأزرار في الشاشات الأساسية والتأكد عدم تكرار المعاملة.

